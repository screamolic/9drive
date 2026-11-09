import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireApiKey, type ApiKeyRequest } from '../../middleware/api-key.middleware.js'
import { fileMediaUrl, fileWithMediaInclude } from '../public-api/media.js'
import { CLAIM_TIMEOUT_MS, itemInclude, loadItem, serializeItem } from './queue.shared.js'

// Content queue for external automation (for example a social media scheduler), driven by API key.
// Lifecycle: pending -> processing (claimed) -> posted | failed. A failed item can be set back to pending to retry.
// An item stuck in `processing` for longer than CLAIM_TIMEOUT_MS is handed out again by /claim.
export const queueRouter = Router()


const targetSchema = z.string().trim().min(1).max(191)
const createSchema = z.object({
  fileId: z.string().uuid(),
  target: targetSchema.nullable().optional(),
  caption: z.string().max(10000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})
const listSchema = z.object({
  status: z.enum(['pending', 'processing', 'posted', 'failed']).optional(),
  target: targetSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
const claimSchema = z.object({ target: targetSchema.optional() })
const updateSchema = z.object({
  status: z.enum(['pending', 'posted', 'failed']).optional(),
  externalId: z.string().trim().max(191).nullable().optional(),
  error: z.string().max(10000).nullable().optional(),
  target: targetSchema.nullable().optional(),
  caption: z.string().max(10000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

// POST /api/v1/queue : add a file to the queue.
queueRouter.post('/', requireApiKey('queue:write'), async (req: ApiKeyRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body)
    const file = await prisma.file.findFirst({ where: { id: body.fileId, userId: req.user!.id, status: 'active', deletedAt: null }, include: fileWithMediaInclude })
    if (!file) return res.status(404).json({ code: 'FILE_NOT_FOUND', message: 'File not found.' })
    if (!fileMediaUrl(file)) return res.status(422).json({ code: 'FILE_NOT_PUBLIC', message: 'This file has no public media URL. Only files stored on Cloudinary or S3 can be queued; Google Drive files cannot.' })
    const item = await prisma.queueItem.create({
      data: {
        userId: req.user!.id,
        fileId: file.id,
        target: body.target ?? null,
        caption: body.caption ?? null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
      include: itemInclude,
    })
    return res.status(201).json({ item: serializeItem(item) })
  } catch (error) {
    return next(error)
  }
})

// GET /api/v1/queue?status=&target=&limit=&offset=
queueRouter.get('/', requireApiKey('queue:read'), async (req: ApiKeyRequest, res, next) => {
  try {
    const query = listSchema.parse(req.query)
    const where = { userId: req.user!.id, ...(query.status ? { status: query.status } : {}), ...(query.target ? { target: query.target } : {}) }
    const [items, total] = await Promise.all([
      prisma.queueItem.findMany({ where, include: itemInclude, orderBy: { createdAt: 'asc' }, take: query.limit, skip: query.offset }),
      prisma.queueItem.count({ where }),
    ])
    return res.json({ items: items.map(serializeItem), total, limit: query.limit, offset: query.offset })
  } catch (error) {
    return next(error)
  }
})

// POST /api/v1/queue/claim : take the oldest item that is due, mark it `processing`, return it (or `item: null`).
// Safe to call from several workers: each item is handed to one caller only.
queueRouter.post('/claim', requireApiKey('queue:write'), async (req: ApiKeyRequest, res, next) => {
  try {
    const { target } = claimSchema.parse(req.body ?? {})
    const userId = req.user!.id
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const now = new Date()
      const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS)
      const candidate = await prisma.queueItem.findFirst({
        where: {
          userId,
          ...(target ? { target } : {}),
          file: { status: 'active', deletedAt: null },
          OR: [
            { status: 'pending', OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
            { status: 'processing', claimedAt: { lt: staleBefore } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      })
      if (!candidate) return res.json({ item: null })
      // Optimistic lock: only succeeds if nobody changed the row since we read it.
      const claimed = await prisma.queueItem.updateMany({
        where: { id: candidate.id, status: candidate.status, updatedAt: candidate.updatedAt },
        data: { status: 'processing', claimedAt: now, attempts: { increment: 1 } },
      })
      if (claimed.count === 1) {
        const item = await loadItem(candidate.id, userId)
        return res.json({ item: item ? serializeItem(item) : null })
      }
    }
    return res.json({ item: null })
  } catch (error) {
    return next(error)
  }
})

// GET /api/v1/queue/:id
queueRouter.get('/:id', requireApiKey('queue:read'), async (req: ApiKeyRequest, res, next) => {
  try {
    const item = await loadItem(String(req.params.id), req.user!.id)
    if (!item) return res.status(404).json({ code: 'QUEUE_ITEM_NOT_FOUND', message: 'Queue item not found.' })
    return res.json({ item: serializeItem(item) })
  } catch (error) {
    return next(error)
  }
})

// PATCH /api/v1/queue/:id : report the result (posted / failed) or edit / re-queue (pending).
queueRouter.patch('/:id', requireApiKey('queue:write'), async (req: ApiKeyRequest, res, next) => {
  try {
    const body = updateSchema.parse(req.body)
    const existing = await loadItem(String(req.params.id), req.user!.id)
    if (!existing) return res.status(404).json({ code: 'QUEUE_ITEM_NOT_FOUND', message: 'Queue item not found.' })

    const data: Record<string, unknown> = {}
    if (body.target !== undefined) data.target = body.target
    if (body.caption !== undefined) data.caption = body.caption
    if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
    if (body.externalId !== undefined) data.externalId = body.externalId
    if (body.status === 'posted') {
      data.status = 'posted'
      data.postedAt = new Date()
      data.lastError = null
    } else if (body.status === 'failed') {
      data.status = 'failed'
      data.lastError = body.error ?? 'Unknown error'
    } else if (body.status === 'pending') {
      data.status = 'pending'
      data.claimedAt = null
      data.postedAt = null
    }
    if (body.status === undefined && body.error !== undefined) data.lastError = body.error

    await prisma.queueItem.update({ where: { id: existing.id }, data })
    const item = await loadItem(existing.id, req.user!.id)
    return res.json({ item: serializeItem(item!) })
  } catch (error) {
    return next(error)
  }
})

// DELETE /api/v1/queue/:id
queueRouter.delete('/:id', requireApiKey('queue:write'), async (req: ApiKeyRequest, res, next) => {
  try {
    const removed = await prisma.queueItem.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } })
    if (removed.count === 0) return res.status(404).json({ code: 'QUEUE_ITEM_NOT_FOUND', message: 'Queue item not found.' })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})
