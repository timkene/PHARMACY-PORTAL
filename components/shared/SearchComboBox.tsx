'use client'
import { useState, useRef, useEffect, useCallback, CSSProperties } from 'react'
import type { SearchResult } from '@/lib/types'

const INPUT_CLS =
  'w-full border border-outline-variant rounded px-3 py-2 text-body-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 bg-transparent'

interface SearchComboBoxProps {
  placeholder?: string
  onSearch: (q: string) => Promise<SearchResult[]>
  onSelect: (result: SearchResult) => void
  displayValue?: string
  disabled?: boolean
}

export function SearchComboBox({
  placeholder,
  onSearch,
  onSelect,
  displayValue,
  disabled,
}: SearchComboBoxProps) {
  const [query, setQuery] = useState(displayValue ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setQuery(displayValue ?? '')
  }, [displayValue])

  const positionDropdown = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }, [])

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([])
        setOpen(false)
        return
      }
      setLoading(true)
      try {
        const res = await onSearch(q)
        setResults(res)
        setOpen(res.length > 0)
        positionDropdown()
      } catch {
        setResults([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    },
    [onSearch, positionDropdown]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => runSearch(q), 300)
  }

  const handleSelect = (result: SearchResult) => {
    setQuery(`${result.code} — ${result.label}`)
    setOpen(false)
    onSelect(result)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!inputRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        className={INPUT_CLS}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        onFocus={() => {
          positionDropdown()
          if (results.length > 0) setOpen(true)
        }}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">
          searching…
        </span>
      )}
      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-surface-lowest border border-outline-variant rounded shadow-lg max-h-56 overflow-y-auto"
        >
          {results.map(r => (
            <button
              key={r.code}
              type="button"
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-surface-container transition-colors"
              onMouseDown={() => handleSelect(r)}
            >
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-label-sm bg-primary/10 text-primary font-mono shrink-0 max-w-[120px] truncate">
                {r.code}
              </span>
              <span className="text-body-sm text-on-surface truncate">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
