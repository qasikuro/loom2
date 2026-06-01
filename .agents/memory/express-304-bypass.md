---
name: Express ETag 304 bypass
description: How to prevent Express from returning 304 when you always want fresh data
---

Express generates an ETag from the **response body**. If the body hasn't changed, and the client sends `If-None-Match`, Express returns 304 — even if you set `Cache-Control: no-store` on the response. The `?t=timestamp` query-string trick doesn't help because the ETag is computed from the body, not the URL.

**The fix:** add a timestamp field inside the response body so the ETag is always unique:

```javascript
return res.set('Cache-Control', 'no-store').json({
  ...yourData,
  _ts: Date.now(),   // body changes every call → unique ETag → always 200
});
```

**Why:** `Cache-Control: no-store` on the *response* does not disable Express's `req.fresh` check, which compares the computed ETag against the client's `If-None-Match` header. The only reliable way to prevent 304 without disabling ETags globally (`app.set('etag', false)`) is to make the body non-deterministic.

**How to apply:** Use on any route that must never serve stale data to a native HTTP client (React Native fetch caches aggressively). The `_ts` field is ignored by clients that don't know about it.
