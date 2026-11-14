import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { openApiDocument as spec } from '../dist/modules/docs/openapi.document.js'

test('spec covers every mounted API operation without invented routes', () => {
  const app = fs.readFileSync('src/app.ts', 'utf8')
  // Routes that still exist only to answer old Google Drive / resumable clients with 410.
  const removed410 = new Set([
    'GET /auth/google/url',
    'GET /auth/google/callback',
    'POST /auth/google/exchange',
    'GET /connected-accounts/google/connect-url',
    'GET /connected-accounts/google/connect',
    'GET /connected-accounts/google/callback',
    'GET /files/sync-google',
    'GET /uploads/resumable/status/{id}',
    'POST /uploads/resumable/init',
    'PUT /uploads/resumable/chunk/{id}',
    'GET /system/google-config',
    'POST /system/google-config',
  ])
  const expected = new Set(['GET /health', 'GET /api-docs', 'GET /api-docs/openapi.json'])
  for (const match of app.matchAll(/import \{ (\w+) \} from '(\.\/modules\/[^']+\.routes)\.js'/g)) {
    const [, router, file] = match
    if (router === 'docsRouter') continue
    const mount = new RegExp(`app\\.use\\('([^']*)', ${router}\\)`).exec(app)?.[1]
    assert.ok(mount !== undefined, router)
    const source = fs.readFileSync(path.join('src', file + '.ts'), 'utf8')
    for (const route of source.matchAll(new RegExp(`${router}\\.(get|post|put|patch|delete)\\('([^']*)'`, 'g'))) {
      const url = (mount + (route[2] === '/' ? '' : route[2])).replace(/:([\w]+)/g, '{$1}')
      expected.add(`${route[1].toUpperCase()} ${url}`)
    }
  }
  const actual = new Set()
  for (const [url, item] of Object.entries(spec.paths)) {
    for (const method of Object.keys(item)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) actual.add(`${method.toUpperCase()} ${url}`)
    }
  }
  // 410 removed-route stubs are documented in the spec; they are not real routes in source.
  for (const key of removed410) if (actual.has(key)) actual.delete(key)
  // Wildcard stub routes (uploadRouter.all('/resumable/*')) cover the removed410 set — no source entry expected.
  for (const key of removed410) expected.delete(key)
  assert.deepEqual([...actual].sort(), [...expected].sort())
})

test('API keys use Bearer authorization, matching middleware', () => {
  assert.equal(spec.components.securitySchemes.apiKeyAuth.type, 'http')
  assert.equal(spec.components.securitySchemes.apiKeyAuth.scheme, 'bearer')
})

test('multipart metadata includes sizeBytes before the file', () => {
  for (const url of ['/uploads', '/api/v1/uploads']) {
    const schema = spec.paths[url].post.requestBody.content['multipart/form-data'].schema
    assert.deepEqual(schema.required, ['sizeBytes', 'file'])
    assert.ok(schema.properties.sizeBytes)
    assert.ok(!schema.properties.targetAccountId, 'multipart route does not read targetAccountId')
    assert.match(spec.paths[url].post.description, /before/i)
  }
})

test('refresh returns only an access token', () => {
  const response = spec.paths['/auth/refresh'].post.responses['200'].content['application/json'].schema
  assert.deepEqual(response.required, ['accessToken'])
  assert.ok(!response.properties.refreshToken)
})
