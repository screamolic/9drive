import { prisma } from '../../config/prisma.js'
import { fileMediaUrl, fileWithMediaInclude, mediaTypeOf, type FileWithMedia } from '../public-api/media.js'

// Shared by the API-key queue router (queue.routes.ts) and the dashboard router (queue-admin.routes.ts).

// An item stuck in `processing` for longer than this is handed out again by /claim.
export const CLAIM_TIMEOUT_MS = 15 * 60 * 1000
export const itemInclude = { file: { include: fileWithMediaInclude } } as const

export type ItemWithFile = Awaited<ReturnType<typeof loadItem>>

export function loadItem(id: string, userId: string) {
  return prisma.queueItem.findFirst({ where: { id, userId }, include: itemInclude })
}

export function serializeItem(item: NonNullable<ItemWithFile>) {
  const file = item.file as FileWithMedia
  const stuck = item.status === 'processing' && item.claimedAt !== null && Date.now() - item.claimedAt.getTime() > CLAIM_TIMEOUT_MS
  return {
    id: item.id,
    fileId: item.fileId,
    target: item.target,
    caption: item.caption,
    status: item.status,
    // true when a worker claimed the item but never reported back; /claim will offer it again.
    stuck,
    scheduledAt: item.scheduledAt?.toISOString() ?? null,
    claimedAt: item.claimedAt?.toISOString() ?? null,
    postedAt: item.postedAt?.toISOString() ?? null,
    attempts: item.attempts,
    lastError: item.lastError,
    externalId: item.externalId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    file: {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      mediaType: mediaTypeOf(file.mimeType),
      sizeBytes: file.sizeBytes.toString(),
      provider: file.provider,
      status: file.status,
      mediaUrl: fileMediaUrl(file),
    },
  }
}
