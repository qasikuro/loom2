# Phone development

The default `pnpm run dev` starts Expo Go mode behind a temporary Cloudflare
Quick Tunnel. `pnpm run dev:direct` remains available for the original managed
Replit-domain workflow. `pnpm run dev:phone` is an alias for the tunnel
launcher.

The launcher prints its HTTPS URL when the tunnel is ready. A new random URL is
issued after every restart; use the current URL rather than saving an old QR
code. In an installed development client, open **Connect** / **Enter URL
manually** and enter the current HTTPS tunnel URL.

Quick Tunnels are ephemeral development endpoints, not a production hosting or
authentication boundary. Anyone who obtains the URL can reach the running
development gateway. Cloudflare Quick Tunnels do **not** support SSE; the local
gateway's SSE streaming test does not establish SSE compatibility through the
Quick Tunnel provider.