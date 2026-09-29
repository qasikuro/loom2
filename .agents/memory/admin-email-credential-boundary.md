---
name: Admin email credential boundary
description: Why admin email sending uses the connected Resend service rather than a separately managed API key
---

Use the Replit Resend connection from the API server for outbound admin mail. Do not put provider credentials in the browser or request a second API-key secret when the connection is healthy.

**Why:** The connection already manages the credential and injects it into authenticated provider requests. A second copy increases the chance of exposure and inconsistent rotation.

**How to apply:** Keep new outbound email features behind authenticated server routes, using the existing provider connection. Treat an accepted provider response as queued for delivery, not proof that the recipient received the message.