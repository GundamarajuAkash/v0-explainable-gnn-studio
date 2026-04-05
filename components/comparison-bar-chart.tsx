'use client'

import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { METHODS } from '@/lib/types'

const METRICS = ['ACC', 'bACC', 'MacroF1', 'ECE', 'Brier', 'GMean', 'WorstRecall'] as const
type Metric = (typeof METRICS)[number]

const METRIC_INFO: Record<Metric, { label: string; beginner: string }> = {
  ACC: { label: 'ACC', beginner: 'Accuracy' },
  bACC: { label: 'bACC', beginner: 'Fair Accuracy' },
  MacroF1: { label: 'MacroF1', beginner: 'Class Balance Score' },
  ECE: { label: 'ECE', beginner: 'Confidence Reliability' },
  Brier: { label: 'Brier', beginner: 'Prediction Confidence Error' },
  GMean: { label: 'GMean', beginner: 'Minority Class Score' },
  WorstRecall: { label: 'WorstRecall', beginner: 'Worst Class Recall' },
}

const METHOD_COLORS: Record<string, string> = {
  baseline: 'var(--color-chart-1)',
  weighted: 'var(--color-chart-2)',
  focal: 'var(--color-chart-3)',
  oversample: 'var(--color-chart-4)',
  undersample: 'var(--color-chart-5)',
  nodeimport: 'var(--color-primary)',
  svwng: 'var(--color-accent)',
}

export function ComparisonBarChart() {
  const results = useAppStore((s) => s.benchmarkResults)
  const comparisonMethods = useAppStore((s) => s.comparisonMethods)
  const setComparisonMethods = useAppStore((s) => s.setComparisonMethods)
  const [metric, setMetric] = useState<Metric>('ACC')

  const availableMethods = useMemo(() => {
    return [...new Set(results.map((r) => r.method))]
  }, [results])

  const chartData = useMemo(() => {
    if (results.length === 0 || comparisonMethods.length === 0) return []

    const models = [...new Set(results.map((r) => r.model))]
    const data = models.map((model) => {
      const entry: Record<string, string | number> = { model }
      for (const method of comparisonMethods) {
        const row = results.find((r) => r.model === model && r.method === method)
        if (row) {
          const value = row[metric]
          // Ensure value is a valid number, not NaN or undefined
          entry[method] = Number.isFinite(value) ? value : 0
        }
      }
      return entry
    })
    
    // Filter out entries with all NaN/0 values
    return data.filter(entry => 
      comparisonMethods.some(m => Number.isFinite(entry[m]) && entry[m] !== 0)
    )
  }, [results, comparisonMethods, metric])

  const toggleMethod = (method: string) => {
    if (comparisonMethods.includes(method)) {
      if (comparisonMethods.length > 1) {
        setComparisonMethods(comparisonMethods.filter((m) => m !== method))
      }
    } else {
      setComparisonMethods([...comparisonMethods, method])
    }
  }

  if (results.length === 0) {
    return null
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            Method Comparison
          </CardTitle>
          <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <SelectTrigger size="sm" className="w-32 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m} [{METRIC_INFO[m].beginner}]
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="flex flex-wrap gap-3 mb-3">
          {(availableMethods.length > 0 ? availableMethods : METHODS as unknown as string[]).map(
            (method) => (
              <div key={method} className="flex items-center gap-1.5">
                <Checkbox
                  id={`cmp-${method}`}
                  checked={comparisonMethods.includes(method)}
                  onCheckedChange={() => toggleMethod(method)}
                  className="size-3.5"
                />
                <Label htmlFor={`cmp-${method}`} className="text-xs text-card-foreground cursor-pointer">
                  {method}
                </Label>
              </div>
            )
          )}
        </div>

        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="model"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: 12,
                    color: 'var(--color-popover-foreground)',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                />
                {comparisonMethods.map((method) => (
                  <Bar
                    key={method}
                    dataKey={method}
                    fill={METHOD_COLORS[method] || 'var(--color-chart-1)'}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">
            Select methods above to compare.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
