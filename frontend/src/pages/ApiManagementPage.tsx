import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle, Clipboard, KeyRound, ShieldCheck, Trash2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DummyModal } from '@/components/drive/DummyModal'
import { PageHeader } from '@/components/drive/PageHeader'
import { API_URL, apiFetch, formatDate } from '@/lib/api'

type ApiKey = { id: string; name: string; keyPrefix: string; scopes: string[]; status: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string }

const curlExample = `curl -X POST "${API_URL}/api/v1/uploads" \\
  -H "Authorization: Bearer 9d_live_xxx" \\
  -F 'filesMeta=[{"fieldName":"file-0","fileName":"hello.txt","mimeType":"text/plain","sizeBytes":"12"}]' \\
  -F "file-0=@hello.txt;type=text/plain"`

const scopeOptions = [
  { value: 'files:upload', label: 'files:upload', hint: 'Upload files' },
  { value: 'files:read', label: 'files:read', hint: 'List files and read their public media URL' },
  { value: 'queue:read', label: 'queue:read', hint: 'Read the content queue' },
  { value: 'queue:write', label: 'queue:write', hint: 'Add, claim, update and delete queue items' },
]

const queueCurlExample = `# 1. Add a Cloudinary file to the queue (optionally with a target, caption and time)
curl -X POST "${API_URL}/api/v1/queue" \\
  -H "Authorization: Bearer 9d_live_xxx" -H "Content-Type: application/json" \\
  -d '{"fileId":"<file id>","target":"account-1","caption":"Hello","scheduledAt":"2026-12-01T09:00:00Z"}'

# 2. A worker takes the next item that is due ({"item": null} when empty)
curl -X POST "${API_URL}/api/v1/queue/claim" \\
  -H "Authorization: Bearer 9d_live_xxx" -H "Content-Type: application/json" \\
  -d '{"target":"account-1"}'

# 3. Report the result: posted, failed (with error) or pending (retry)
curl -X PATCH "${API_URL}/api/v1/queue/<item id>" \\
  -H "Authorization: Bearer 9d_live_xxx" -H "Content-Type: application/json" \\
  -d '{"status":"posted","externalId":"<post id>"}'`

const jsExample = `const form = new FormData()
form.append('filesMeta', JSON.stringify([
  { fieldName: 'file-0', fileName: file.name, mimeType: file.type, sizeBytes: String(file.size) },
]))
form.append('file-0', file)

await fetch('${API_URL}/api/v1/uploads', {
  method: 'POST',
  headers: { Authorization: 'Bearer 9d_live_xxx' },
  body: form,
})`

export function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [keyScopes, setKeyScopes] = useState<string[]>(['files:upload'])
  const [secret, setSecret] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const data = await apiFetch<{ apiKeys: ApiKey[] }>('/api-keys')
    setApiKeys(data.apiKeys)
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load API keys'))
  }, [])

  async function createKey(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const data = await apiFetch<{ apiKey: ApiKey; secret: string }>('/api-keys', { method: 'POST', body: JSON.stringify({ name: keyName, scopes: keyScopes }) })
      setSecret(data.secret)
      setKeyName('')
      setKeyScopes(['files:upload'])
      setCreateOpen(false)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create API key')
    } finally {
      setLoading(false)
    }
  }

  async function revokeKey(id: string) {
    await apiFetch(`/api-keys/${id}`, { method: 'DELETE' })
    await load()
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(() => setMessage('Copied to clipboard.')).catch(() => setMessage('Failed to copy.'))
  }

  const activeKeys = apiKeys.filter((apiKey) => apiKey.status === 'active').length
  const usedKeys = apiKeys.filter((apiKey) => apiKey.lastUsedAt).length

  return (
    <>
      <PageHeader title="API Management" description="Create API keys, copy examples, and upload files from external apps." actions={<Button className="col-span-2 w-full sm:w-auto" onClick={() => setCreateOpen(true)}><KeyRound className="h-4 w-4" />Create API Key</Button>} />
      {message ? <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{message}</p> : null}
      {secret ? <Card className="mt-5 min-w-0 overflow-hidden border-blue-200 bg-blue-50 p-0"><div className="grid min-w-0 gap-4 p-4 sm:p-5"><div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0"><p className="font-extrabold text-blue-950">Copy your API key now</p><p className="mt-1 text-sm text-blue-700">This secret is shown once. Store it securely before closing this page.</p></div></div><div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_auto]"><code className="block min-w-0 max-w-full overflow-x-auto rounded-xl bg-white p-3 text-xs font-semibold text-slate-950 sm:text-sm">{secret}</code><Button className="w-full lg:w-auto" type="button" onClick={() => copy(secret)}><Clipboard className="h-4 w-4" />Copy key</Button></div></div></Card> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><KeyRound className="h-5 w-5 text-blue-600" /><p className="mt-3 text-2xl font-extrabold">{activeKeys}</p><p className="text-sm text-slate-500">Active keys</p></Card>
        <Card className="p-4"><CheckCircle className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-extrabold">{usedKeys}</p><p className="text-sm text-slate-500">Used keys</p></Card>
        <Card className="p-4"><UploadCloud className="h-5 w-5 text-blue-600" /><p className="mt-3 text-2xl font-extrabold">3</p><p className="text-sm text-slate-500">API areas: upload, files, queue</p></Card>
      </div>

      <div className="mt-6 grid gap-6">
        <Card className="min-w-0 p-4 sm:p-5">
          <div><h2 className="text-lg font-extrabold">API Keys</h2><p className="mt-1 text-sm text-slate-500">Each key only gets the scopes you pick. Raw secrets are never stored.</p></div>
          <div className="mt-4 grid gap-3">
            {apiKeys.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center sm:p-6"><KeyRound className="mx-auto h-8 w-8 text-blue-600" /><p className="mt-3 font-extrabold">No API keys yet</p><p className="mt-1 text-sm text-slate-500">Create one key, copy it once, then use the docs below.</p><Button className="mt-4 w-full sm:w-auto" onClick={() => setCreateOpen(true)}>Create API Key</Button></div> : apiKeys.map((apiKey) => <div key={apiKey.id} className="grid min-w-0 gap-4 rounded-2xl bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><p className="min-w-0 break-words font-semibold text-slate-950">{apiKey.name}</p><span className={apiKey.status === 'active' ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600'}>{apiKey.status}</span></div><div className="mt-2 grid min-w-0 gap-1 text-sm text-slate-500 sm:grid-cols-2"><p className="min-w-0 truncate"><span className="font-semibold text-slate-700">Prefix:</span> {apiKey.keyPrefix}...</p><p className="min-w-0 break-words"><span className="font-semibold text-slate-700">Created:</span> {formatDate(apiKey.createdAt)}</p><p className="min-w-0 break-words"><span className="font-semibold text-slate-700">Last used:</span> {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : 'Never'}</p><p className="min-w-0 break-words"><span className="font-semibold text-slate-700">Scope:</span> {apiKey.scopes.join(', ')}</p></div></div>
              <Button className="w-full lg:w-auto" variant="danger" onClick={() => revokeKey(apiKey.id)} disabled={apiKey.status === 'revoked'}><Trash2 className="h-4 w-4" />Revoke</Button>
            </div>)}
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <div><h2 className="text-lg font-extrabold">Files and Queue API Docs</h2><p className="mt-1 text-sm text-slate-500">For automation such as a social media scheduler. Only files stored on Cloudinary have a public media URL and can be queued. Items go pending, processing, then posted or failed. An item left in processing for 15 minutes is handed out again.</p></div>
          <div className="mt-4 grid gap-4 text-sm text-slate-600">
            <div className="min-w-0"><p className="font-bold text-slate-950">Endpoints</p><pre className="mt-2 max-w-full overflow-auto rounded-xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-950 sm:text-sm">{`GET    /api/v1/files?q=&type=image|video|audio&limit=&offset=   (files:read)
GET    /api/v1/files/:id                                        (files:read)
POST   /api/v1/queue                                            (queue:write)
GET    /api/v1/queue?status=&target=&limit=&offset=             (queue:read)
POST   /api/v1/queue/claim                                      (queue:write)
GET    /api/v1/queue/:id                                        (queue:read)
PATCH  /api/v1/queue/:id                                        (queue:write)
DELETE /api/v1/queue/:id                                        (queue:write)`}</pre></div>
            <div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-3"><p className="font-bold text-slate-950">cURL</p><Button variant="outline" size="sm" onClick={() => copy(queueCurlExample)}><Clipboard className="h-4 w-4" />Copy</Button></div><pre className="max-h-96 max-w-full overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-white">{queueCurlExample}</pre></div>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-5">
          <div><h2 className="text-lg font-extrabold">Upload API Docs</h2><p className="mt-1 text-sm text-slate-500">Multipart upload uses the same storage routing as dashboard uploads.</p></div>
          <div className="mt-4 grid gap-4 text-sm text-slate-600">
            <div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-3"><p className="font-bold text-slate-950">Endpoint</p><Button variant="outline" size="sm" onClick={() => copy(`${API_URL}/api/v1/uploads`)}><Clipboard className="h-4 w-4" />Copy</Button></div><code className="block min-w-0 max-w-full overflow-x-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-950 sm:text-sm">POST {API_URL}/api/v1/uploads</code></div>
            <div className="min-w-0"><p className="font-bold text-slate-950">Auth Header</p><code className="mt-2 block min-w-0 max-w-full overflow-x-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-950 sm:text-sm">Authorization: Bearer 9d_live_xxx</code></div>
            <div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-3"><p className="font-bold text-slate-950">cURL</p><Button variant="outline" size="sm" onClick={() => copy(curlExample)}><Clipboard className="h-4 w-4" />Copy</Button></div><pre className="max-h-72 max-w-full overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-white">{curlExample}</pre></div>
            <div className="min-w-0"><div className="mb-2 flex items-center justify-between gap-3"><p className="font-bold text-slate-950">JavaScript</p><Button variant="outline" size="sm" onClick={() => copy(jsExample)}><Clipboard className="h-4 w-4" />Copy</Button></div><pre className="max-h-72 max-w-full overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-relaxed text-white">{jsExample}</pre></div>
          </div>
        </Card>
      </div>

      <DummyModal open={createOpen} title="Create API Key" description="Pick the scopes this key needs. A worker for the content queue needs files:read, queue:read and queue:write." onClose={() => setCreateOpen(false)}>
        <form className="grid gap-4" onSubmit={createKey}>
          <input className="h-11 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Key name" value={keyName} onChange={(event) => setKeyName(event.target.value)} required />
          <div className="grid gap-2">
            {scopeOptions.map((scope) => <label key={scope.value} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <input className="mt-1" type="checkbox" checked={keyScopes.includes(scope.value)} onChange={(event) => setKeyScopes(event.target.checked ? [...keyScopes, scope.value] : keyScopes.filter((item) => item !== scope.value))} />
              <span><span className="block font-semibold text-slate-950">{scope.label}</span><span className="text-slate-500">{scope.hint}</span></span>
            </label>)}
          </div>
          <div className="grid gap-3 sm:flex sm:justify-end"><Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={loading}>Cancel</Button><Button type="submit" disabled={loading || keyScopes.length === 0}>{loading ? 'Creating...' : 'Create Key'}</Button></div>
        </form>
      </DummyModal>
    </>
  )
}
