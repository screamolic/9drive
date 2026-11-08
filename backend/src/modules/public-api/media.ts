import type { CloudinaryConfig, ConnectedAccount, File } from '@prisma/client'
import { getCloudinaryDeliveryUrl } from '../cloudinary/cloudinary.service.js'

export const fileWithMediaInclude = { connectedAccount: { include: { cloudinaryConfig: true } } } as const

export type FileWithMedia = File & { connectedAccount: ConnectedAccount & { cloudinaryConfig: CloudinaryConfig | null } }

export function mediaTypeOf(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

// Only Cloudinary files have a stable public URL that an external service can fetch.
export function fileMediaUrl(file: FileWithMedia) {
  const config = file.connectedAccount.cloudinaryConfig
  if (file.provider !== 'cloudinary' || !config) return null
  return getCloudinaryDeliveryUrl(config, file.providerFileId)
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
