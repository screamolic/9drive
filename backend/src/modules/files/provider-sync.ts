import { prisma } from '../../config/prisma.js'
import { chunk, diffRemoteFiles, type RemoteFile } from './provider-sync.utils.js'

export type ProviderSyncResult = {
  accountId: string
  created: number
  updated: number
  deleted: number
  skipped: number
  warning?: string
}

export class SyncInProgressError extends Error {
  code = 'SYNC_IN_PROGRESS'
  constructor() {
    super('A sync is already running for this account.')
  }
}

// One sync per account at a time (this process only; the backend is a single long-running Node process).
const runningSyncs = new Set<string>()

export async function withAccountSyncLock<T>(accountId: string, work: () => Promise<T>) {
  if (runningSyncs.has(accountId)) throw new SyncInProgressError()
  runningSyncs.add(accountId)
  try {
    return await work()
  } finally {
    runningSyncs.delete(accountId)
  }
}

// Make the database match the provider: register files that are not known yet, refresh sizes,
// and mark files that disappeared from the provider as deleted. Same idea as the Google Drive sync, except
// that files already in the Trash stay in the Trash instead of coming back.
// `remote` must be the COMPLETE listing: callers throw instead of passing a partial one.
export async function reconcileProviderFiles(params: {
  userId: string
  accountId: string
  provider: 's3' | 'cloudinary'
  remote: RemoteFile[]
  skipped: number
}): Promise<ProviderSyncResult> {
  const { userId, accountId, provider, remote, skipped } = params
  const existing = await prisma.file.findMany({
    where: { userId, connectedAccountId: accountId, provider },
    select: { id: true, providerFileId: true, sizeBytes: true, status: true },
  })

  const { toCreate, toUpdate, missing } = diffRemoteFiles(existing, remote)
  let warning: string | undefined
  let missingToMark = missing

  // An empty listing next to existing files usually means a wrong folder/prefix or revoked access, not an emptied account.
  if (remote.length === 0 && missing.length > 0) {
    missingToMark = []
    warning = `The provider returned no files, so ${missing.length} known file(s) were not marked as deleted. Check the folder/prefix and credentials, then sync again.`
  }

  for (const batch of chunk(toCreate, 500)) {
    await prisma.file.createMany({
      data: batch.map((file) => ({
        userId,
        connectedAccountId: accountId,
        provider,
        providerFileId: file.providerFileId,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        status: 'active',
        ...(file.createdAt ? { createdAt: file.createdAt } : {}),
      })),
    })
  }

  for (const item of toUpdate) {
    await prisma.file.update({ where: { id: item.id }, data: { sizeBytes: item.sizeBytes } })
  }

  let deleted = 0
  for (const batch of chunk(missingToMark, 1000)) {
    const result = await prisma.file.updateMany({ where: { id: { in: batch }, userId }, data: { status: 'deleted', deletedAt: new Date() } })
    deleted += result.count
  }

  return { accountId, created: toCreate.length, updated: toUpdate.length, deleted, skipped, ...(warning ? { warning } : {}) }
}
