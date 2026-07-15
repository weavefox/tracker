/**
 * 工具函数模块
 */

/**
 * 生成随机字符串
 */
export function generateNonce(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 获取当前时间戳（毫秒）
 */
export function getTimestamp(): number {
  return Date.now();
}

/**
 * 获取页面 Referer
 */
export function getReferer(): string {
  return document.referrer || '';
}

/**
 * 获取页面标题
 */
export function getTitle(): string {
  return document.title || '';
}

/**
 * 获取完整的页面 URL
 */
export function getPageUrl(): string {
  return window.location.href;
}

/**
 * 获取视口信息
 */
export function getViewport(): { width: number; height: number } {
  return {
    width: window.visualViewport?.width || window.innerWidth,
    height: window.visualViewport?.height || window.innerHeight
  };
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends Record<string, any>, S extends Partial<T>>(
  target: T,
  source: S
): T & S {
  const result = { ...target } as T & S;

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key] as any);
    } else if (source[key] !== undefined) {
      result[key] = source[key] as any;
    }
  }

  return result;
}

/**
 * 检查是否为同一个会话（会话超时：30分钟）
 */
export function isSameSession(lastTime: number, timeout: number = 30 * 60 * 1000): boolean {
  return getTimestamp() - lastTime < timeout;
}

/**
 * 获取存储键名前缀
 */
export function getStorageKey(name: string): string {
  return `wf_${name}`;
}