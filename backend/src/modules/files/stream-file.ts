import type { ConnectedAccount, File } from '@prisma/client'
import type { Response } from 'express'
import { streamCloudinaryFile } from '../cloudinary/cloudinary.service.js'
import { streamS3File } from '../s3/s3.service.js'

type FileWithAccount = File & { connectedAccount: ConnectedAccount }
type StreamOptions = { disposition?: 'inline' | 'attachment' }

// Only providers that expose their own delivery URL are supported. Anything else is a stale row.
export function streamProviderFile(file: FileWithAccount, range: string | undefined, res: Response, options: StreamOptions = {}) {
  if (file.provider === 'cloudinary') return streamCloudinaryFile(file, range, res, options)
  if (file.provider === 's3') return streamS3File(file, range, res, options)
  throw new Error(`Unsupported storage provider "${file.provider}". Google Drive support was removed; re-upload this file to Cloudinary or S3.`)
}
