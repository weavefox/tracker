/**
 * 设备指纹生成模块
 * 使用 Canvas 指纹 + 基础浏览器信息生成唯一标识
 */

interface FingerprintData {
  ua: string;
  language: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  colorDepth: number;
  timezone: number;
  canvas: string;
}

/**
 * 生成 Canvas 指纹
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    canvas.width = 200;
    canvas.height = 50;

    // 绘制包含文字和图形的复杂图案
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Weavefox 🎯', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Tracker', 4, 17);

    // 混合模式增加差异
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255, 0, 255)';
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2);
    ctx.fill();

    // 获取 DataURL
    const dataURL = canvas.toDataURL();
    return hashCode(dataURL).toString(16);
  } catch {
    return 'canvas_unsupported';
  }
}

/**
 * 简单哈希函数
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  // 使用无符号位移，避免 Math.abs 溢出导致的哈希碰撞
  return (hash >>> 0);
}

/**
 * 生成设备指纹
 */
export function generateFingerprint(): string {
  const data: FingerprintData = {
    ua: navigator.userAgent,
    language: navigator.language || 'unknown',
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    colorDepth: window.screen.colorDepth || 24,
    timezone: new Date().getTimezoneOffset(),
    canvas: getCanvasFingerprint()
  };

  // 构建特征字符串并哈希
  const signature = [
    data.ua,
    data.language,
    data.platform,
    `${data.screenWidth}x${data.screenHeight}`,
    data.colorDepth,
    data.timezone,
    data.canvas
  ].join('|');

  return `fp_${hashCode(signature).toString(16)}`;
}

/**
 * 获取设备类型
 */
export function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  const ua = navigator.userAgent.toLowerCase();

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }

  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * 获取浏览器信息
 */
export function getBrowserInfo(): { name: string; version: string } {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = '0';

  // Chrome
  if (/chrome\/(\d+)/i.test(ua) && !/edge/i.test(ua)) {
    name = 'Chrome';
    version = /chrome\/(\d+)/i.exec(ua)?.[1] || '0';
  }
  // Safari
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    name = 'Safari';
    version = /version\/(\d+)/i.exec(ua)?.[1] || '0';
  }
  // Firefox
  else if (/firefox\/(\d+)/i.test(ua)) {
    name = 'Firefox';
    version = /firefox\/(\d+)/i.exec(ua)?.[1] || '0';
  }
  // Edge
  else if (/edg\/(\d+)/i.test(ua)) {
    name = 'Edge';
    version = /edg\/(\d+)/i.exec(ua)?.[1] || '0';
  }
  // IE
  else if (/msie|trident/i.test(ua)) {
    name = 'IE';
    version = /(?:msie |rv:)(\d+)/i.exec(ua)?.[1] || '0';
  }

  return { name, version };
}

/**
 * 检测是否为机器人/爬虫访问
 * 通过 UA 关键词 + navigator.webdriver 检测
 */
export function isBot(): boolean {
  const ua = navigator.userAgent;

  // UA 关键词匹配：已知爬虫、自动化工具、HTTP 客户端
  if (/bot|crawl|spider|slurp|headless|phantom|selenium|puppeteer|playwright|python-requests|curl|wget|httpclient/i.test(ua)) {
    return true;
  }

  // Selenium / Puppeteer 等自动化工具会设置此属性为 true
  if (navigator.webdriver === true) {
    return true;
  }

  return false;
}

/**
 * 获取操作系统
 */
export function getOS(): string {
  const ua = navigator.userAgent;

  if (/windows nt 10/i.test(ua)) return 'Windows 10';
  if (/windows nt 6.3/i.test(ua)) return 'Windows 8.1';
  if (/windows nt 6.2/i.test(ua)) return 'Windows 8';
  if (/windows nt 6.1/i.test(ua)) return 'Windows 7';
  if (/mac os x (\d+)[._](\d+)/i.test(ua)) return 'macOS';
  if (/android (\d+)/i.test(ua)) return `Android ${/android (\d+)/i.exec(ua)?.[1]}`;
  if (/ios(\d+)/i.test(ua)) return `iOS`;
  if (/linux/i.test(ua)) return 'Linux';

  return 'Unknown';
}