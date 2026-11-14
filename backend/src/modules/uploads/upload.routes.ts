import Busboy from 'busboy'
import type { NextFunction, Response } from 'express'
import { Router } from 'express'
import { Readable } from 'stream'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { prisma } from '../../config/prisma.js'
import { requireAuth, type AuthRequest } from '../../middleware/auth.middleware.js'
import { buildS3ObjectKey, getS3ConfigForAccount, syncS3Quota, uploadS3Object } from '../s3/s3.service.js'
import { buildCloudinaryPublicId, getCloudinaryConfigForAccount, syncCloudinaryQuota, uploadCloudinaryObject } from '../cloudinary/cloudinary.service.js'
import { createAuditLog } from '../../utils/audit.js'

export const uploadRouter = Router()

type UploadMeta = { fieldName: string; fileName: string; mimeType: string; sizeBytes: bigint; folderId?: string }
type RoutingMode = 'most_available' | 'round_robin' | 'priority'

function logUpload(message: string, metadata?: Record<string, unknown>) {
  console.info('[upload]', message, metadata ?? '')
}

function normalizePriorityAccountIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function byPriority<T extends { account: { id: string; createdAt: Date } }>(items: T[], priorityAccountIds: string[]) {
  const order = new Map(priorityAccountIds.map((id, index) => [id, index]))
  return [...items].sort((a, b) => {
    const aOrder = order.get(a.account.id)
    const bOrder = order.get(b.account.id)
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1
    return a.account.createdAt.getTime() - b.account.createdAt.getTime()
  })
}

async function selectAccount(userId: string, sizeBytes: bigint, reservedBytesByAccount = new Map<string, bigint>(), targetAccountId?: string | null) {
  const accounts = await prisma.connectedAccount.findMany({
    where: { userId, provider: { in: ['s3', 'cloudinary'] }, status: 'connected', ...(targetAccountId ? { id: targetAccountId } : {}) },
    include: { storageAccount: true },
  })

  const stale = accounts.filter((account) => !account.storageAccount?.lastSyncedAt || account.storageAccount.lastSyncedAt.getTime() < Date.now() - 5 * 60_000)
  await Promise.allSettled(stale.map(async (account) => {
    try {
      if (account.provider === 's3') {
        await syncS3Quota(account.id)
      } else {
        await syncCloudinaryQuota(account.id)
      }
    } catch (err: any) {
      console.error(`[upload] failed to sync quota for account ${account.email} (${account.id}):`, err.message || err)
      await prisma.connectedAccount.update({
        where: { id: account.id },
        data: { lastError: err.message || 'Quota sync failed' }
      }).catch(() => undefined)
    }
  }))

  const fresh = await prisma.connectedAccount.findMany({
    where: { userId, provider: { in: ['s3', 'cloudinary'] }, status: 'connected' },
    include: { storageAccount: true },
  })

  const eligible = fresh
    .map((account) => ({ account, availableBytes: account.storageAccount?.availableBytes === null || account.storageAccount?.availableBytes === undefined ? null : account.storageAccount.availableBytes - (reservedBytesByAccount.get(account.id) ?? 0n) }))
    .filter(({ availableBytes }) => availableBytes === null || availableBytes >= sizeBytes)

  if (eligible.length === 0) return null

  if (targetAccountId) {
    const target = eligible.find(e => e.account.id === targetAccountId)
    return target?.account ?? null
  }

  const policy = await prisma.uploadRoutingPolicy.upsert({ where: { userId }, create: { userId, mode: 'most_available', priorityAccountIds: [] }, update: {} })
  const mode = (['most_available', 'round_robin', 'priority'].includes(policy.mode) ? policy.mode : 'most_available') as RoutingMode
  const priorityAccountIds = normalizePriorityAccountIds(policy.priorityAccountIds)

  if (mode === 'priority') return byPriority(eligible, priorityAccountIds)[0]?.account ?? null

  if (mode === 'round_robin') {
    const ordered = byPriority(eligible, priorityAccountIds)
    const selected = ordered[policy.roundRobinCursor % ordered.length]?.account ?? ordered[0]?.account ?? null
    await prisma.uploadRoutingPolicy.update({ where: { userId }, data: { roundRobinCursor: policy.roundRobinCursor + 1 } })
    return selected
  }

  return eligible
    .sort((a, b) => {
      if (a.availableBytes === null && b.availableBytes === null) return -1
      if (a.availableBytes === null) return -1
      if (b.availableBytes === null) return 1
      return Number(b.availableBytes - a.availableBytes)
    })[0]?.account
}

export async function handleUpload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    logUpload('request started', { userId: req.user!.id, contentLength: req.headers['content-length'] })
    const contentType = req.headers['content-type']
    if (!contentType?.includes('multipart/form-data')) return res.status(400).json({ code: 'UPLOAD_INVALID_CONTENT_TYPE', message: 'multipart/form-data required.' })

    const busboy = Busboy({ headers: req.headers, limits: { files: 25, fileSize: env.MAX_UPLOAD_BYTES } })
    const fields: { sizeBytes?: bigint; fileName?: string; mimeType?: string; folderId?: string } = {}
    let batchMeta: UploadMeta[] | null = null
    let responded = false
    let fileSeen = false
    const reservedBytesByAccount = new Map<string, bigint>()
    const completed: Array<Record<string, unknown>> = []
    const failed: Array<{ fileName: string; code: string; message: string }> = []
    const pendingUploads: Array<Promise<void>> = []

    const fail = async (status: number, code: string, message: string) => {
      if (responded) return
      responded = true
      req.unpipe(busboy)
      req.resume()
      return res.status(status).json({ code, message })
    }

    const parseBatchMeta = (value: string) => JSON.parse(value).map((item: { fieldName: string; fileName: string; mimeType: string; sizeBytes: string | number; folderId?: string }) => ({
      fieldName: item.fieldName,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: BigInt(item.sizeBytes),
      folderId: item.folderId,
    })) as UploadMeta[]

    const metaForFile = (fieldName: string, info: { filename: string; mimeType: string }) => {
      if (batchMeta) return batchMeta.find((item) => item.fieldName === fieldName)
      const sizeBytes = fields.sizeBytes
      if (!sizeBytes) return null
      return { fieldName, sizeBytes, fileName: fields.fileName || info.filename, mimeType: fields.mimeType || info.mimeType || 'application/octet-stream', folderId: fields.folderId }
    }

    const uploadOne = async (fieldName: string, fileStream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
      const meta = metaForFile(fieldName, info)
      const fileName = meta?.fileName || info.filename
      try {
        fileStream.on('limit', () => logUpload('file stream size limit reached', { fileName }))
        if (!meta?.sizeBytes || meta.sizeBytes <= 0n) {
          fileStream.resume()
          failed.push({ fileName, code: 'UPLOAD_SIZE_REQUIRED', message: 'sizeBytes field must be sent before file field.' })
          return
        }
        if (meta.sizeBytes > BigInt(env.MAX_UPLOAD_BYTES)) {
          fileStream.resume()
          failed.push({ fileName, code: 'UPLOAD_TOO_LARGE', message: 'File exceeds max upload size.' })
          return
        }

        const folderId = meta.folderId || null
        let targetAccountId: string | undefined = undefined
        if (folderId) {
          const folderRecord = await prisma.folder.findFirstOrThrow({ where: { id: folderId, userId: req.user!.id, deletedAt: null } })
          if (folderRecord.connectedAccountId) {
            targetAccountId = folderRecord.connectedAccountId
          }
        }

        const account = await selectAccount(req.user!.id, meta.sizeBytes, reservedBytesByAccount, targetAccountId)
        if (!account) {
          fileStream.resume()
          failed.push({ fileName, code: 'NO_ACCOUNT_WITH_ENOUGH_SPACE', message: 'No connected storage account has enough space for this upload.' })
          return
        }
        reservedBytesByAccount.set(account.id, (reservedBytesByAccount.get(account.id) ?? 0n) + meta.sizeBytes)

        const session = await prisma.uploadSession.create({ data: { userId: req.user!.id, targetConnectedAccountId: account.id, folderId, fileName, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes, status: 'uploading' } })
        logUpload('file upload started', { sessionId: session.id, accountId: account.id, fileName, sizeBytes: meta.sizeBytes.toString() })
        const chunks: Buffer[] = []
        fileStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        await new Promise<void>((resolve, reject) => {
          fileStream.on('end', resolve)
          fileStream.on('error', reject)
        })
        const fileBuffer = Buffer.concat(chunks)
        const streamedBytes = BigInt(fileBuffer.length)

        let providerFileId = ''
        let provisionalFileId: string | null = null
        if (account.provider === 's3') {
          const config = await getS3ConfigForAccount(account.id, req.user!.id)
          const provisionalFile = await prisma.file.create({
            data: { userId: req.user!.id, connectedAccountId: account.id, folderId, provider: 's3', providerFileId: 'pending', name: fileName, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes, status: 'uploading' },
          })
          provisionalFileId = provisionalFile.id
          providerFileId = buildS3ObjectKey(config, req.user!.id, provisionalFile.id, fileName)
          await uploadS3Object(config, providerFileId, Readable.from(fileBuffer), meta.mimeType)
          await prisma.file.update({ where: { id: provisionalFile.id }, data: { providerFileId, status: 'active' } })
          completed.push({ ...provisionalFile, providerFileId, status: 'active', sizeBytes: provisionalFile.sizeBytes.toString() })
          logUpload('s3 upload completed', { sessionId: session.id, accountId: account.id, fileName })
        } else if (account.provider === 'cloudinary') {
          const config = await getCloudinaryConfigForAccount(account.id, req.user!.id)
          const provisionalFile = await prisma.file.create({
            data: { userId: req.user!.id, connectedAccountId: account.id, folderId, provider: 'cloudinary', providerFileId: 'pending', name: fileName, mimeType: meta.mimeType, sizeBytes: meta.sizeBytes, status: 'uploading' },
          })
          provisionalFileId = provisionalFile.id
          try {
            providerFileId = await uploadCloudinaryObject(config, buildCloudinaryPublicId(config, provisionalFile.id), fileBuffer, meta.mimeType, fileName)
          } catch (uploadError) {
            await prisma.file.delete({ where: { id: provisionalFile.id } }).catch(() => undefined)
            throw uploadError
          }
          await prisma.file.update({ where: { id: provisionalFile.id }, data: { providerFileId, status: 'active' } })
          completed.push({ ...provisionalFile, providerFileId, status: 'active', sizeBytes: provisionalFile.sizeBytes.toString() })
          logUpload('cloudinary upload completed', { sessionId: session.id, accountId: account.id, fileName })
        } else {
          throw new Error(`Unsupported storage provider "${account.provider}".`)
        }

        if (streamedBytes !== meta.sizeBytes) {
          if (provisionalFileId) await prisma.file.update({ where: { id: provisionalFileId }, data: { status: 'deleted', deletedAt: new Date() } }).catch(() => undefined)
          await prisma.uploadSession.update({ where: { id: session.id }, data: { status: 'failed', errorMessage: 'Streamed byte count did not match declared size.' } })
          failed.push({ fileName, code: 'UPLOAD_SIZE_MISMATCH', message: 'Streamed byte count did not match declared size.' })
          return
        }

        await prisma.uploadSession.update({ where: { id: session.id }, data: { status: 'completed', completedAt: new Date() } })
        if (account.provider === 's3') syncS3Quota(account.id).catch(() => undefined)
        else syncCloudinaryQuota(account.id).catch(() => undefined)
      } catch (error) {
        fileStream.resume()
        logUpload('file upload failed', { fileName, message: error instanceof Error ? error.message : 'Upload failed' })
        failed.push({ fileName, code: 'UPLOAD_FAILED', message: error instanceof Error ? error.message : 'Upload failed' })
      }
    }

    busboy.on('field', (name, value) => {
      if (name === 'sizeBytes') fields.sizeBytes = BigInt(value)
      if (name === 'fileName') fields.fileName = value
      if (name === 'mimeType') fields.mimeType = value
      if (name === 'folderId') fields.folderId = value
      if (name === 'filesMeta') batchMeta = parseBatchMeta(value)
    })

    busboy.on('file', (name, fileStream, info) => {
      fileSeen = true
      pendingUploads.push(uploadOne(name, fileStream, info))
    })

    busboy.on('error', (error) => {
      logUpload('multipart parser failed', { message: error instanceof Error ? error.message : 'Unknown error' })
      if (!responded) {
        responded = true
        next(error)
      }
    })

    busboy.on('finish', () => {
      if (!responded && !fileSeen) return fail(400, 'UPLOAD_FILE_REQUIRED', 'file field required.')
      Promise.all(pendingUploads).then(() => {
        if (responded) return
        responded = true
        logUpload('response sent', { completed: completed.length, failed: failed.length })
        if (completed.length === 0) return res.status(400).json({ code: failed[0]?.code ?? 'UPLOAD_FAILED', message: failed[0]?.message ?? 'Upload failed', failed })
        if (!batchMeta && completed.length === 1 && failed.length === 0) return res.status(201).json({ file: completed[0] })
        return res.status(201).json({ files: completed, failed })
      }).catch(next)
    })

    req.pipe(busboy)
  } catch (error) {
    return next(error)
  }
}

uploadRouter.post('/', requireAuth, handleUpload)

// Resumable (chunked) upload endpoints were Google Drive only and are removed with Drive support.
// Every resumable route returns 410 so old clients get a clear answer instead of a silent failure.
// Express 5 (path-to-regexp v8) does not accept bare '*' wildcards; a regex catches every subpath.
uploadRouter.use(/\/resumable\/.*/, (_req: unknown, res: { status(n: number): { json(b: unknown): unknown } }) =>
  res.status(410).json({
    code: 'RESUMABLE_UPLOAD_REMOVED',
    message: 'Resumable uploads were Google Drive only and are no longer supported. Send the file to POST /uploads instead.',
  }),
)
