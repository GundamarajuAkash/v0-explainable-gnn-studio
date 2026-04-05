'use client'

import { useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function ConfusionMatrixHeatmap() {
  const results = useAppStore((s) => s.benchmarkResults)
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')
  const [normalized, setNormalized] = useState(false)

  const models = useMemo(() => [...new Set(results.map((r) => r.model))], [results])
  const methods = useMemo(() => [...new Set(results.map((r) => r.method))], [results])

  const activeModel = selectedModel || models[0] || ''
  const activeMethod = selectedMethod || methods[0] || ''

  const activeResult = useMemo(() => {
    return results.find((r) => r.model === activeModel && r.method === activeMethod)
  }, [results, activeModel, activeMethod])

  const { matrix, classLabels, maxVal } = useMemo(() => {
    if (!activeResult) return { matrix: [] as number[][], classLabels: [] as string[], maxVal: 1 }
    const raw = activeResult.confusionMatrix
    const numC = raw.length
    const labels = Array.from({ length: numC }, (_, i) => `C${i}`)

    if (!normalized) {
      const flat = raw.flat()
      return { matrix: raw, classLabels: labels, maxVal: Math.max(...flat, 1) }
    }

    // Row-normalized
    const norm = raw.map((row) => {
      const rowSum = row.reduce((s, v) => s + v, 0)
      return rowSum > 0 ? row.map((v) => v / rowSum) : row
    })
    return { matrix: norm, classLabels: labels, maxVal: 1 }
  }, [activeResult, normalized])

  if (results.length === 0) return null

  function getCellBg(value: number, row: number, col: number) {
    const intensity = maxVal > 0 ? value / maxVal : 0
    if (row === col) {
      // Diagonal (correct) — green shades
      return `rgba(var(--color-accent-rgb, 34, 197, 94), ${0.1 + intensity * 0.6})`
    }
    // Off-diagonal (errors) — red shades
    return `rgba(var(--color-destructive-rgb, 239, 68, 68), ${intensity * 0.5})`
  }

  function getCellColor(value: number, row: number, col: number) {
    const intensity = maxVal > 0 ? value / maxVal : 0
    if (intensity > 0.6) return 'text-white'
    return 'text-card-foreground'
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Confusion Matrix
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Rows = True class, Columns = Predicted class
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
            <button
              onClick={() => setNormalized(!normalized)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                normalized
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-card-foreground border-border hover:border-primary/60'
              )}
            >
              {normalized ? 'Normalized' : 'Raw Counts'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="overflow-auto">
          <TooltipProvider>
            <div className="inline-block">
              {/* Column header */}
              <div className="flex">
                <div className="w-10 h-7 shrink-0" />
                {classLabels.map((label) => (
                  <div key={`col-${label}`} className="w-11 h-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {matrix.map((row, ri) => (
                <div key={`row-${ri}`} className="flex">
                  <div className="w-10 h-11 flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                    {classLabels[ri]}
                  </div>
                  {row.map((val, ci) => (
                    <Tooltip key={`${ri}-${ci}`}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'w-11 h-11 flex items-center justify-center text-[10px] font-mono cursor-default rounded-sm m-0.5 transition-colors',
                            getCellColor(val, ri, ci)
                          )}
                          style={{ backgroundColor: getCellBg(val, ri, ci) }}
                        >
                          {normalized ? val.toFixed(2) : val}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p><span className="font-semibold">True:</span> {classLabels[ri]}</p>
                        <p><span className="font-semibold">Predicted:</span> {classLabels[ci]}</p>
                        <p><span className="font-semibold">{normalized ? 'Proportion' : 'Count'}:</span> {normalized ? val.toFixed(4) : val}</p>
                        {!normalized && activeResult && (
                          <p><span className="font-semibold">Row %:</span> {(val / Math.max(row.reduce((s, v) => s + v, 0), 1) * 100).toFixed(1)}%</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ))}
            </div>
          </TooltipProvider>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.5)' }} />
              Correct (diagonal)
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }} />
              Misclassified (off-diagonal)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
