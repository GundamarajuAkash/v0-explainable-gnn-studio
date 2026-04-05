'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/lib/store'
import { TooltipLabel } from '@/components/tooltip-label'
import { getMetricTooltip } from '@/lib/metrics-glossary'
import type { BenchmarkResult } from '@/lib/types'

type SortKey = keyof BenchmarkResult
type SortDir = 'asc' | 'desc'

const METRIC_COLS: { key: SortKey; label: string; higherBetter: boolean; beginner: string }[] = [
  { key: 'ACC', label: 'ACC', higherBetter: true, beginner: 'Accuracy' },
  { key: 'bACC', label: 'bACC', higherBetter: true, beginner: 'Fair Accuracy' },
  { key: 'MacroF1', label: 'MacroF1', higherBetter: true, beginner: 'Class Balance Score' },
  { key: 'ECE', label: 'ECE', higherBetter: false, beginner: 'Confidence Reliability' },
  { key: 'Brier', label: 'Brier', higherBetter: false, beginner: 'Prediction Confidence Error' },
  { key: 'WorstRecall', label: 'WorstRecall', higherBetter: true, beginner: 'Worst Class Recall' },
  { key: 'GMean', label: 'GMean', higherBetter: true, beginner: 'Minority Class Score' },
]

export function ResultsTable() {
  const results = useAppStore((s) => s.benchmarkResults)
  const [sortKey, setSortKey] = useState<SortKey>('ACC')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let data = [...results]
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(
        (r) =>
          r.model.toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q)
      )
    }
    data.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return data
  }, [results, sortKey, sortDir, searchQuery])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleCSVDownload = () => {
    if (filtered.length === 0) return
    const headers = ['Model', 'Method', ...METRIC_COLS.map((c) => c.label)]
    const rows = filtered.map((r) => [
      r.model,
      r.method,
      ...METRIC_COLS.map((c) => String(r[c.key])),
    ])
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'benchmark-results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="size-3 text-muted-foreground" />
    return sortDir === 'asc' ? (
      <ArrowUp className="size-3 text-primary" />
    ) : (
      <ArrowDown className="size-3 text-primary" />
    )
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No benchmark results yet.</p>
        <p className="text-xs mt-1">Select models and methods, then click Run Training.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search model or method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleCSVDownload}>
          <Download className="size-3" />
          CSV
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold"
                  onClick={() => toggleSort('model')}
                >
                  Model <SortIcon col="model" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold"
                  onClick={() => toggleSort('method')}
                >
                  Method <SortIcon col="method" />
                </button>
              </TableHead>
              {METRIC_COLS.map((col) => {
                const tooltip = getMetricTooltip(col.key as string)
                return (
                  <TableHead key={col.key} className="text-right">
                    <button
                      className="flex items-center gap-1 text-xs font-semibold ml-auto"
                      onClick={() => toggleSort(col.key)}
                    >
                      {tooltip ? (
                        <TooltipLabel
                          label={<span>{col.label} <span className="text-[10px] font-normal text-muted-foreground">[{col.beginner}]</span></span>}
                          title={tooltip.title}
                          explanation={tooltip.explanation}
                          showIcon
                          side="bottom"
                        />
                      ) : (
                        <>
                          {col.label} <span className="text-[10px] font-normal text-muted-foreground">[{col.beginner}]</span>
                        </>
                      )}
                      <SortIcon col={col.key} />
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row, idx) => (
              <TableRow key={idx} className="text-xs">
                <TableCell className="font-medium text-card-foreground">{row.model}</TableCell>
                <TableCell>
                  <span className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {row.method}
                  </span>
                </TableCell>
                {METRIC_COLS.map((col) => {
                  const val = row[col.key]
                  // Display string metrics directly (e.g., "0.821 ± 0.012"), format numbers
                  const display = typeof val === 'string' ? val : val.toFixed(4)
                  return (
                    <TableCell key={col.key} className="text-right font-mono tabular-nums text-card-foreground">
                      {display}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {filtered.length} of {results.length} results shown
      </p>
    </div>
  )
}
