<h1 align="center">Multinary</h1>

<p align="center">
  <b>Many storage accounts, one drive.</b><br />
  Pool several Cloudinary accounts and S3-compatible buckets behind one self-hosted file manager and upload API.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache%202.0-4f46e5" /></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white" />
  <img alt="MySQL 8+" src="https://img.shields.io/badge/mysql-8%2B-4479A1?logo=mysql&logoColor=white" />
  <img alt="Docker ready" src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white" />
</p>

---

## Why Multinary?

Free storage tiers are small and scattered. A free Cloudinary account is tied to monthly credits, a Cloudflare R2 bucket gives you 10 GB, and every account fills up on its own schedule.

Multinary joins them. Connect as many accounts as you like and you get:

- 📦 **One storage pool.** See the combined usage of every connected account on one dashboard.
- 🧭 **Uploads that pick the right account.** Each file goes to an account that has room. You choose the rule: most free space, round-robin, or your own priority order.
- 🔗 **Direct public URLs.** Every file gets a public URL you can hand to scripts, schedulers, and social-media automation tools.
- 🗂️ **A normal file manager.** Folders, search, list and grid views, previews, rename, move, and bulk actions.
- 🔗 **Sharing that works.** Public share links with a built-in viewer, embeds, and invites for files and folders.
- 🔌 **An upload API.** Send files from scripts or CI with an API key.
- 🏠 **Your own server.** Files pass through your backend to your storage. Nothing is written to the server's disk.

## Storage providers

| Provider | What you connect | Public URL | Limit used for routing |
| --- | --- | --- | --- |
| **Cloudinary** | Cloud name, API key and API secret (one entry per account) | ✅ `res.cloudinary.com` | The quota you enter in GB. Empty means unlimited. |
| **S3-compatible** | Bucket, region, optional endpoint, access keys. Works with AWS S3, **Cloudflare R2**, MinIO, Wasabi, Backblaze B2 or any custom endpoint. | ✅ with a public base URL (e.g. R2 `pub-xxx.r2.dev` or a custom domain) | The quota you enter in bytes. Empty means unlimited. |

**Cloudflare R2** works out of the box: pick the preset in the connect form, paste your bucket endpoint and API token, and add your bucket's public URL. No per-file size caps and zero egress fees, which makes it ideal for hosting large videos behind a public URL.

## Features

**Storage**

- Combined quota summary plus a per-account Quota Tracker.
- Upload routing policies: *most available*, *round-robin*, or *priority order*.
- S3 uploads use the prefix `9drive`. Cloudinary uploads go to the folder you choose when connecting (default `multinary`).

**Files**

- Upload with a progress panel in the bottom-right corner.
- Virtual folders, which you can nest, colour, and give icons.
- Header search with filters for type, account, size, and date.
- Preview images, videos, PDFs, and Office files. Download, rename, move, delete, recycle bin.

**Sharing and teamwork**

- Public share links with a viewer and an embed mode.
- Invite people to a file or folder as a viewer or editor.
- Activity log.

**For developers**

- An external upload API at `POST /api/v1/uploads` with API keys. Keys are shown once, stored hashed, track when they were last used, and can be revoked.
- `GET /files/:id/view-url` returns the direct public URL of a file, from Cloudinary or any S3 bucket with a public base URL.
- Interactive API docs (Swagger UI) at `/api-docs`, plus in-app docs with cURL and JavaScript examples.

**Accounts and admin**

- Email/password sign-up with optional reCAPTCHA.
- Backup/restore and one-click updates from Settings (for PM2 setups).

## Quick start

Two ways to run Multinary. They are independent: the Docker path never touches your local Node.js or MySQL, and the local path never uses Docker. Pick one, don't mix them.

### Option A: Docker (recommended)

You only need Docker. Nothing else: no Node.js, no local MySQL.

```bash
git clone https://github.com/screamolic/9drive.git
cd 9drive
cp .env.docker.example .env      # Windows PowerShell: Copy-Item .env.docker.example .env
# open .env and set JWT_ACCESS_SECRET and TOKEN_ENCRYPTION_KEY to long random strings
docker compose up -d --build
```

Then open **http://localhost:5173** and create an account. 🎉

Note: `MYSQL_*` values in `.env` are for the MySQL container. `JWT_ACCESS_SECRET` and `TOKEN_ENCRYPTION_KEY` are the only secrets you must change to get started.

The backend runs the database migrations on every start, so updating an existing install keeps your data.

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| API docs (Swagger) | http://localhost:4000/api-docs |
| MySQL | localhost:3306 |

<details>
<summary><b>Useful Docker commands</b></summary>

```bash
docker compose logs -f backend      # backend logs (also: frontend, mysql)
docker compose down                 # stop
docker compose down -v              # stop and delete the database volume
```

</details>

### Option B: Run locally (for development)

You need **Node.js 20+**, **npm**, and **MySQL 8+** running on your machine.

> **Already ran the Docker stack?** Stop it first (`docker compose down`), or change the ports. Both setups use ports 3306, 4000, and 5173, so they cannot run at the same time.

**1. Run the setup script.** It writes `backend/.env` and `frontend/.env` with secure random keys, installs dependencies, and generates the Prisma client.

```bash
# Linux / macOS
bash ./setup.sh
```

```powershell
# Windows (PowerShell, from the project folder)
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Enter your MySQL URL when asked (default `mysql://root@localhost:3306/9drive`).

**2. Create the tables and start both apps** in two terminals:

```bash
cd backend
npm run prisma:migrate
npm run dev          # http://localhost:4000
```

```bash
cd frontend
npm run dev          # http://localhost:5173
```

<details>
<summary><b>Prefer to set things up by hand?</b></summary>

```bash
cd backend && npm install
cd ../frontend && npm install
mysql -u root -e "CREATE DATABASE IF NOT EXISTS 9drive;"
```

Create `backend/.env`:

```env
DATABASE_URL="mysql://root@localhost:3306/9drive"
APP_PORT=4000
FRONTEND_URL="http://localhost:5173"
JWT_ACCESS_SECRET="change-this-jwt-secret-at-least-32-chars"
TOKEN_ENCRYPTION_KEY="change-this-encryption-key-32bytes!"
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
MAX_UPLOAD_BYTES=5368709120
RECAPTCHA_SECRET_KEY=""
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_RECAPTCHA_SITE_KEY=
```

Then run `npm run prisma:migrate` in `backend/` and start both dev servers as shown above.

</details>

### Your first five minutes

1. Open http://localhost:5173 and **register**.
2. Go to **Settings** and connect storage: **Connect Cloudinary** or **Connect S3**. Add as many accounts as you want.
3. Open **Quota Tracker** to see your combined storage and choose an upload routing mode.
4. Go to **All Files**, create a folder, and upload something. Watch the progress panel in the corner.
5. Right-click the file and choose **Share Link**, or copy the direct public URL for use in your own tools.

## Connecting Cloudinary

You can connect any number of Cloudinary accounts. Each one needs three values from its dashboard (*Settings → API Keys*): the **cloud name**, an **API key**, and an **API secret**.

In Multinary, open **Settings → Connect Cloudinary** and fill in:

| Field | Notes |
| --- | --- |
| Display name | Any label you like. |
| Cloud name | Letters, numbers, `-` and `_`. This identifies the account, so it can be connected only once per user. |
| API key / API secret | Stored encrypted. Multinary checks them against Cloudinary before saving the account. |
| Folder | Where files go inside that Cloudinary account. Default `multinary`. |
| Storage quota (GB) | Optional. Leave empty for unlimited. |

Things worth knowing:

- **Cloudinary has no byte limit in its API.** Its plans are credit-based, so Multinary cannot read how much space you may use. Enter a quota if you want routing to stop sending files to an account that is getting full. Used space is the larger of Cloudinary's own usage figure and the total of the files Multinary stored there.
- **Free plans cap file sizes by type** (for example video at 100 MB). For large media, prefer an S3-compatible provider like Cloudflare R2.
- **Public URLs.** Images, video and audio are served from `res.cloudinary.com`. `GET /files/:id/view-url` (with your login token) returns that direct URL.
- Files are held in memory while uploading, so very large files are limited by your server's RAM.

## Connecting S3-compatible storage (Cloudflare R2, MinIO, Wasabi, …)

Open **Settings → Connect S3** and fill in:

| Field | Notes |
| --- | --- |
| Display name | Any label you like. |
| Bucket | Your bucket name. |
| Region | `auto` for Cloudflare R2, or your provider's region. |
| Endpoint URL | Your provider's S3 endpoint, e.g. `https://<accountid>.r2.cloudflarestorage.com`. Leave empty for AWS S3. |
| Access key ID / Secret access key | From your provider (R2: *Manage R2 API Tokens*). |
| Public base URL | Optional but recommended: the bucket's public URL, e.g. `https://pub-xxx.r2.dev` or your custom domain. When set, `GET /files/:id/view-url` returns a direct public URL for every file. |
| Quota bytes | Optional. Leave empty for unlimited. |

For **Cloudflare R2**, click the **Preset: Cloudflare R2** button first, then paste your values. Make sure public access is enabled on the bucket (R2 → bucket → Settings → Public Development URL, or connect a custom domain).

## Configuration

<details>
<summary><b>Backend environment variables</b> (<code>backend/.env</code>)</summary>

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | MySQL connection string. |
| `APP_PORT` | Backend port (default `4000`). |
| `FRONTEND_URL` | The frontend's URL. CORS only allows this origin. |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens. At least 32 characters, random. |
| `TOKEN_ENCRYPTION_KEY` | Key for encrypting S3 and Cloudinary credentials. At least 32 characters, random. If you lose or change it, stored credentials can no longer be read. |
| `ACCESS_TOKEN_TTL_SECONDS` | Access token lifetime (default `900`). |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime (default `30`). |
| `MAX_UPLOAD_BYTES` | Largest allowed upload (default 5 GB). |
| `RECAPTCHA_SECRET_KEY` | Optional. Turns on captcha for sign-up, together with the frontend site key. |

</details>

<details>
<summary><b>Frontend environment variables</b> (<code>frontend/.env</code>)</summary>

| Variable | What it does |
| --- | --- |
| `VITE_API_URL` | Backend URL. Vite bakes it in at build time, so **rebuild the frontend after changing it**. |
| `VITE_RECAPTCHA_SITE_KEY` | Optional reCAPTCHA site key. Leave it empty to turn captcha off. Also baked in at build time. |

Captcha only turns on when **both** `VITE_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` are set.

</details>

## Deploying to a server

<details>
<summary><b>VPS with Docker, step by step</b></summary>

1. **Install Docker** (Ubuntu/Debian):
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose
   sudo systemctl enable --now docker
   ```
2. **Clone and configure:**
   ```bash
   git clone https://github.com/screamolic/9drive.git
   cd 9drive
   cp .env.docker.example .env
   nano .env
   ```
   - `FRONTEND_URL`: your public frontend URL, e.g. `https://multinary.yourdomain.com`
   - `VITE_API_URL`: your public backend URL, e.g. `https://api.multinary.yourdomain.com` (baked into the frontend image at build)
   - Strong random values for `JWT_ACCESS_SECRET` and `TOKEN_ENCRYPTION_KEY`
3. **Start it:** `docker compose up -d --build`

   Every later change to `VITE_API_URL` or `VITE_RECAPTCHA_SITE_KEY` needs a rebuild: `docker compose up -d --build`.

Production tips:
- Put the frontend and backend behind an HTTPS reverse proxy.
- Don't expose the MySQL port to the internet.
- Rebuild the frontend whenever `VITE_API_URL` or `VITE_RECAPTCHA_SITE_KEY` changes.
- Back up `TOKEN_ENCRYPTION_KEY` somewhere safe.

</details>

<details>
<summary><b>Without Docker</b></summary>

```bash
cd backend
npm run build
npm run start:deploy     # = prisma migrate deploy + start the server
```

```bash
cd frontend
npm run build            # serve frontend/dist with any static web server
```

`prisma migrate deploy` never resets data. If Prisma reports migration drift, stop and repair the migration history first. **Never run `prisma migrate reset` in production.**

</details>

<details>
<summary><b>One-click updates (PM2 setups)</b></summary>

On a VPS where the backend runs under PM2, **Settings** has an update button and a live log viewer. When you press it, the backend runs `update.sh` from the project root. If that file doesn't exist, it falls back to `git pull`.

A typical `update.sh` does the same as these manual commands:

```bash
git reset --hard
git pull origin main
cd backend && npm install && npx prisma generate && npm run build && npx prisma migrate deploy
cd ../frontend && npm install && npm run build
pm2 restart 9drive-backend
```

The update pulls whatever is on `main`, so make sure the migration for a new feature has been checked before you press it.

</details>

## Upload API

Create a key under **API Keys** in the app, then send files as `multipart/form-data`. Each upload is routed using the same rules as the dashboard, so it can land on any connected Cloudinary or S3 account. Keys start with `9d_live_`.

```bash
curl -X POST "http://localhost:4000/api/v1/uploads" \
  -H "Authorization: Bearer 9d_live_..." \
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \
  -F "file-0=@hello.txt;type=text/plain"
```

`filesMeta` must come **before** the files. It's a JSON array of `{ fieldName, fileName, mimeType, sizeBytes, folderId? }`, and each `fieldName` matches a file field (`file-0`, `file-1`, …).

The full interactive reference lives at **`/api-docs`** (Swagger UI).

<details>
<summary><b>Full REST API overview</b></summary>

Authenticated routes expect `Authorization: Bearer ***`.

```txt
Health        GET  /health

Auth          POST /auth/register · POST /auth/login · POST /auth/refresh · POST /auth/logout · GET /auth/me

Accounts      GET  /connected-accounts · DELETE /connected-accounts/:id · POST /connected-accounts/:id/sync-quota
              POST /connected-accounts/s3 · POST /connected-accounts/cloudinary

Storage       GET  /storage/summary · GET /storage/breakdown
              GET  /storage/routing-policy · PATCH /storage/routing-policy

Folders       GET  /folders?parentId=<id> · GET /folders?all=1 · GET /folders/recent?limit=4
              POST /folders · PATCH /folders/:id · DELETE /folders/:id

Files         GET  /files · /files?folderId=<id> · /files?q=<search> · GET /files/:id · GET /files/trash
              PATCH /files/:id · PATCH /files/batch · DELETE /files/:id · DELETE /files/batch
              POST /files/batch/restore · DELETE /files/batch/permanent · POST /files/batch-download
              POST /files/:id/share · DELETE /files/:id/share · POST /files/:id/preview-token
              GET  /files/:id/view-url · GET /files/:id/download · GET /files/preview/:token

Invites       GET /invites · POST /invites · DELETE /invites/:id
API keys      GET /api-keys · POST /api-keys · DELETE /api-keys/:id
Activity      GET /audit-logs
API docs      GET /api-docs (Swagger UI) · GET /api-docs/openapi.json
Public files  GET /public/files/:token · GET /public/files/:token/download · GET /public/files/:token/preview
External API  POST /api/v1/uploads   (API key with the files:upload scope)
```

</details>

## Troubleshooting

<details>
<summary><b>"Cloudinary rejected the credentials or cloud name"</b></summary>

The cloud name, API key or API secret is wrong. Copy them again from the Cloudinary dashboard (*Settings → API Keys*). The cloud name is not the account email or the display name.

</details>

<details>
<summary><b>Downloading a Cloudinary PDF or ZIP fails with 401 or 403</b></summary>

Cloudinary can block delivery of PDF, ZIP and other non-media files on some accounts. Allow it in the account's security settings. Images, video and audio are not affected.

</details>

<details>
<summary><b>A Cloudinary upload fails with a file size error</b></summary>

Cloudinary limits the size of each file by type, and free plans have the lowest limits (video is capped around 100 MB). For large media, connect an S3-compatible provider like Cloudflare R2, which has no per-file caps.

</details>

<details>
<summary><b>view-url returns null for an S3 file</b></summary>

The bucket has no public base URL configured. Edit the account's S3 settings and set **Public base URL** (e.g. `https://pub-xxx.r2.dev`), and make sure public access is enabled on the bucket itself.

</details>

<details>
<summary><b>S3 connect fails with a connection or SSL error</b></summary>

Check that the endpoint URL is exactly what your provider gives you. For Cloudflare R2 it looks like `https://<accountid>.r2.cloudflarestorage.com`, and the region is `auto`. Keep **Force path style** checked for R2 and MinIO.

</details>

<details>
<summary><b>Prisma client generation fails on Windows</b></summary>

A running Node process is locking the file. Stop the backend and frontend dev servers, then run `npx prisma generate` in `backend/`.

</details>

<details>
<summary><b>The frontend still calls the old API URL</b></summary>

Vite bakes `VITE_API_URL` into the build. Rebuild the frontend, or with Docker run `docker compose up -d --build`.

</details>

## Security

- Uploads pass through the backend straight to Cloudinary or S3. **Nothing is stored on the server's disk.**
- S3 and Cloudinary credentials are encrypted in MySQL. App refresh tokens, API keys, preview tokens, and auth-handoff tokens are stored only as hashes.
- CORS only allows `FRONTEND_URL`.
- Public provider URLs are public. Anyone who has the URL can open the file, so don't upload anything private to a public bucket or Cloudinary account.
- Never commit `.env` files or share `TOKEN_ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, `RECAPTCHA_SECRET_KEY`, Cloudinary API secrets, or raw share links you want to keep private.

## Project structure

```txt
backend/    Express 5 + TypeScript API, Prisma (MySQL), Cloudinary and S3 integrations
frontend/   React 19 + Vite + Tailwind CSS 4 app (installable PWA)
docs/       Progress and plan (MULTINARY_PROGRESS.md)
```

Build checks: `cd backend && npm run build` and `cd frontend && npm run build`.

## Credits and license

Multinary is based on [9Drive](https://github.com/zenhosta/9drive) by Zenhosta.

Copyright 2026 Zenhosta

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
