# Installation Guide — NovaNEXT Connect

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Node.js | 18+ | LTS recommended |
| npm | 9+ | Bundled with Node |
| OS | macOS / Linux / Windows | All supported |

## 1. Clone the Repository

```bash
git clone https://github.com/paulfxyz/novanext-connect
cd novanext-connect
```

## 2. Install Dependencies

```bash
npm install
```

This installs all frontend (React, Vite, Tailwind, shadcn/ui) and backend (Express, Drizzle, better-sqlite3) dependencies.

## 3. Environment Configuration

The application works out-of-the-box with defaults. For production, you may want to set:

```bash
# .env (optional)
NODE_ENV=production
PORT=5000
OPENROUTER_API_KEY=sk-or-v1-...  # already embedded in routes.ts
```

> **Note**: The OpenRouter API key is currently embedded in `server/routes.ts` for simplicity. For production deployments, move it to an environment variable.

## 4. Development

```bash
npm run dev
```

This starts:
- Vite dev server (HMR) for the frontend
- Express backend on the same port

Open `http://localhost:5000`

## 5. Production Build

```bash
npm run build
```

Outputs:
- `dist/public/` — static frontend assets
- `dist/index.cjs` — compiled Express server

## 6. Run in Production

```bash
NODE_ENV=production node dist/index.cjs
```

The SQLite database (`data.db`) is created automatically on first run.

## 7. Admin Access

Navigate to `/admin` (or click the Admin button). The default PIN is **`0000`**.

To change the PIN, edit `CORRECT_PIN` in `client/src/pages/admin-login.tsx` and rebuild.

## 8. FTP Deployment (nova.paulfleury.com)

For deploying to the FTP host:

```bash
npm run build

# Upload dist/public/* to public_html
ftp ftp.paulfleury.com
# Username: nova@paulfleury.com
# Password: [configured]
```

> For a Node.js backend on the FTP host, you'll need a process manager (PM2) or use the pplx.app hosted version.

## Troubleshooting

### Port already in use
```bash
lsof -i :5000
kill -9 <PID>
```

### SQLite errors on first run
The database is created automatically. If you see errors, ensure write permissions on the project directory:
```bash
chmod 755 .
```

### AI research returns empty results
Check that the OpenRouter API key is valid and has credits. The endpoint is `POST /api/admin/research` — test directly:
```bash
curl -X POST http://localhost:5000/api/admin/research \
  -H "Content-Type: application/json" \
  -d '{"query": "Pedro Quintas"}'
```
