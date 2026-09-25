# TravelAI (zia)

React/Vite travel recommendations frontend and Express API. In production one Node.js process (`server.js`) serves the compiled site and `/api` on the same port. The OpenAI key stays on the server.

## Requirements

- Node.js 22+ and npm (or Docker with Compose)
- An OpenAI API key with access to the configured model and web search

## Run on a server

```bash
git clone https://github.com/lambda19-auto/zia.git
cd zia
git switch dev
cp .env.example .env
# Edit .env and set OPENAI_API_KEY to your real key.
npm ci
npm run build
NODE_ENV=production npm start
```

The server listens on port `8787` by default. Set `PORT` to a valid port to change it. Open `http://localhost:8787/` and check `http://localhost:8787/api/health`. Use a process manager (for example systemd) to keep `npm start` running, and configure HTTPS in your reverse proxy. The example `nginx/nginx.conf` expects TLS files at `/etc/nginx/certs/` and proxies to `127.0.0.1:8787`; adapt its certificate paths and hostname for your server. Never commit `.env` or send the key to the browser.

Docker Compose runs the same production server and binds it only to the host loopback interface:

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY.
docker compose up --build -d
curl http://127.0.0.1:8787/api/health
```

Place a host reverse proxy in front of port `8787` for public HTTPS access. To expose the container directly, change the host port binding in `docker-compose.yml` and provide TLS separately.

## Development

Run `npm ci`, then `npm run build && npm start` for the API on port `8787`. In another terminal run `npm run dev` for Vite on port `3000`; Vite proxies `/api` to the Node server. After changing the frontend, `npm run build` refreshes the files served on port `8787`.

## Checks

```bash
npm run lint
npm test
```

`npm test` builds the frontend and runs a smoke test of the single-process server. Live OpenAI requests require a valid key and external API access; the smoke test does not make paid requests.
