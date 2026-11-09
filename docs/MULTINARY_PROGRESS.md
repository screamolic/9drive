# Multinary: progress and plan

Handoff notes for whoever continues this work (human or agent). Read `AGENTS.md` and `CLAUDE.md` first; they hold the conventions and architecture. This file holds the current state, what is verified, and what comes next.

Last updated: 2026-11-09.

## Goal

Turn this fork of 9Drive into **Multinary**: one dashboard and API that pools many storage accounts, with **multiple Cloudinary accounts** as the main target. Cloudinary files get direct public URLs, so they can feed external tools (for example a social media scheduler). Google Drive and S3 keep working.

## Status

### Done

1. **Rebrand (display name only).** User-visible "9Drive" is now "Multinary": UI text, page titles, PWA manifest, SVG labels, download filenames (`multinary-backup.db`, `multinary-download.zip`), README, AGENTS.md.
   Deliberately **not** renamed, to keep existing installs working: the `9drive` Google Drive folder and S3 prefix default, MySQL database/user names, `localStorage` keys (`9drive.*`) and custom event names (`9drive:*`), the `cd 9drive` hint in the self-update message.
2. **Cloudinary provider** (third provider next to `google_drive` and `s3`). Details are in `CLAUDE.md` under "Cloudinary provider". Summary:
   - Prisma model `CloudinaryConfig` and migration `20261108120000_cloudinary_support`.
   - `backend/src/modules/cloudinary/`: `cloudinary.service.ts` (signed upload and destroy, Usage API quota sync, delivery streaming) and `cloudinary.utils.ts` (pure helpers, no Prisma).
   - `POST /connected-accounts/cloudinary` validates credentials against the Usage API before keeping the account.
   - Wired into upload routing (all three policies), streaming, permanent delete, rename, batch zip download, and `GET /files/:id/view-url` (returns the direct public URL).
   - UI: "Connect Cloudinary" form in Settings (quota entered in GB); provider labels and "Unlimited" in Quota Tracker and All Files.

3. **Files and content queue API** (API-key driven, under `/api/v1`). Details in `CLAUDE.md` ("Content queue and files API") and the README section "Files and queue API".
   - Prisma model `QueueItem` and migration `20261109060000_content_queue`.
   - `modules/queue/queue.routes.ts` (create, list, claim, get, update, delete), `modules/public-api/public-files.routes.ts` and `media.ts`.
   - API key scopes `files:read`, `queue:read`, `queue:write` (API Keys page now has a scope picker and docs for these endpoints).
   - Design choices: Cloudinary and S3 files can be queued, Google Drive files cannot (Drive has no public file URL). The S3 `mediaUrl` is built from the config (new optional `S3StorageConfig.publicBaseUrl`, migration `20261109070000_s3_public_base_url`) and only works if the bucket allows public reads, so R2 needs `publicBaseUrl`; `target` is a free label (for example one social account per worker); claiming uses an optimistic lock so concurrent workers never get the same item; stuck `processing` items are re-offered after 15 minutes.
   - **Not built:** a dashboard page for the queue (API only), and the worker that actually posts to a social media service. Those belong to the consumer (for example the Hermes Agent harness) or a later task.

### Verified

- Request signing matches the worked example in Cloudinary's docs (secret `abcd` gives `bfd09f95f331f558cbd1320e67aa8d488770583e`).
- `providerFileId` build/parse round trip, resource-type mapping, and that the longest allowed value fits `File.providerFileId` (VARCHAR 191).
- `frontend`: `npm run build` passes (including the queue changes to the API Keys page).

4. **Sync for Cloudinary and S3** (`POST /connected-accounts/:id/sync-files`, plus automatic background sync when an account is first connected; the per-account Sync button in Settings and Quota Tracker calls it). Details in `CLAUDE.md` ("Sync for Cloudinary and S3") and the README section "Syncing existing files". Pure parts (diff, mappings, MIME map) are unit-checked; the Cloudinary listing endpoint and its 500 requests/hour limit are confirmed from Cloudinary's docs, but nothing has run against a real account or database.

### S3 bugs fixed (inherited from 9Drive)

- `POST /connected-accounts/s3` no longer requires a saved Google config (`providerConfigId` is nullable and only Google code uses it) and no longer returns the encrypted token fields.
- Deleting a folder now deletes S3 and Cloudinary objects too (it used the Google client for every file, failed silently, and left orphaned objects) and re-syncs quota with the right provider. Not yet exercised against real storage.

### NOT verified (do this first)

The authoring sandbox could not download Prisma engines, so these never ran:

- [ ] `cd backend && npx prisma validate && npx prisma generate`
- [ ] `cd backend && npm run build` (type-check). Errors seen before generating the client were all cascades from missing Prisma types, none in the new code, but this needs a clean confirmation.
- [ ] `npx prisma migrate deploy` against a real MySQL; confirm table `cloudinary_configs` exists.
- [ ] Against a real Cloudinary account (free is fine): connect the account, upload an image, a video and a PDF, open the public URL from `view-url`, download via the app, zip-download, move to Trash, permanently delete (asset must disappear in Cloudinary), and check that quota and "used" update.
- [ ] S3 public URL against a real bucket: connect one with and without `publicBaseUrl`, upload an image, take `mediaUrl` from `GET /api/v1/files` and run `curl -I` on it (must be 200). Confirm the URL shape for each service the owner uses (AWS, R2, MinIO, Wasabi, B2). The URL builder itself is unit-checked, but nothing proves a given bucket is public.
- [ ] Queue API against a real DB: create a key with the three queue scopes, `POST /queue` with a Cloudinary file id, `POST /queue/claim` twice in parallel (only one call may get the item), `PATCH` it to `posted` and to `failed`, `PATCH` to `pending` to retry, and check a future `scheduledAt` is skipped. Also check 422 `FILE_NOT_PUBLIC` for a Drive/S3 file and that a key without the scope gets 403.
- [ ] Backend type-check cannot see `prisma.queueItem` until the Prisma client is generated, so TypeScript has not really checked the queue and files routes yet. Run `npm run build` after `prisma generate`.
- [ ] Sync: put a few files by hand into a Cloudinary account's folder and an S3 prefix (some with unusual extensions), connect each account and wait: they must appear in All Files with sensible names and types and the right sizes. Upload a file through the app and sync again: no duplicate row. Move a file to Trash, sync: it stays in Trash. Delete a file at the source, sync: it is marked deleted. Press Sync twice quickly: the second returns 409. Watch the Cloudinary `X-FeatureRateLimit-Remaining` header on a large account.
- [ ] Failed initial sync is only logged (`console.error`) and recorded nowhere else, so check the backend log if a freshly connected account shows no files, then press Sync.
- [ ] S3 fixes: connect an S3 bucket on an install with **no** Google credentials saved (must succeed, and the response must not contain `accessTokenEncrypted`); create a folder, upload an S3 and a Cloudinary file into it, delete the folder, and confirm both objects are gone from the buckets.
- [ ] Connect two accounts and confirm routing (most available, round robin, priority) alternates between them.

If anything fails, the most likely suspects are the multipart upload in `uploadCloudinaryObject` and the Usage API field `storage.usage` (documented as bytes, but the response shape was confirmed from a third-party article, not Cloudinary's reference).

## Known caveats

- **No byte limit from Cloudinary.** Plans are credit-based, so the limit is the user-entered `quotaBytes` (empty means unlimited). Used bytes is `max(Usage API, sum of this app's file rows)` because the API can lag.
- **Free-plan limits.** Per-file size caps apply (see `media_limits` in the Usage API response), and PDF/ZIP/raw delivery can be blocked until enabled in Cloudinary's security settings. The delivery error message already hints at this.
- **Sync cannot see Cloudinary dynamic-folder-only assets** (matching is by public ID prefix) and skips ids longer than 191 characters.
- **Whole file is buffered in memory** before upload (same as the S3 and Drive paths). Large files and Cloudinary's chunked upload are not handled.
- **Only public `upload`-type delivery** is supported. Private or authenticated assets are not.

## Plan (next steps, in order)

1. **Verify** everything in "NOT verified" above, then fix what breaks.
2. **Content queue with an HTTP API.** Built (see "Done" item 3). Remaining:
   - A dashboard page to view and manage queue items (list, filter by status and target, retry failed, delete, add from All Files).
   - Wire the real consumer (for example the Hermes Agent harness with Repliz): a worker that claims an item, posts `file.mediaUrl`, then reports `posted` with the external post id or `failed` with the error. The owner prefers plain HTTP over MCP.
   - Check whether the consumer needs a file extension in the media URL (image/video URLs include it; raw files do not).
3. **Dashboard.** The dashboard is this app itself; no separate project is needed. The queue lives in this repository.
4. **Hosting.** Open question: a cheap host (Vercel was mentioned). Note that this app needs a long-running Node process and MySQL, which does not map cleanly onto serverless; decide before investing in it.
5. **Branding leftovers** (needs owner decisions): replace the "9" glyph logo and PWA icons, regenerate README cover/trailer/screenshots, update README links that still point at the upstream project (live preview, star history, `git clone` URL), consider renaming the GitHub repository.
6. **Optional hardening:** stream uploads instead of buffering, add Cloudinary chunked upload for large video, support private assets, add a Cloudinary-specific smoke script like `backend/src/scripts/test-s3-connection.ts`.

## Conventions to keep

- Follow `AGENTS.md`: small targeted changes, no new dependencies unless necessary, never commit secrets, schema changes only through Prisma migrations.
- Backend is ESM with `module: NodeNext`: relative imports need a `.js` suffix.
- Verify with `cd backend && npm run build` and `cd frontend && npm run build`.
- Do not rename the `9drive` Drive folder or S3 prefix without a migration plan: sync and existing files depend on it.

## Where things are

| Area | Location |
| --- | --- |
| Cloudinary service and helpers | `backend/src/modules/cloudinary/` |
| Provider branching points | `uploads/upload.routes.ts` (`selectAccount`, `handleUpload`), `files/stream-file.ts`, `files/file.routes.ts`, `connected-accounts/connected-account.routes.ts` |
| Schema and migration | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261108120000_cloudinary_support/` |
| UI | `frontend/src/pages/SettingsPage.tsx`, `QuotaTrackerPage.tsx`, `AllFilesPage.tsx` |
