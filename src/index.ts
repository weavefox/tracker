/**
 * Tracker SDK
 * Lightweight web analytics SDK
 *
 * @example
 * // NPM
 * import { init, track, setUserId } from '@weavefox/tracker';
 *
 * init({
 *   endpoint: 'https://your-api.com/api/v1/collect/event'
 * });
 *
 * track('button_click', { label: 'signup' });
 * setUserId('user_123');
 */

import { Tracer, TrackerConfig } from './tracker';

// 全局单例
let trackerInstance: Tracer | null = null;

/**
 * Initialize the tracker
 */
export function init(config: TrackerConfig): Tracer {
  if (trackerInstance) {
    console.warn('[WFTK] Previous tracker instance will be replaced');
  }

  trackerInstance = new Tracer(config);
  trackerInstance.init();

  return trackerInstance;
}

/**
 * Track a custom event
 */
export function track(eventName: string, data?: Record<string, any>): void {
  trackerInstance?.track(eventName, data);
}

/**
 * Track page view
 */
export function trackPageview(data?: Record<string, any>): void {
  trackerInstance?.trackPageview(data);
}

/**
 * Set user ID after login
 */
export function setUserId(userId: string): void {
  trackerInstance?.setUserId(userId);
}

/**
 * Get device fingerprint
 */
export function getFingerprint(): string {
  return trackerInstance?.getFingerprint() || '';
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return trackerInstance?.getSessionId() || '';
}

/**
 * Force send queued events
 */
export function flush(): void {
  trackerInstance?.flush();
}

/**
 * Get queued events count
 */
export function getQueueSize(): number {
  return trackerInstance?.getQueueSize() || 0;
}

/**
 * Get tracker instance
 */
export function getTracker(): Tracer | null {
  return trackerInstance;
}

/**
 * Check if current visitor is a bot/crawler
 */
export { isBot } from './fingerprint';

// Export types
export type { TrackerConfig } from './tracker';