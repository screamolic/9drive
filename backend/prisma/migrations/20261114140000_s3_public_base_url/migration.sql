-- Add publicBaseUrl to s3_storage_configs so S3-compatible providers
-- (Cloudflare R2, MinIO, etc.) can expose a direct public URL per file.
ALTER TABLE `s3_storage_configs` ADD COLUMN `public_base_url` VARCHAR(512) NULL AFTER `prefix`;
