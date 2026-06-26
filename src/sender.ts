/**
 * 数据上报模块
 * 支持 Beacon API 和 fetch 上报，带本地缓存重试机制
 */

import { getTimestamp, generateNonce } from './utils';

export interface SendOptions {
  url: string;
  data: any;
  useBeacon?: boolean;
}

export interface QueueItem {
  id: string;
  url: string;
  data: any;
  retries: number;
  createdAt: number;
}

// 最大重试次数
const MAX_RETRIES = 3;
// 队列最大长度
const MAX_QUEUE_SIZE = 100;
// 重试间隔（毫秒）
const RETRY_DELAY = 2000;
// 本地存储键名
const QUEUE_KEY = 'wf_send_queue';

/**
 * 发送数据
 */
export async function sendData(options: SendOptions): Promise<boolean> {
  const { url, data, useBeacon = true } = options;

  // 优先使用 Beacon API
  if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    return sendByBeacon(url, data);
  }

  // Fallback 到 fetch
  return sendByFetch(url, data);
}

/**
 * 通过 Beacon API 发送
 */
function sendByBeacon(url: string, data: any): boolean {
  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

/**
 * 通过 fetch 发送
 */
async function sendByFetch(url: string, data: any): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      // 避免 CORS 预检
      mode: 'cors',
      // 不阻塞页面卸载
      keepalive: true
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 本地队列管理
 */
class SendQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private processTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * 添加到队列
   */
  enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'retries'>): void {
    const queueItem: QueueItem = {
      ...item,
      id: generateNonce(8),
      createdAt: getTimestamp(),
      retries: 0
    };

    this.queue.push(queueItem);

    // 限制队列大小，移除最老的
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    this.saveToStorage();
    this.scheduleProcess();
  }

  /**
   * 处理队列
   */
  async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    const succeedIds: string[] = [];
    const failedItems: QueueItem[] = [];

    for (const item of this.queue) {
      const success = await sendData({ url: item.url, data: item.data });

      if (success) {
        succeedIds.push(item.id);
      } else {
        item.retries++;
        if (item.retries < MAX_RETRIES) {
          failedItems.push(item);
        }
        // 超过最大重试次数，丢弃
      }
    }

    // 更新队列
    this.queue = failedItems;
    this.saveToStorage();
    this.isProcessing = false;

    // 如果还有失败项，稍后重试
    if (this.queue.length > 0) {
      this.scheduleProcess();
    }
  }

  /**
   * 调度处理（带延迟，避免频繁发请求）
   */
  private scheduleProcess(): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }

    this.processTimer = setTimeout(() => {
      this.process();
    }, RETRY_DELAY);
  }

  /**
   * 保存到 localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // 存储失败不影响主流程
    }
  }

  /**
   * 从 localStorage 加载
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // 清理超过24小时的队列项
        const now = getTimestamp();
        this.queue = this.queue.filter(item => now - item.createdAt < 24 * 60 * 60 * 1000);
      }
    } catch {
      this.queue = [];
    }
  }

  /**
   * 获取队列长度
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * 清空队列（一般用于调试）
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }
}

// 导出单例
export const sendQueue = new SendQueue();