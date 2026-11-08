import { Router } from 'express'
import { requireApiKey } from '../../middleware/api-key.middleware.js'
import { queueRouter } from '../queue/queue.routes.js'
import { handleUpload } from '../uploads/upload.routes.js'
import { publicFilesRouter } from './public-files.routes.js'

export const publicApiRouter = Router()

publicApiRouter.post('/v1/uploads', requireApiKey('files:upload'), handleUpload)
publicApiRouter.use('/v1/files', publicFilesRouter)
publicApiRouter.use('/v1/queue', queueRouter)
