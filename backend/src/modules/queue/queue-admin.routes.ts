import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { createAuditLog } from '../../utils/audit.js'
import { fileMediaUrl, fileWithMediaInclude } from '../public-api/media.js'
import { itemInclude, loadItem, serializeItem } from './queue.shared.js'

// Dashboard side of the content queue, driven by the logged-in user (JWT).
// The API-key router (queue.routes.ts) is what external workers use; both operate on the same QueueItem rows.
export const queueAdminRouter = Router()
queueAdminRouter.use(requireAuth)

const statuses = ['pending', 'processing', 'posted', 'failed'] as const
const targetSchema = z.string().trim().min(1).max(191)
const MAX_BULK = 1000
const MAX_SPREAD_MINUTES = 7 * 24 * 60

const listSchema = z.object({
  status: z.enum(statuses).optional(),
  target: targetSchema.optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['created_asc', 'created_desc', 'scheduled_asc', 'updated_desc']).default('created_asc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
const createSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(200),
  target: targetSchema.nullable().optional(),
  caption: z.string().max(10000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  // Stagger: item N is scheduled N x spreadMinutes after the first one (the first is `scheduledAt`, or now).
  spreadMinutes: z.number().int().min(0).max(MAX_SPREAD_MINUTES).default(0),
})
const updateSchema = z.object({
  target: targetSchema.nullable().optional(),
  caption: z.string().max(10000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})
const bulkSchema = z.object({
  action: z.enum(['retry', 'requeue', 'release', 'delete', 'setTarget', 'reschedule']),
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK).optional(),
  // Alternative to ids: act on everything matching these filters.
  filter: z.object({ status: z.enum(statuses).optional(), target: targetSchema.optional() }).optional(),
  target: targetSchema.nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  spreadMinutes: z.number().int().min(0).max(MAX_SPREAD_MINUTES).default(0),
}).refine((value) => value.ids || value.filter, { message: 'Provide ids or filter.' })

const orderBys = {
  created_asc: { createdAt: 'asc' },
  created_desc: { createdAt: 'desc' },
  scheduled_asc: { scheduledAt: 'asc' },
  updated_desc: { updatedAt: 'desc' },
} as const

// GET /content-queue?status=&target=&q=&sort=&limit=&offset=
// Also returns `counts` per status and the distinct `targets`, both for the whole queue (ignoring filters), for the page header and filter chips.
queueAdminRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const query = listSchema.parse(req.query)
    const userId = req.user!.id
    const where = {
      userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.target ? { target: query.target } : {}),
      ...(query.q ? { OR: [{ caption: { contains: query.q } }, { file: { name: { contains: query.q } } }] } : {}),
    }
    const [items, total, grouped, targetRows, staleCount] = await Promise.all([
      prisma.queueItem.findMany({ where, include: itemInclude, orderBy: orderBys[query.sort], take: query.limit, skip: query.offset }),
      prisma.queueItem.count({ where }),
      prisma.queueItem.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      prisma.queueItem.groupBy({ by: ['target'], where: { userId, target: { not: null } }, _count: { _all: true } }),
      prisma.queueItem.count({ where: { userId, status: 'processing', claimedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } } }),
    ])
    const counts: Record<string, number> = { pending: 0, processing: 0, posted: 0, failed: 0 }
    for (const row of grouped) counts[row.status] = row._count._all
    const targets = targetRows.flatMap((row) => (row.target ? [{ name: row.target, count: row._count._all }] : []))
    return res.json({ items: items.map(serializeItem), total, limit: query.limit, offset: query.offset, counts: { ...counts, stuck: staleCount }, targets })
  } catch (error) {
    return next(error)
  }
})

// POST /content-queue : add many files at once.
// Files that cannot be queued (not found, no public URL) or are already waiting for the same target are skipped and reported, not treated as errors.
queueAdminRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body)
    const userId = req.user!.id
    const target = body.target ?? null
    const uniqueIds = [...new Set(body.fileIds)]

    const [files, open] = await Promise.all([
      prisma.file.findMany({ where: { id: { in: uniqueIds }, userId, status: 'active', deletedAt: null }, include: fileWithMediaInclude }),
      prisma.queueItem.findMany({ where: { userId, fileId: { in: uniqueIds }, target, status: { in: ['pending', 'processing'] } }, select: { fileId: true } }),
    ])
    const byId = new Map(files.map((file) => [file.id, file]))
    const alreadyQueued = new Set(open.map((row) => row.fileId))

    const skipped: { fileId: string; reason: 'FILE_NOT_FOUND' | 'FILE_NOT_PUBLIC' | 'ALREADY_QUEUED' }[] = []
    const accepted: string[] = []
    for (const fileId of uniqueIds) {
      const file = byId.get(fileId)
      if (!file) skipped.push({ fileId, reason: 'FILE_NOT_FOUND' })
      else if (!fileMediaUrl(file)) skipped.push({ fileId, reason: 'FILE_NOT_PUBLIC' })
      else if (alreadyQueued.has(fileId)) skipped.push({ fileId, reason: 'ALREADY_QUEUED' })
      else accepted.push(fileId)
    }

    const base = body.scheduledAt ? new Date(body.scheduledAt) : body.spreadMinutes > 0 ? new Date() : null
    // Rows get distinct createdAt values (1 ms apart) so the claim order (oldest first) matches the order the user picked.
    const startedAt = Date.now()
    const created = await prisma.$transaction(
      accepted.map((fileId, index) =>
        prisma.queueItem.create({
          data: {
            userId,
            fileId,
            target,
            caption: body.caption ?? null,
            scheduledAt: base ? new Date(base.getTime() + index * body.spreadMinutes * 60_000) : null,
            createdAt: new Date(startedAt + index),
          },
          select: { id: true },
        }),
      ),
    )
    if (created.length > 0) await createAuditLog(userId, 'queue.add', 'queue', undefined, { count: created.length, target })
    return res.status(201).json({ created: created.length, skipped })
  } catch (error) {
    return next(error)
  }
})

// PATCH /content-queue/:id : edit target, caption or schedule. Only while the item is not being processed or already posted.
queueAdminRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const body = updateSchema.parse(req.body)
    const userId = req.user!.id
    const existing = await loadItem(String(req.params.id), userId)
    if (!existing) return res.status(404).json({ code: 'QUEUE_ITEM_NOT_FOUND', message: 'Queue item not found.' })
    if (existing.status !== 'pending' && existing.status !== 'failed') {
      return res.status(409).json({ code: 'QUEUE_ITEM_LOCKED', message: `A ${existing.status} item cannot be edited. Release or re-queue it first.` })
    }
    await prisma.queueItem.update({
      where: { id: existing.id },
      data: {
        ...(body.target !== undefined ? { target: body.target } : {}),
        ...(body.caption !== undefined ? { caption: body.caption } : {}),
        ...(body.scheduledAt !== undefined ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null } : {}),
      },
    })
    const item = await loadItem(existing.id, userId)
    return res.json({ item: serializeItem(item!) })
  } catch (error) {
    return next(error)
  }
})

// DELETE /content-queue/:id
queueAdminRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const removed = await prisma.queueItem.deleteMany({ where: { id: String(req.params.id), userId: req.user!.id } })
    if (removed.count === 0) return res.status(404).json({ code: 'QUEUE_ITEM_NOT_FOUND', message: 'Queue item not found.' })
    return res.json({ status: 'ok' })
  } catch (error) {
    return next(error)
  }
})

// POST /content-queue/bulk : one action on many items, chosen by ids or by filter.
//   retry      failed -> pending
//   requeue    posted -> pending (post it again)
//   release    processing -> pending (take back an item a worker claimed and never finished)
//   delete     any status
//   setTarget  pending/failed: set or clear the target label
//   reschedule pending/failed: set the schedule, optionally staggered by spreadMinutes in the current queue order
// `affected` counts only the items the action applied to; items in another status are left alone.
queueAdminRouter.post('/bulk', async (req: AuthRequest, res, next) => {
  try {
    const body = bulkSchema.parse(req.body)
    const userId = req.user!.id
    const scope = body.ids
      ? { userId, id: { in: body.ids } }
      : { userId, ...(body.filter?.status ? { status: body.filter.status } : {}), ...(body.filter?.target ? { target: body.filter.target } : {}) }

    const resetFields = { claimedAt: null, postedAt: null }
    let affected = 0

    if (body.action === 'delete') {
      affected = (await prisma.queueItem.deleteMany({ where: scope })).count
    } else if (body.action === 'retry') {
      affected = (await prisma.queueItem.updateMany({ where: { ...scope, status: 'failed' }, data: { status: 'pending', lastError: null, ...resetFields } })).count
    } else if (body.action === 'requeue') {
      affected = (await prisma.queueItem.updateMany({ where: { ...scope, status: 'posted' }, data: { status: 'pending', lastError: null, externalId: null, ...resetFields } })).count
    } else if (body.action === 'release') {
      affected = (await prisma.queueItem.updateMany({ where: { ...scope, status: 'processing' }, data: { status: 'pending', ...resetFields } })).count
    } else if (body.action === 'setTarget') {
      if (body.target === undefined) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'setTarget needs a target (or null to clear it).' })
      affected = (await prisma.queueItem.updateMany({ where: { ...scope, status: { in: ['pending', 'failed'] } }, data: { target: body.target } })).count
    } else {
      if (body.scheduledAt === undefined) return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'reschedule needs scheduledAt (or null to clear it).' })
      const rows = await prisma.queueItem.findMany({ where: { ...scope, status: { in: ['pending', 'failed'] } }, orderBy: { createdAt: 'asc' }, select: { id: true } })
      const base = body.scheduledAt ? new Date(body.scheduledAt) : null
      await prisma.$transaction(
        rows.map((row, index) =>
          prisma.queueItem.update({
            where: { id: row.id },
            data: { scheduledAt: base ? new Date(base.getTime() + index * body.spreadMinutes * 60_000) : null },
          }),
        ),
      )
      affected = rows.length
    }

    if (affected > 0) await createAuditLog(userId, `queue.${body.action}`, 'queue', undefined, { affected })
    return res.json({ affected })
  } catch (error) {
    return next(error)
  }
})
