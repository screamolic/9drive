import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { requireApiKey, type ApiKeyRequest } from '../../middleware/api-key.middleware.js'
import { fileWithMediaInclude, serializePublicFile } from './media.js'

export const publicFilesRouter = Router()

const listSchema = z.object({
  q: z.string().trim().min(1).max(191).optional(),
  type: z.enum(['image', 'video', 'audio']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// GET /api/v1/files : active files with their public media URL (Cloudinary and S3 files; Google Drive files have none).
publicFilesRouter.get('/', requireApiKey('files:read'), async (req: ApiKeyRequest, res, next) => {
  try {
    const query = listSchema.parse(req.query)
    const where = {
      userId: req.user!.id,
      status: 'active',
      deletedAt: null,
      ...(query.q ? { name: { contains: query.q } } : {}),
      ...(query.type ? { mimeType: { startsWith: `${query.type}/` } } : {}),
    }
    const [files, total] = await Promise.all([
      prisma.file.findMany({ where, include: fileWithMediaInclude, orderBy: { createdAt: 'desc' }, take: query.limit, skip: query.offset }),
      prisma.file.count({ where }),
    ])
    return res.json({ files: files.map(serializePublicFile), total, limit: query.limit, offset: query.offset })
  } catch (error) {
    return next(error)
  }
})

// GET /api/v1/files/:id
publicFilesRouter.get('/:id', requireApiKey('files:read'), async (req: ApiKeyRequest, res, next) => {
  try {
    const file = await prisma.file.findFirst({ where: { id: String(req.params.id), userId: req.user!.id, status: 'active', deletedAt: null }, include: fileWithMediaInclude })
    if (!file) return res.status(404).json({ code: 'FILE_NOT_FOUND', message: 'File not found.' })
    return res.json({ file: serializePublicFile(file) })
  } catch (error) {
    return next(error)
  }
})
