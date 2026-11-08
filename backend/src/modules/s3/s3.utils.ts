type S3PublicUrlConfig = { bucket: string; region: string; endpoint: string | null; publicBaseUrl: string | null }

function encodeKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/')
}

// Public URL an external service can fetch, assuming the bucket/object allows public reads.
// 1. `publicBaseUrl` (custom domain, CDN, Cloudflare R2 public bucket URL): <base>/<key>
// 2. No endpoint (AWS S3): virtual-hosted style https://<bucket>.s3.<region>.amazonaws.com/<key>
// 3. Custom endpoint (MinIO, Wasabi, Backblaze B2 ...): path style <endpoint>/<bucket>/<key>
// Note: the S3 API endpoint of Cloudflare R2 is NOT publicly readable; R2 needs `publicBaseUrl`.
export function buildS3PublicUrl(config: S3PublicUrlConfig, key: string) {
  const encoded = encodeKey(key)
  if (config.publicBaseUrl) return `${config.publicBaseUrl.replace(/\/+$/, '')}/${encoded}`
  if (!config.endpoint) return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encoded}`
  return `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${encoded}`
}
