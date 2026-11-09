import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Copy, ExternalLink, FileText, Film, ListChecks, Music, Pencil, RefreshCw, RotateCcw, Trash2, Undo2, Loader2, Unlock } from 'lucide-react'
import { DummyModal } from '@/components/drive/DummyModal'
import { MetricCard } from '@/components/drive/MetricCard'
import { PageHeader } from '@/components/drive/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiFetch, formatBytes, formatDate } from '@/lib/api'
import { cn } from '@/lib/utils'

type Status = 'pending' | 'processing' | 'posted' | 'failed'
type QueueItem = {
  id: string
  fileId: string
  target: string | null
  caption: string | null
  status: Status
  stuck: boolean
  scheduledAt: string | null
  claimedAt: string | null
  postedAt: string | null
  attempts: number
  lastError: string | null
  externalId: string | null
  createdAt: string
  file: { id: string; name: string; mimeType: string; mediaType: 'image' | 'video' | 'audio' | 'file'; sizeBytes: string; provider: string; status: string; mediaUrl: string | null }
}
type Counts = Record<Status | 'stuck', number>
type ListResponse = { items: QueueItem[]; total: number; counts: Counts; targets: { name: string; count: number }[] }
type BulkAction = 'retry' | 'requeue' | 'release' | 'delete' | 'setTarget' | 'reschedule'
type Sort = 'created_asc' | 'created_desc' | 'scheduled_asc' | 'updated_desc'

const PAGE_SIZE = 50
const emptyCounts: Counts = { pending: 0, processing: 0, posted: 0, failed: 0, stuck: 0 }
const statusTabs: { value: Status | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'posted', label: 'Posted' },
  { value: 'failed', label: 'Failed' },
]
const statusStyles: Record<Status, string> = {
  pending: 'bg-blue-50 text-blue-700',
  processing: 'bg-amber-50 text-amber-700',
  posted: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
}
const selectClass = 'h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500'

function isoToLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function localToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
function formatWhen(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
}

function Thumb({ item }: { item: QueueItem }) {
  const { mediaType, mediaUrl } = item.file
  const box = 'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-500'
  if (mediaType === 'image' && mediaUrl) return <div className={box}><img src={mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" /></div>
  const Icon = mediaType === 'video' ? Film : mediaType === 'audio' ? Music : FileText
  return <div className={box}><Icon className="h-5 w-5" /></div>
}

function StatusBadge({ item }: { item: QueueItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold capitalize', statusStyles[item.status])}>{item.status}</span>
      {item.stuck ? <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-700" title="Claimed by a worker that never reported back. It will be handed out again automatically.">stuck</span> : null}
    </div>
  )
}

export function QueuePage() {
  const [status, setStatus] = useState<Status | ''>('')
  const [target, setTarget] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('created_asc')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectAllMatching, setSelectAllMatching] = useState(false)
  const [editing, setEditing] = useState<QueueItem | null>(null)
  const [bulkModal, setBulkModal] = useState<'setTarget' | 'reschedule' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)

  // Debounce the search box.
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setOffset(0) }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE), offset: String(offset) })
      if (status) params.set('status', status)
      if (target) params.set('target', target)
      if (query) params.set('q', query)
      setData(await apiFetch<ListResponse>(`/content-queue?${params}`))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load the queue')
    } finally {
      setLoading(false)
    }
  }, [status, target, query, sort, offset])

  useEffect(() => { void load() }, [load])
  // Workers change items in the background, so refresh quietly now and then.
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void load(true) }, 15000)
    return () => window.clearInterval(timer)
  }, [load])

  const items = data?.items ?? []
  const counts = data?.counts ?? emptyCounts
  const total = data?.total ?? 0
  const selectedCount = selectAllMatching ? total : selected.size
  const allOnPageSelected = items.length > 0 && items.every((item) => selected.has(item.id))
  const selectedItems = items.filter((item) => selected.has(item.id))

  function clearSelection() { setSelected(new Set()); setSelectAllMatching(false) }
  function changeFilter(update: () => void) { update(); setOffset(0); clearSelection() }
  function toggle(id: string) {
    setSelectAllMatching(false)
    setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function togglePage() {
    setSelectAllMatching(false)
    setSelected(allOnPageSelected ? new Set() : new Set(items.map((item) => item.id)))
  }

  async function run<T>(work: () => Promise<T>, success: (result: T) => string) {
    setBusy(true)
    try {
      const result = await work()
      setMessage(success(result))
      await load(true)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function bulk(action: BulkAction, extra: Record<string, unknown> = {}) {
    const body = { action, ...extra, ...(selectAllMatching ? { filter: { ...(status ? { status } : {}), ...(target ? { target } : {}) } } : { ids: [...selected] }) }
    const ok = await run(
      () => apiFetch<{ affected: number }>('/content-queue/bulk', { method: 'POST', body: JSON.stringify(body) }),
      (result) => (result.affected === 0 ? 'Nothing changed: none of the selected items were in a status this action applies to.' : `Done: ${result.affected} item${result.affected === 1 ? '' : 's'} updated.`),
    )
    if (ok) { clearSelection(); setBulkModal(null) }
  }

  const single = (item: QueueItem, action: BulkAction) =>
    run(() => apiFetch<{ affected: number }>('/content-queue/bulk', { method: 'POST', body: JSON.stringify({ action, ids: [item.id] }) }), () => 'Done.')

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setMessage(`${what} copied.`) } catch { setMessage('Could not copy to the clipboard.') }
  }

  const pageFrom = total === 0 ? 0 : offset + 1
  const pageTo = Math.min(offset + PAGE_SIZE, total)
  const filtersActive = Boolean(status || target || query)

  return (
    <>
      <PageHeader
        title="Queue"
        description="Files waiting for an automation (for example a social media scheduler) to pick them up through the API."
        actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />Refresh</Button>}
      />
      {message ? <p className="mt-5 flex items-start justify-between gap-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-700"><span>{message}</span><button className="font-bold" onClick={() => setMessage('')} aria-label="Dismiss">×</button></p> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending" value={String(counts.pending)} icon={Clock} />
        <MetricCard label="Processing" value={counts.stuck > 0 ? `${counts.processing} (${counts.stuck} stuck)` : String(counts.processing)} icon={Loader2} />
        <MetricCard label="Posted" value={String(counts.posted)} icon={CheckCircle2} />
        <MetricCard label="Failed" value={String(counts.failed)} icon={AlertTriangle} />
      </div>

      <Card className="mt-6 p-4">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button key={tab.value} onClick={() => changeFilter(() => setStatus(tab.value))} className={cn('h-9 rounded-xl px-3.5 text-[13px] font-bold transition-all', status === tab.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {tab.label}{tab.value ? <span className="ml-1.5 opacity-70">{counts[tab.value]}</span> : null}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search file name or caption" />
          <select className={selectClass} value={target} onChange={(event) => changeFilter(() => setTarget(event.target.value))} aria-label="Filter by target">
            <option value="">All targets</option>
            {(data?.targets ?? []).map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}
          </select>
          <select className={selectClass} value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value as Sort))} aria-label="Sort">
            <option value="created_asc">Oldest first (claim order)</option>
            <option value="created_desc">Newest first</option>
            <option value="scheduled_asc">Scheduled time</option>
            <option value="updated_desc">Recently changed</option>
          </select>
        </div>
      </Card>

      {selectedCount > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-extrabold text-slate-700">
            {selectedCount} selected
            {!selectAllMatching && allOnPageSelected && total > items.length ? <button className="ml-3 font-bold text-blue-600 underline" onClick={() => setSelectAllMatching(true)}>Select all {total} matching{filtersActive ? ' the filters' : ''}</button> : null}
            {selectAllMatching ? <span className="ml-3 font-semibold text-slate-500">(everything matching the current filters)</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk('retry')}><RotateCcw className="h-4 w-4" />Retry failed</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk('requeue')}><Undo2 className="h-4 w-4" />Post again</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulk('release')}><Unlock className="h-4 w-4" />Release</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setBulkModal('setTarget')}>Set target</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setBulkModal('reschedule')}><Clock className="h-4 w-4" />Reschedule</Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setBulkModal('delete')}><Trash2 className="h-4 w-4" />Remove</Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
          </div>
        </div>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        {loading && !data ? <p className="p-8 text-center text-sm text-slate-500">Loading…</p> : null}
        {data && items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ListChecks className="h-6 w-6" /></div>
            <p className="font-bold">{filtersActive ? 'No items match these filters' : 'The queue is empty'}</p>
            <p className="max-w-md text-sm text-slate-500">{filtersActive ? 'Try another status, target or search.' : 'Select Cloudinary or S3 files in All Files and choose Queue, or add items through the API.'}</p>
          </div>
        ) : null}
        {items.length > 0 ? (
          <>
            <div className="hidden items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 md:flex">
              <input type="checkbox" checked={allOnPageSelected} onChange={togglePage} aria-label="Select all on this page" />
              <span>{items.length} on this page</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const editable = item.status === 'pending' || item.status === 'failed'
                const fileGone = item.file.status !== 'active'
                return (
                  <li key={item.id} className={cn('flex gap-3 p-4', selected.has(item.id) && 'bg-blue-50/40')}>
                    <input type="checkbox" className="mt-1 shrink-0" checked={selectAllMatching || selected.has(item.id)} disabled={selectAllMatching} onChange={() => toggle(item.id)} aria-label={`Select ${item.file.name}`} />
                    <Thumb item={item} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="truncate text-sm font-extrabold">{item.file.name}</p>
                        <StatusBadge item={item} />
                        {item.target ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.target}</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatBytes(item.file.sizeBytes)} · {item.file.provider === 'cloudinary' ? 'Cloudinary' : item.file.provider === 's3' ? 'S3' : item.file.provider}
                        {item.scheduledAt ? ` · scheduled ${formatWhen(item.scheduledAt)}` : ' · no schedule'}
                        {item.postedAt ? ` · posted ${formatWhen(item.postedAt)}` : ''}
                        {item.attempts > 0 ? ` · ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}` : ''}
                        {` · added ${formatDate(item.createdAt)}`}
                      </p>
                      {item.caption ? <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-slate-700">{item.caption}</p> : null}
                      {item.externalId ? <p className="mt-1 text-xs text-slate-500">External ID: <span className="font-mono">{item.externalId}</span></p> : null}
                      {item.lastError ? <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{item.lastError}</p> : null}
                      {fileGone ? <p className="mt-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700">The file is in the Recycle Bin or deleted, so workers will not receive this item. Restore the file or remove the item.</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap content-start justify-end gap-1">
                      {item.file.mediaUrl ? (
                        <>
                          <Button size="sm" variant="ghost" title="Copy public URL" aria-label="Copy public URL" onClick={() => void copy(item.file.mediaUrl!, 'URL')}><Copy className="h-4 w-4" /></Button>
                          <a href={item.file.mediaUrl} target="_blank" rel="noreferrer" title="Open public URL" aria-label="Open public URL" className="inline-flex h-9 items-center rounded-xl px-3 text-slate-700 hover:bg-slate-100"><ExternalLink className="h-4 w-4" /></a>
                        </>
                      ) : null}
                      {editable ? <Button size="sm" variant="ghost" title="Edit" aria-label="Edit" onClick={() => setEditing(item)}><Pencil className="h-4 w-4" /></Button> : null}
                      {item.status === 'failed' ? <Button size="sm" variant="ghost" title="Retry" aria-label="Retry" disabled={busy} onClick={() => void single(item, 'retry')}><RotateCcw className="h-4 w-4" /></Button> : null}
                      {item.status === 'posted' ? <Button size="sm" variant="ghost" title="Post again" aria-label="Post again" disabled={busy} onClick={() => void single(item, 'requeue')}><Undo2 className="h-4 w-4" /></Button> : null}
                      {item.status === 'processing' ? <Button size="sm" variant="ghost" title="Release back to pending" aria-label="Release" disabled={busy} onClick={() => void single(item, 'release')}><Unlock className="h-4 w-4" /></Button> : null}
                      <Button size="sm" variant="danger" title="Remove from queue" aria-label="Remove from queue" disabled={busy} onClick={() => void single(item, 'delete')}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
              <span>{pageFrom}–{pageTo} of {total}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); clearSelection() }}>Previous</Button>
                <Button size="sm" variant="outline" disabled={offset + PAGE_SIZE >= total} onClick={() => { setOffset(offset + PAGE_SIZE); clearSelection() }}>Next</Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Removing an item only removes it from the queue; the file stays in your storage. Removing or editing an item that a worker is processing is possible, but the worker may still post it.
      </p>

      <EditItemModal item={editing} targets={(data?.targets ?? []).map((item) => item.name)} busy={busy} onClose={() => setEditing(null)} onSave={async (id, body) => {
        const ok = await run(() => apiFetch(`/content-queue/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), () => 'Item updated.')
        if (ok) setEditing(null)
      }} />

      <SetTargetModal open={bulkModal === 'setTarget'} count={selectedCount} targets={(data?.targets ?? []).map((item) => item.name)} busy={busy} onClose={() => setBulkModal(null)} onSubmit={(value) => bulk('setTarget', { target: value })} />
      <RescheduleModal open={bulkModal === 'reschedule'} count={selectedCount} busy={busy} onClose={() => setBulkModal(null)} onSubmit={(scheduledAt, spreadMinutes) => bulk('reschedule', { scheduledAt, spreadMinutes })} />
      <DummyModal open={bulkModal === 'delete'} title="Remove from Queue" description={`Remove ${selectedCount} item${selectedCount === 1 ? '' : 's'} from the queue? The files stay in your storage.${selectedItems.some((item) => item.status === 'processing') ? ' Some are being processed right now.' : ''}`} onClose={() => setBulkModal(null)}>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setBulkModal(null)}>Cancel</Button>
          <Button variant="danger" disabled={busy} onClick={() => void bulk('delete')}>Remove</Button>
        </div>
      </DummyModal>
    </>
  )
}

function EditItemModal({ item, targets, busy, onClose, onSave }: { item: QueueItem | null; targets: string[]; busy: boolean; onClose: () => void; onSave: (id: string, body: { target: string | null; caption: string | null; scheduledAt: string | null }) => void }) {
  const [target, setTarget] = useState('')
  const [caption, setCaption] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  useEffect(() => {
    setTarget(item?.target ?? '')
    setCaption(item?.caption ?? '')
    setScheduledAt(isoToLocal(item?.scheduledAt ?? null))
  }, [item])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!item) return
    onSave(item.id, { target: target.trim() || null, caption: caption.trim() || null, scheduledAt: localToIso(scheduledAt) })
  }

  return (
    <DummyModal open={item !== null} title="Edit Queue Item" description={item?.file.name ?? ''} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={labelClass}>Target</label>
          <Input value={target} onChange={(event) => setTarget(event.target.value)} maxLength={191} list="edit-queue-targets" placeholder="No target" />
          <datalist id="edit-queue-targets">{targets.map((name) => <option key={name} value={name} />)}</datalist>
        </div>
        <div>
          <label className={labelClass}>Caption</label>
          <textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={10000} />
        </div>
        <div>
          <label className={labelClass}>Scheduled for</label>
          <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
          <p className="mt-1.5 text-xs text-slate-500">Empty means available right away.</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy}>Save</Button>
        </div>
      </form>
    </DummyModal>
  )
}

function SetTargetModal({ open, count, targets, busy, onClose, onSubmit }: { open: boolean; count: number; targets: string[]; busy: boolean; onClose: () => void; onSubmit: (target: string | null) => void }) {
  const [value, setValue] = useState('')
  useEffect(() => { if (open) setValue('') }, [open])
  return (
    <DummyModal open={open} title="Set Target" description={`Applies to pending and failed items among the ${count} selected. Leave empty to clear the target.`} onClose={onClose}>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(value.trim() || null) }} className="grid gap-4">
        <Input value={value} onChange={(event) => setValue(event.target.value)} maxLength={191} list="bulk-queue-targets" placeholder="Target label" />
        <datalist id="bulk-queue-targets">{targets.map((name) => <option key={name} value={name} />)}</datalist>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy}>Apply</Button>
        </div>
      </form>
    </DummyModal>
  )
}

function RescheduleModal({ open, count, busy, onClose, onSubmit }: { open: boolean; count: number; busy: boolean; onClose: () => void; onSubmit: (scheduledAt: string | null, spreadMinutes: number) => void }) {
  const [start, setStart] = useState('')
  const [spread, setSpread] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setStart(''); setSpread(''); setError('') } }, [open])

  function submit(event: FormEvent) {
    event.preventDefault()
    const spreadMinutes = spread.trim() ? Number(spread) : 0
    if (!Number.isInteger(spreadMinutes) || spreadMinutes < 0 || spreadMinutes > 10080) return setError('Spacing must be a whole number of minutes (0 to 10080).')
    if (spreadMinutes > 0 && !start) return setError('Pick a start time to space the items from.')
    onSubmit(localToIso(start), spreadMinutes)
  }

  return (
    <DummyModal open={open} title="Reschedule" description={`Applies to pending and failed items among the ${count} selected, in the order they were added.`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={labelClass}>Start at</label>
          <Input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
          <p className="mt-1.5 text-xs text-slate-500">Leave empty to clear the schedule (available right away).</p>
        </div>
        <div>
          <label className={labelClass}>Space items by (minutes)</label>
          <Input type="number" min={0} max={10080} step={1} value={spread} onChange={(event) => setSpread(event.target.value)} placeholder="0" />
        </div>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy}>Apply</Button>
        </div>
      </form>
    </DummyModal>
  )
}
