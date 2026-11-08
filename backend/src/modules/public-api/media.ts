import type { CloudinaryConfig, ConnectedAccount, File, S3StorageConfig } from '@prisma/client'
import { getCloudinaryDeliveryUrl } from '../cloudinary/cloudinary.service.js'
import { buildS3PublicUrl } from '../s3/s3.utils.js'

export const fileWithMediaInclude = { connectedAccount: { include: { cloudinaryConfig: true, s3StorageConfig: true } } } as const

export type FileWithMedia = File & {
  connectedAccount: ConnectedAccount & { cloudinaryConfig: CloudinaryConfig | null; s3StorageConfig: S3StorageConfig | null }
}

export function mediaTypeOf(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

// URL an external service can fetch directly. Cloudinary and S3 files have one; Google Drive files do not.
// For S3 the URL is built from the config, so it only works if the bucket (or public base URL) allows public reads.
export function fileMediaUrl(file: FileWithMedia) {
  const { cloudinaryConfig, s3StorageConfig } = file.connectedAccount
  if (file.provider === 'cloudinary' && cloudinaryConfig) return getCloudinaryDeliveryUrl(cloudinaryConfig, file.providerFileId)
  if (file.provider === 's3' && s3StorageConfig) return buildS3PublicUrl(s3StorageConfig, file.providerFileId)
  return null
}

export function serializePublicFile(file: FileWithMedia) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    mediaType: mediaTypeOf(file.mimeType),
    sizeBytes: file.sizeBytes.toString(),
    provider: file.provider,
    mediaUrl: fileMediaUrl(file),
    createdAt: file.createdAt.toISOString(),
  }
}
