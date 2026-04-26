'use client'

import { useMemo, useState } from 'react'
import {
  ScatterChart,
  Scatter,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'

const METHOD_COLORS: Record<string, string> = {
  baseline: '#3b82f6',
  weighted: '#f59e0b',
  focal: '#10b981',
  oversample: '#ef4444',
  undersample: '#8b5cf6',
  nodeimport: '#06b6d4',
  svwng: '#ec4899',
  smote: '#6366f1',
  reweight: '#14b8a6',
  ens: '#f97316',
  cbdro: '#84cc16',
}

export function ImbalancePerformanceChart() {
  const results = useAppStore((s) => s.benchmarkResults)
  const comparisonMethods = useAppStore((s) => s.comparisonMethods)
  const dataset = useAppStore((s) => s.activeDataset)
  const getDatasetSummary = useAppStore((s) => s.getDatasetSummary)
  const [selectedModel, setSelectedModel] = useState('')

  const models = useMemo(() => [...new Set(results.map((r) => r.model))], [results])
  const activeModel = selectedModel || models[0] || ''

  const summary = getDatasetSummary(dataset)
  const classCounts = summary?.classCounts || []

  const chartData = useMemo(() => {
    if (!activeModel || classCounts.length === 0) return []

    const data: Array<{
      method: string
      support: number
      f1: number
      model: string
    }> = []

    // Calculate average support per class (normalized by total)
    const totalSupport = classCounts.reduce((sum, c) => sum + c.count, 0)
    const avgSupport = totalSupport / (classCounts.length || 1)

    const modelResults = results.filter((r) => r.model === activeModel)

    for (const method of comparisonMethods) {
      const result = modelResults.find((r) => r.method === method)
      if (result && result.perClassMetrics.length > 0) {
        // Calculate weighted average support and F1
        const perClass = result.perClassMetrics

        // Average support from per-class metrics
        const avgClassSupport = perClass.reduce((sum, pc) => sum + pc.support, 0) / perClass.length

        // MacroF1 represents overall class-balanced F1
        data.push({
          method,
          support: avgClassSupport / avgSupport, // Normalized support metric
          f1: result.MacroF1,
          model: activeModel,
        })
      }
    }

    return data
  }, [activeModel, results, comparisonMethods, classCounts])

  if (results.length === 0 || comparisonMethods.length === 0 || classCounts.length === 0) {
    return null
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Class Imbalance vs Performance
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Average support vs Macro F1 score by method
            </p>
          </div>
          <Select value={activeModel} onValueChange={setSelectedModel}>
            <SelectTrigger size="sm" className="w-32 h-7 text-xs">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="support"
                name="Normalized Support"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
                label={{ value: 'Support (Normalized)', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                dataKey="f1"
                name="Macro F1"
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
                  fontSize: 11,
                  color: 'var(--color-popover-foreground)',
                }}
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number) => value.toFixed(3)}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {comparisonMethods.map((method) => (
                <Scatter
                  key={method}
                  name={method}
                  data={chartData.filter((d) => d.method === method)}
                  fill={METHOD_COLORS[method] || '#ccc'}
                  fillOpacity={0.7}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
