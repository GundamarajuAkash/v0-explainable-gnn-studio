'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import type { PerClassMetric } from '@/lib/types'

type SortKey = keyof PerClassMetric
type SortDir = 'asc' | 'desc'

const PER_CLASS_COLS: { key: SortKey; label: string; glossaryKey: string; higherBetter: boolean | undefined }[] = [
  { key: 'precision', label: 'Precision', glossaryKey: 'Precision', higherBetter: true },
  { key: 'recall', label: 'Recall', glossaryKey: 'Recall', higherBetter: true },
  { key: 'f1', label: 'F1 Score', glossaryKey: 'F1', higherBetter: true },
  { key: 'specificity', label: 'Specificity', glossaryKey: 'Specificity', higherBetter: true },
  { key: 'fpr', label: 'FPR', glossaryKey: 'FPR', higherBetter: false },
  { key: 'support', label: 'Support', glossaryKey: 'Support', higherBetter: undefined },
]

function getCellColor(value: number, higherBetter: boolean | undefined) {
  if (higherBetter === undefined) return ''
  if (higherBetter) {
    if (value >= 0.85) return 'bg-accent/15 text-accent'
    if (value >= 0.7) return 'bg-accent/8 text-card-foreground'
    if (value >= 0.5) return 'bg-chart-4/10 text-card-foreground'
    return 'bg-destructive/10 text-destructive'
  }
  // lower is better (FPR)
  if (value <= 0.05) return 'bg-accent/15 text-accent'
  if (value <= 0.1) return 'bg-accent/8 text-card-foreground'
  if (value <= 0.2) return 'bg-chart-4/10 text-card-foreground'
  return 'bg-destructive/10 text-destructive'
}

export function PerClassMetricsTable() {
  const results = useAppStore((s) => s.benchmarkResults)
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('classId')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const models = useMemo(() => [...new Set(results.map((r) => r.model))], [results])
  const methods = useMemo(() => [...new Set(results.map((r) => r.method))], [results])

  const activeModel = selectedModel || models[0] || ''
  const activeMethod = selectedMethod || methods[0] || ''

  const activeResult = useMemo(() => {
    return results.find((r) => r.model === activeModel && r.method === activeMethod)
  }, [results, activeModel, activeMethod])

  const sorted = useMemo(() => {
    if (!activeResult) return []
    const data = [...activeResult.perClassMetrics]
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
  }, [activeResult, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="size-3 text-muted-foreground" />
    return sortDir === 'asc' ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
  }

  if (results.length === 0) return null

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Per-Class Performance Breakdown
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Detailed metrics for each class. Color intensity: green = good, red = needs improvement.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={activeModel} onValueChange={setSelectedModel}>
              <SelectTrigger size="sm" className="w-28 h-7 text-xs">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger size="sm" className="w-28 h-7 text-xs">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="rounded-md border border-border overflow-auto max-h-72">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>
                  <button className="flex items-center gap-1 text-xs font-semibold" onClick={() => toggleSort('classId')}>
                    Class <SortIcon col="classId" />
                  </button>
                </TableHead>
                {PER_CLASS_COLS.map((col) => {
                  const tt = getMetricTooltip(col.glossaryKey)
                  return (
                    <TableHead key={col.key} className="text-right">
                      <button className="flex items-center gap-1 text-xs font-semibold ml-auto" onClick={() => toggleSort(col.key)}>
                        {tt ? (
                          <TooltipLabel label={col.label} title={tt.title} explanation={tt.explanation} showIcon side="bottom" />
                        ) : col.label}
                        <SortIcon col={col.key} />
                      </button>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.classId} className="text-xs">
                  <TableCell className="font-medium text-card-foreground">{row.classId}</TableCell>
                  {PER_CLASS_COLS.map((col) => {
                    const val = row[col.key] as number
                    const colorClass = col.key === 'support' ? '' : getCellColor(val, col.higherBetter)
                    return (
                      <TableCell key={col.key} className={`text-right font-mono tabular-nums ${colorClass} rounded-sm`}>
                        {col.key === 'support' ? val : val.toFixed(4)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
