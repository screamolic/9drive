import { useEffect, useState, type FormEvent } from 'react'
import { DummyModal } from '@/components/drive/DummyModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api'

type SkipReason = 'FILE_NOT_FOUND' | 'FILE_NOT_PUBLIC' | 'ALREADY_QUEUED'
type CreateResult = { created: number; skipped: { fileId: string; reason: SkipReason }[] }

const skipLabels: Record<SkipReason, string> = {
  FILE_NOT_FOUND: 'not found',
  FILE_NOT_PUBLIC: 'no public URL (Google Drive)',
  ALREADY_QUEUED: 'already waiting for this target',
}

export function describeQueueResult(result: CreateResult) {
  const parts: string[] = []
  parts.push(result.created === 1 ? 'Added 1 file to the queue.' : `Added ${result.created} files to the queue.`)
  const counts = new Map<SkipReason, number>()
  for (const skip of result.skipped) counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1)
  if (counts.size > 0) parts.push(`Skipped: ${[...counts].map(([reason, count]) => `${count} ${skipLabels[reason]}`).join(', ')}.`)
  return parts.join(' ')
}

// <input type="datetime-local"> value (local time) -> ISO string, or null when empty.
function localToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function AddToQueueModal({ open, fileIds, description, onClose, onDone }: { open: boolean; fileIds: string[]; description: string; onClose: () => void; onDone: (message: string) => void }) {
  const [target, setTarget] = useState('')
  const [caption, setCaption] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [spread, setSpread] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    apiFetch<{ targets: { name: string }[] }>('/content-queue?limit=1')
      .then((data) => setTargets(data.targets.map((item) => item.name)))
      .catch(() => setTargets([]))
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const spreadMinutes = spread.trim() ? Number(spread) : 0
      if (!Number.isInteger(spreadMinutes) || spreadMinutes < 0) throw new Error('Spacing must be a whole number of minutes.')
      const result = await apiFetch<CreateResult>('/content-queue', {
        method: 'POST',
        body: JSON.stringify({
          fileIds,
          target: target.trim() || null,
          caption: caption.trim() || null,
          scheduledAt: localToIso(scheduledAt),
          spreadMinutes,
        }),
      })
      onDone(describeQueueResult(result))
      setCaption('')
      setScheduledAt('')
      setSpread('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to queue')
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500'
  return (
    <DummyModal open={open} title="Add to Queue" description={description} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={label}>Target (optional)</label>
          <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="e.g. instagram-main" maxLength={191} list="queue-targets" />
          <datalist id="queue-targets">{targets.map((name) => <option key={name} value={name} />)}</datalist>
          <p className="mt-1.5 text-xs text-slate-500">A free label. A worker can ask for only the items with its target.</p>
        </div>
        <div>
          <label className={label}>Caption (optional)</label>
          <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={10000} />
          <p className="mt-1.5 text-xs text-slate-500">The same caption is used for every selected file. Edit single items later in the Queue page.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Start at (optional)</label>
            <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          </div>
          <div>
            <label className={label}>Space files by (min)</label>
            <Input type="number" min={0} max={10080} step={1} value={spread} onChange={(event) => setSpread(event.target.value)} placeholder="0" disabled={fileIds.length < 2} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-slate-500">Leave the time empty to make files available right away. With spacing, file 1 goes at the start time (or now), file 2 that many minutes later, and so on.</p>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || fileIds.length === 0}>{busy ? 'Adding…' : `Add ${fileIds.length} to queue`}</Button>
        </div>
      </form>
    </DummyModal>
  )
}
