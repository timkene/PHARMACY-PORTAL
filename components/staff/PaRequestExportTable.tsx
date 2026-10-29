'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { StaffShell } from '@/components/staff/StaffShell'
import { ApiError, loadOrdersForPaExport } from '@/lib/api'
import {
  EXPORT_COLUMNS,
  filterExportLines,
  flattenOrders,
  selectedOrFiltered,
  toCsv,
  toXlsx,
  type ExportFilters,
  type ExportLine,
} from '@/lib/pa-request-export'
import type { PaPermission } from '@/lib/pa-permissions'

const PAGE_SIZE = 25

function download(filename: string, bytes: Uint8Array, type: string) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function PaRequestExportTable({ userName, permissions = [] }: {
  userName: string
  permissions?: readonly PaPermission[]
}) {
  const [lines, setLines] = useState<ExportLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<ExportFilters>({ from: '', to: '', provider: '', enrollee: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const orders = await loadOrdersForPaExport()
      setLines(flattenOrders(orders))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load pharmacy requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => filterExportLines(lines, filters), [lines, filters])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const outgoing = selectedOrFiltered(filtered, selected)
  const requestCount = new Set(filtered.map(line => line.orderId)).size

  const toggle = (key: string) => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportFile = (kind: 'csv' | 'xlsx') => {
    const stamp = new Date().toISOString().slice(0, 10)
    if (kind === 'csv') {
      download(`pharmacy-pa-requests-${stamp}.csv`, new TextEncoder().encode(toCsv(outgoing)), 'text/csv;charset=utf-8')
    } else {
      download(`pharmacy-pa-requests-${stamp}.xlsx`, toXlsx(outgoing), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    }
  }

  return (
    <StaffShell userName={userName} permissions={permissions}>
      <div className="p-8">
        <h1 className="text-headline-lg font-semibold text-on-surface mb-2">PA Request Export</h1>
        <p className="text-body-lg text-on-surface-variant mb-6">
          One row per requested procedure. Exports contain only the seven confirmed columns.
        </p>
        <form className="grid gap-4 md:grid-cols-4 mb-4" onSubmit={event => event.preventDefault()}>
          <label className="text-body-sm text-on-surface">Date from
            <input type="date" className="mt-1 w-full border border-outline-variant rounded px-3 py-2" value={filters.from ?? ''}
              onChange={event => { setPage(0); setFilters(current => ({ ...current, from: event.target.value })) }} />
          </label>
          <label className="text-body-sm text-on-surface">Date to
            <input type="date" className="mt-1 w-full border border-outline-variant rounded px-3 py-2" value={filters.to ?? ''}
              onChange={event => { setPage(0); setFilters(current => ({ ...current, to: event.target.value })) }} />
          </label>
          <label className="text-body-sm text-on-surface">Provider
            <input className="mt-1 w-full border border-outline-variant rounded px-3 py-2" value={filters.provider ?? ''}
              onChange={event => { setPage(0); setFilters(current => ({ ...current, provider: event.target.value })) }} />
          </label>
          <label className="text-body-sm text-on-surface">Enrollee
            <input className="mt-1 w-full border border-outline-variant rounded px-3 py-2" value={filters.enrollee ?? ''}
              onChange={event => { setPage(0); setFilters(current => ({ ...current, enrollee: event.target.value })) }} />
          </label>
        </form>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <p className="text-body-sm text-on-surface-variant">
            {requestCount} requests · {filtered.length} procedure rows
            {selected.size ? ` · ${selected.size} selected` : ' · export uses all filtered rows'}
          </p>
          <button type="button" className="text-body-sm underline" onClick={() => setSelected(new Set(filtered.map(line => line.key)))}>
            Select all matching
          </button>
          <button type="button" className="text-body-sm underline" onClick={() => setSelected(new Set())}>Clear selection</button>
          <button type="button" className="ml-auto border border-outline-variant rounded px-3 py-2 text-body-sm" onClick={() => exportFile('csv')} disabled={!outgoing.length}>
            Download CSV
          </button>
          <button type="button" className="border border-outline-variant rounded px-3 py-2 text-body-sm" onClick={() => exportFile('xlsx')} disabled={!outgoing.length}>
            Download Excel
          </button>
        </div>
        {error ? <p role="alert" className="text-error mb-4">{error}</p> : null}
        <div className="overflow-x-auto border border-outline-variant rounded">
          <table className="min-w-full text-body-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="px-3 py-2 text-left"><span className="sr-only">Select</span></th>
                {EXPORT_COLUMNS.map(column => <th key={column} className="px-3 py-2 text-left whitespace-nowrap">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-6">Loading pharmacy requests…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6">No matching procedure rows.</td></tr>
              ) : visible.map(line => (
                <tr key={line.key} className="border-t border-outline-variant">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(line.key)} onChange={() => toggle(line.key)} aria-label={`Select ${line.enrolleeId}`} />
                  </td>
                  {EXPORT_COLUMNS.map(column => (
                    <td key={column} className="px-3 py-2 whitespace-nowrap font-mono">{line.cells[column] || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button type="button" disabled={currentPage <= 0} onClick={() => setPage(current => Math.max(0, current - 1))} className="text-body-sm underline disabled:no-underline disabled:opacity-40">Previous</button>
          <span className="text-body-sm">Page {currentPage + 1} of {totalPages}</span>
          <button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(current => current + 1)} className="text-body-sm underline disabled:no-underline disabled:opacity-40">Next</button>
        </div>
      </div>
    </StaffShell>
  )
}
