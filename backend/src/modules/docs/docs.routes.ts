import { Router } from 'express'
import { openApiDocument } from './openapi.document.js'

export const docsRouter = Router()

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Multinary API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
<style>body { margin: 0; } #swagger-ui .topbar { display: none; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
<script>
window.onload = () => window.SwaggerUIBundle({
  url: '/api-docs/openapi.json',
  dom_id: '#swagger-ui',
  docExpansion: 'list',
  tryItOutEnabled: true,
})
</script>
</body>
</html>`

docsRouter.get('/api-docs', (_req, res) => {
  res.type('html').send(html)
})

docsRouter.get('/api-docs/openapi.json', (_req, res) => {
  res.json(openApiDocument)
})
