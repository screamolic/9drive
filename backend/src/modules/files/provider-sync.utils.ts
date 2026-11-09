// A file found on the provider (Cloudinary resource, S3 object).
export type RemoteFile = {
  providerFileId: string
  name: string
  mimeType: string
  sizeBytes: bigint
  createdAt?: Date
  // Id of the app's own File row when the remote name embeds one (files uploaded through Multinary do).
  appFileId?: string
}

export type ExistingFile = { id: string; providerFileId: string; sizeBytes: bigint; status: string }

export const providerFileIdMaxLength = 191
export const fileNameMaxLength = 255

// Compare what is on the provider with what the database knows.
// - Anything already known (any status, so Trash is never duplicated) is matched by providerFileId.
// - Remote files whose name embeds the id of an existing row are skipped: that is an upload still being finalized.
// - Only `active` rows can be reported missing; trashed or in-flight rows are left alone.
export function diffRemoteFiles(existing: ExistingFile[], remote: RemoteFile[]) {
  const byProviderId = new Map(existing.map((file) => [file.providerFileId, file]))
  const existingIds = new Set(existing.map((file) => file.id))
  const remoteIds = new Set(remote.map((file) => file.providerFileId))
  const toCreate: RemoteFile[] = []
  const toUpdate: Array<{ id: string; sizeBytes: bigint }> = []

  for (const file of remote) {
    const known = byProviderId.get(file.providerFileId)
    if (known) {
      if (known.status === 'active' && known.sizeBytes !== file.sizeBytes) toUpdate.push({ id: known.id, sizeBytes: file.sizeBytes })
      continue
    }
    if (file.appFileId && existingIds.has(file.appFileId)) continue
    toCreate.push(file)
  }

  const missing = existing.filter((file) => file.status === 'active' && !remoteIds.has(file.providerFileId)).map((file) => file.id)
  return { toCreate, toUpdate, missing }
}

export function chunk<T>(items: T[], size: number) {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}
