# Multinary Upload API

Dokumentasi penggunaan API eksternal Multinary untuk mengunggah file dari skrip, aplikasi lain, atau CI.

> **Catatan:** Backend hanya mendukung provider penyimpanan berbasis file dengan direct link publik: **S3-compatible** (AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2) dan **Cloudinary**. Provider lain (mis. Google Drive) tidak didukung lagi.

---

## 1. Base URL

```
https://<host-backend-anda>
```

Contoh lokal: `http://localhost:4000`

Semua endpoint publik berada di bawah prefix `/api/v1`.

---

## 2. Autentikasi

Setiap request harus menyertakan **API key** pada header `Authorization`:

```
Authorization: Bearer <API_KEY>
```

- API key dibuat di dashboard: **API Management → Create API Key**.
- Key ditampilkan **hanya sekali** saat pembuatan — salin dan simpan dengan aman.
- Di database, key disimpan sebagai hash; prefix (mis. `9d_live_ab12…`) dipakai untuk identifikasi di dashboard.
- Key yang sudah di-revoke atau melewati masa kedaluwarsa (`expiresAt`) akan ditolak.

### Scopes

Saat membuat key Anda memilih scope. Endpoint upload membutuhkan scope:

| Scope | Izin |
|---|---|
| `files:upload` | Mengunggah file via `POST /api/v1/uploads` |

Key tanpa scope ini akan menerima respons `403 API_KEY_FORBIDDEN`.

---

## 3. Endpoint: Upload File

```
POST /api/v1/uploads
Content-Type: multipart/form-data
```

File diarahkan otomatis ke salah satu akun connected (routing policy global: *most available space*, *round-robin*, atau *priority*), sama seperti upload dari dashboard.

### Field form-data

| Field | Wajib | Keterangan |
|---|---|---|
| `filesMeta` | Ya (untuk batch) | JSON array berisi metadata tiap file: `fieldName`, `fileName`, `mimeType`, `sizeBytes`, opsional `folderId`. |
| `<fieldName>` | Ya | Part binary file, nama field harus cocok dengan `fieldName` di metadata. Contoh: `file-0=@hello.txt;type=text/plain` |
| `folderId` | Tidak | Field tunggal (alternatif per-file di `filesMeta`). ID folder virtual milik Anda tempat file disimpan. Kosong = root. |

> Untuk **satu file**, backend juga menerima mode non-batch: part file tunggal + field `fileName`, `mimeType`, `sizeBytes`, `folderId` sebagai form fields biasa. Format `filesMeta` di bawah selalu aman dipakai.

### Respons sukses — `201 Created`

Satu file (mode non-batch):

```json
{ "file": { "id": "...", "name": "hello.txt", "provider": "cloudinary", "providerFileId": "...", "sizeBytes": "12", "status": "active" } }
```

Batch (via `filesMeta`):

```json
{
  "files": [ { "id": "...", "name": "a.png", "provider": "s3", "status": "active" } ],
  "failed":  [ { "fileName": "b.bin", "code": "UNSUPPORTED_PROVIDER", "message": "..." } ]
}
```

Field penting pada objek file: `id` (ID internal), `provider` (`s3`/`cloudinary`), `providerFileId` (object key / public id), `sizeBytes` (string), `status`.

### Kode error

| HTTP | Code | Penyebab |
|---|---|---|
| 401 | `API_KEY_REQUIRED` | Header `Authorization: Bearer …` tidak ada. |
| 401 | `API_KEY_INVALID` | Key tidak dikenal, sudah revoke, atau kedaluwarsa. |
| 403 | `API_KEY_FORBIDDEN` | Key tidak punya scope `files:upload`. |
| 400 | — | Metadata invalid (mis. `filesMeta` tidak dapat diparse, ukuran melebihi batas). |
| 503 / per-file failed | `NO_CONNECTED_ACCOUNT` / `UNSUPPORTED_PROVIDER` | Belum ada akun storage terhubung, atau akun memakai provider non-file. |

---

## 4. Contoh Penggunaan

### cURL (satu file)

```bash
curl -X POST "https://api.example.com/api/v1/uploads" \
  -H "Authorization: Bearer 9d_live_xxx" \
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \
  -F "file-0=@hello.txt;type=text/plain"
```

### cURL (batch + folder tujuan)

```bash
curl -X POST "https://api.example.com/api/v1/uploads" \
  -H "Authorization: Bearer 9d_live_xxx" \
  -F 'filesMeta=[
    {"fieldName":"file-0","fileName":"photo.jpg","mimeType":"image/jpeg","sizeBytes":"204800","folderId":"clxyz123"},
    {"fieldName":"file-1","fileName":"doc.pdf","mimeType":"application/pdf","sizeBytes":"10240"}
  ]' \
  -F "file-0=@photo.jpg;type=image/jpeg" \
  -F "file-1=@doc.pdf;type=application/pdf"
```

### JavaScript (browser / Node 18+)

```js
const form = new FormData()
form.append('filesMeta', JSON.stringify([
  { fieldName: 'file-0', fileName: file.name, mimeType: file.type, sizeBytes: String(file.size) },
]))
form.append('file-0', file)

const res = await fetch(`${API_URL}/api/v1/uploads`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}` }, // jangan kirim header Content-Type — FormData yang mengatur boundary
  body: form,
})
const data = await res.json()
console.log(data.files ?? data.file)
```

### Python (requests)

```python
import requests, os

API = "https://api.example.com"
f = open("report.pdf", "rb")
meta = [{"fieldName": "file-0", "fileName": "report.pdf",
         "mimeType": "application/pdf", "sizeBytes": str(os.path.getsize("report.pdf"))}]

res = requests.post(
    f"{API}/api/v1/uploads",
    headers={"Authorization": "Bearer 9d_live_xxx"},
    files={"file-0": ("report.pdf", f, "application/pdf")},
    data={"filesMeta": __import__("json").dumps(meta)},
)
print(res.status_code, res.json())
```

---

## 5. Direct Link Hasil Upload

Karena semua provider yang didukung bersifat public/direct-file:

- **Cloudinary:** `https://res.cloudinary.com/<cloudName>/upload/<providerFileId>`
- **S3-compatible:** `https://<bucket>.s3.<region>.amazonaws.com/<providerFileId>` (atau `<endpoint>/<bucket>/<key>` untuk R2/MinIO/dll., jika bucket/policy mengizinkan akses publik).

Anda juga bisa mengambil URL lewat dashboard (ikon *get link* pada detail file).

---

## 6. Dokumentasi In-App

Halaman **API Management** di dashboard menampilkan ringkasan endpoint, contoh cURL & JavaScript, serta tombol copy — berguna sebagai referensi cepat tanpa membuka dokumen ini.

---

## 7. Batas & Catatan

- Ukuran part dibatasi konfigurasi multer/backend; file besar sebaiknya dipecah di sisi klien.
- Routing provider mengikuti kebijakan global di **Settings → Storage routing**. Pemilihan akun target spesifik (`targetAccountId`) saat ini hanya tersedia untuk upload dari dashboard, belum diekspos lewat API publik.
- Setiap upload tercatat pada audit log dan kuota akun terkait ikut disinkronkan secara asinkron.
