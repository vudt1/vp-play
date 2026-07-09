# VP Play

Cổng giải trí LAN nội bộ với mini-game **Tiến Lên Miền Nam**.

## Quick start

```bash
cp .env.development.example .env.development
# Bật Keycloak thật: bỏ AUTH_DEV_BYPASS và điền KEYCLOAK_*
npm install
npm run dev
```

Mở `http://localhost:3000`.

## Scripts

| Script | Env file | Ghi chú |
| --- | --- | --- |
| `npm run dev` | `.env.development` | Local; thường `AUTH_DEV_BYPASS=1` |
| `npm start` | `.env.production` | Production |
| `npm test` | — | Unit tests domain + roomTable + config |

## Environment

- Templates: `.env.development.example`, `.env.production.example` (xem thêm `.env.example`)
- Không commit `.env`, `.env.development`, `.env.production`
- Claims: `KEYCLOAK_ID_CLAIM` (default `pccuid`), `KEYCLOAK_DISPLAY_NAME_CLAIM` (default `preferred_username`)
- `APP_PREFIX`: public path phía browser khi deploy subpath (vd `/play`); **rỗng** khi chạy root local

## Production subpath (Nginx strip)

App lắng nghe root (`/`, `/socket.io`). Nginx strip prefix `/play` rồi proxy:

```nginx
location /play/ {
    proxy_pass http://localhost:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_cache_bypass $http_upgrade;
}
```

Trên app set `APP_PREFIX=/play` (HTML/JS/Socket.IO client path). Keycloak Valid Redirect URI cần gồm `https://<fqdn>/play/*`.

## Docs

- `AGENTS.md` — quy tắc cho AI / contributor
- `CONTEXT.md` — từ vựng domain
- `docs/adr/` — quyết định kiến trúc
- `spec/` — nghiên cứu sản phẩm
