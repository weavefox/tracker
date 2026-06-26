# Tracker SDK

A lightweight web analytics SDK for tracking user visits and events.

## ✨ Features

- **Device Fingerprinting** - Canvas-based fingerprint for visitor identification
- **Beacon API** - Non-blocking data transmission
- **Offline Queue** - Local storage retry for failed requests
- **Auto Pageview** - Automatic page visit tracking
- **Custom Events** - Track clicks, errors, and custom actions
- **Session Tracking** - Automatic session management (30min timeout)

## 📦 Install

### CDN

```html
<script src="https://cdn.your-domain.com/website-tracker.umd.js"></script>
<script>
  WFTK.init({
    endpoint: 'https://your-api.com/api/v1/collect/event',
    debug: true
  });
</script>
```

### NPM

```bash
npm install @weavefox/tracker
```

```javascript
import { init, track, setUserId } from '@weavefox/tracker';

init({
  endpoint: 'https://your-api.com/api/v1/collect/event'
});
```

## 📖 API

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize the tracker |
| `track(eventName, data)` | Track a custom event |
| `trackPageview(data)` | Track a page view |
| `trackClick(selector, data)` | Auto-track clicks on element |
| `trackError(data)` | Track JavaScript errors |
| `setUserId(userId)` | Set user ID after login |
| `getFingerprint()` | Get device fingerprint |
| `flush()` | Force send queued events |

## ⚙️ Configuration

```javascript
WFTK.init({
  endpoint: 'required',         // Full API URL (required)
  appId: 'optional',            // Your app identifier
  autoPageview: true,           // Auto track page views
  debug: false,                // Enable debug logs
  enableQueue: true,           // Enable offline queue
  sessionTimeout: 1800000,     // Session timeout in ms
  maxEventsPerSession: 1000    // Max events per session
});
```

## 📄 Request Format

```json
{
  "appId": "abc123",  // optional
  "events": [{
    "event": "pageview",
    "timestamp": 1699999999999,
    "nonce": "a1b2c3d4e5f6",
    "fingerprint": "fp_xxx",
    "data": {
      "url": "https://example.com/page",
      "title": "Page Title",
      "referrer": "https://google.com",
      "sessionId": "sess_xxx",
      "sessionStart": 1699999000000,
      "visitCount": 1,
      "deviceType": "desktop",
      "browser": { "name": "Chrome", "version": "120" },
      "os": "macOS",
      "screen": "1920x1080",
      "viewport": "1920x1080",
      "language": "en-US"
    }
  }]
}
```

## 🖥️ Server Implementation

### Endpoint

```
POST /api/v1/collect/event
Content-Type: application/json
```

### App Identification

Primary method: use the `appId` from request body. Optional alternative: identify by request origin (Referrer/Host).

```javascript
// Method 1: From request body (recommended)
const appId = req.body.appId;

// Method 2: By Referrer
const domain = new URL(req.headers.referer || '').hostname;
const appId = await getAppIdByDomain(domain);
```

### Required Features

1. **Timestamp Validation**
   - Reject requests older than 5 minutes
   - `if (now - event.timestamp > 5 * 60 * 1000) return 403;`

2. **Nonce Deduplication**
   - Store used nonces (Redis key: `nonce:{appId}:{nonce}`)
   - TTL: 24 hours
   - `if (redis.exists(key)) return 409;`

3. **Rate Limiting**
   - Per IP: 60 requests/minute
   - Per fingerprint: 10000 events/day

4. **Request Validation**
   - Validate appId is provided OR identify from request origin
   - Validate required fields: `event`, `timestamp`, `nonce`, `fingerprint`

### Example (Node.js + Express)

```javascript
const express = require('express');
const app = express();

app.post('/api/v1/collect/event', async (req, res) => {
  const { appId, events } = req.body;

  if (!appId) {
    return res.status(400).json({ error: 'appId required' });
  }

  for (const event of events) {
    // Check timestamp
    if (Date.now() - event.timestamp > 5 * 60 * 1000) {
      continue; // Skip expired
    }

    // Check nonce (deduplication)
    const nonceKey = `nonce:${appId}:${event.nonce}`;
    if (await redis.setnx(nonceKey, 1)) {
      await redis.expire(nonceKey, 86400);
    } else {
      continue; // Skip duplicate
    }

    // Store event
    await saveEvent(appId, event);
  }

  res.json({ success: true });
});
```

## 📝 License

MIT