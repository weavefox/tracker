/**
 * 核心追踪器模块
 * 支持自动页面采集、手动埋点
 */

import {
  generateFingerprint,
  getDeviceType,
  getBrowserInfo,
  getOS,
  isBot
} from './fingerprint';
import {
  getTimestamp,
  generateNonce,
  getReferer,
  getTitle,
  getPageUrl,
  getViewport,
  deepMerge,
  getStorageKey,
  isSameSession,
  throttle
} from './utils';
import { sendData, sendQueue } from './sender';

// 配置类型
export interface TrackerConfig {
  appId?: string;
  endpoint: string;
  autoPageview?: boolean;
  debug?: boolean;
  sessionTimeout?: number;
  maxEventsPerSession?: number;
  enableQueue?: boolean;
  enableBotFilter?: boolean;
}

// 事件类型
export type EventType =
  | 'pageview'
  | 'click'
  | 'scroll'
  | 'custom'
  | 'js_error'
  | 'performance';

// 事件数据
export interface TrackEvent {
  event: EventType;
  timestamp: number;
  nonce: string;
  fingerprint: string;
  data: Record<string, any>;
  userId?: string;
}

// 上报请求体
export interface Payload {
  appId?: string;
  events: TrackEvent[];
}

// 会话信息
interface Session {
  id: string;
  startTime: number;
  lastTime: number;
  visitCount: number;
}

// 默认配置
const DEFAULT_CONFIG: Partial<TrackerConfig> = {
  autoPageview: true,
  debug: false,
  sessionTimeout: 30 * 60 * 1000, // 30分钟
  maxEventsPerSession: 1000,
  enableQueue: true,
  enableBotFilter: true
};

export class Tracer {
  private config: TrackerConfig;
  private fingerprint: string;
  private isBot: boolean;
  private session: Session;
  private userId?: string;
  private eventCount = 0;
  private isInitialized = false;
  private boundClickSelectors = new Set<string>();

  constructor(config: TrackerConfig) {
    this.config = deepMerge(DEFAULT_CONFIG, config);
    this.fingerprint = generateFingerprint();
    this.isBot = isBot();
    this.session = this.initSession();
    this.initAutoTrack();
  }

  /**
   * 初始化
   */
  init(): void {
    if (this.isInitialized) {
      this.warn('Tracker already initialized');
      return;
    }

    this.isInitialized = true;

    // 自动页面浏览
    if (this.config.autoPageview) {
      this.trackPageview();
    }

    this.log('Tracker initialized', {
      appId: this.config.appId || '(none)',
      fingerprint: this.fingerprint
    });
  }

  /**
   * 初始化会话
   */
  private initSession(): Session {
    const storageKey = getStorageKey('session');
    let session: Session;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Session;
        // 检查是否在会话超时时间内
        if (isSameSession(parsed.lastTime, this.config.sessionTimeout)) {
          session = {
            ...parsed,
            lastTime: getTimestamp(),
            visitCount: parsed.visitCount + 1
          };
        } else {
          // 会话超时，创建新会话
          session = this.createSession(parsed.visitCount + 1);
        }
      } else {
        session = this.createSession(1);
      }
    } catch {
      session = this.createSession(1);
    }

    this.saveSession(session);
    return session;
  }

  /**
   * 创建新会话
   */
  private createSession(visitCount: number): Session {
    return {
      id: generateNonce(24),
      startTime: getTimestamp(),
      lastTime: getTimestamp(),
      visitCount
    };
  }

  /**
   * 保存会话
   */
  private saveSession(session: Session): void {
    try {
      localStorage.setItem(getStorageKey('session'), JSON.stringify(session));
    } catch {
      // 存储失败不影响追踪
    }
  }

  /**
   * 初始化自动追踪
   */
  private initAutoTrack(): void {
    if (typeof window === 'undefined') return;

    // 页面卸载前尝试发送剩余数据
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // 页面可见性变化时处理
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flush();
      }
    });
  }

  /**
   * 构建事件数据
   */
  private buildEvent(eventType: EventType, data: Record<string, any> = {}): TrackEvent {
    // 检查事件数量限制
    this.eventCount++;
    if (this.eventCount > (this.config.maxEventsPerSession || 1000)) {
      this.warn('Event limit reached, dropping event');
      throw new Error('Event limit reached');
    }

    const eventData: TrackEvent = {
      event: eventType,
      timestamp: getTimestamp(),
      nonce: generateNonce(),
      fingerprint: this.fingerprint,
      data: {
        ...this.getBaseData(),
        ...data
      },
      userId: this.userId
    };

    return eventData;
  }

  /**
   * 获取基础数据
   */
  private getBaseData() {
    const { width, height } = getViewport();

    return {
      // 页面信息
      url: getPageUrl(),
      title: getTitle(),
      referer: getReferer(),
      referrer: getReferer(), // 冗余传输

      // 会话信息
      sessionId: this.session.id,
      sessionStart: this.session.startTime,
      visitCount: this.session.visitCount,

      // 设备信息
      deviceType: getDeviceType(),
      browser: getBrowserInfo(),
      os: getOS(),
      screen: `${window.screen.width}x${window.screen.height}`,
      viewport: `${width}x${height}`,
      language: navigator.language,
      timezone: new Date().getTimezoneOffset(),

      // 页面加载时间
      loadTime: performance?.timing?.loadEventEnd || 0
    };
  }

  /**
   * 上报事件
   */
  private async report(eventType: EventType, data: Record<string, any> = {}): Promise<void> {
    // 机器人过滤
    if (this.config.enableBotFilter !== false && this.isBot) {
      return;
    }

    try {
      const event = this.buildEvent(eventType, data);

      const payload: Payload = {
        appId: this.config.appId,
        events: [event]
      };

      // 发送到服务端
      const url = this.config.endpoint;

      if (this.config.enableQueue) {
        sendQueue.enqueue({ url, data: payload });
      } else {
        await sendData({ url, data: payload });
      }

      this.log('Event tracked', { event: eventType, data });
    } catch (error) {
      if (this.config.debug) {
        console.error('[WFTK] Track error:', error);
      }
    }
  }

  /**
   * 追踪页面浏览
   */
  trackPageview(data: Record<string, any> = {}): void {
    this.report('pageview', data);
  }

  /**
   * 追踪自定义事件
   */
  track(eventName: string, data: Record<string, any> = {}): void {
    this.report('custom', { eventName, ...data });
  }

  /**
   * 追踪点击事件（自动绑定）
   */
  trackClick(selector: string, data: Record<string, any> = {}): void {
    if (typeof document === 'undefined') return;

    // 防止重复绑定相同 selector
    if (this.boundClickSelectors.has(selector)) {
      this.warn(`Click handler for "${selector}" already bound`);
      return;
    }
    this.boundClickSelectors.add(selector);

    const handler = throttle((e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const closest = target.closest(selector);

      if (closest) {
        this.report('click', {
          element: selector,
          tag: target.tagName.toLowerCase(),
          text: target.textContent?.slice(0, 50),
          ...data
        });
      }
    }, 1000);

    document.addEventListener('click', handler);
  }

  /**
   * 追踪 JavaScript 错误
   */
  trackError(data: Record<string, any> = {}): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.report('js_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        ...data
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.report('js_error', {
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        ...data
      });
    });
  }

  /**
   * 设置用户 ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
    this.log('User ID set', { userId });
  }

  /**
   * 获取设备指纹
   */
  getFingerprint(): string {
    return this.fingerprint;
  }

  /**
   * 获取当前会话 ID
   */
  getSessionId(): string {
    return this.session.id;
  }

  /**
   * 刷新队列
   */
  flush(): void {
    sendQueue.process();
  }

  /**
   * 获取待发送队列数量
   */
  getQueueSize(): number {
    return sendQueue.size();
  }

  /**
   * DEBUG 日志
   */
  private log(message: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[WFTK] ${message}`, data || '');
    }
  }

  /**
   * DEBUG 警告
   */
  private warn(message: string, data?: any): void {
    if (this.config.debug) {
      console.warn(`[WFTK] ${message}`, data || '');
    }
  }
}

export default Tracer;