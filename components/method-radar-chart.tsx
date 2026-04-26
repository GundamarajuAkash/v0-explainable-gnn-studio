'use client'

import { useMemo, useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
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

const RADAR_METRICS = ['ACC', 'bACC', 'MacroF1', 'GMean'] as const
type RadarMetric = (typeof RADAR_METRICS)[number]

const METRIC_LABELS: Record<RadarMetric, string> = {
  ACC: 'Accuracy',
  bACC: 'Balanced Acc',
  MacroF1: 'Macro F1',
  GMean: 'G-Mean',
}

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

export function MethodRadarChart() {
  const results = useAppStore((s) => s.benchmarkResults)
  const comparisonMethods = useAppStore((s) => s.comparisonMethods)
  const [selectedModel, setSelectedModel] = useState('')

  const models = useMemo(() => [...new Set(results.map((r) => r.model))], [results])
  const activeModel = selectedModel || models[0] || ''

  const chartData = useMemo(() => {
    if (!activeModel) return []
    
    const modelResults = results.filter((r) => r.model === activeModel)
    
    return RADAR_METRICS.map((metric) => {
      const entry: Record<string, string | number> = { 
        metric: METRIC_LABELS[metric],
        fullMetric: metric,
      }
      
      for (const method of comparisonMethods) {
        const result = modelResults.find((r) => r.method === method)
        if (result) {
          const value = result[metric]
          entry[method] = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
        }
      }
      
      return entry
    })
  }, [activeModel, results, comparisonMethods])

  if (results.length === 0 || comparisonMethods.length === 0) {
    return null
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Method Performance Radar
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Overall comparison across key metrics
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
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarAngleAxis 
                dataKey="metric" 
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              />
              <PolarRadiusAxis 
                domain={[0, 1]} 
                tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-popover)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: 11,
                  color: 'var(--color-popover-foreground)',
                }}
                formatter={(value: number) => value.toFixed(3)}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {comparisonMethods.map((method) => (
                <Radar
                  key={method}
                  name={method}
                  dataKey={method}
                  stroke={METHOD_COLORS[method] || '#ccc'}
                  fill={METHOD_COLORS[method] || '#ccc'}
                  fillOpacity={0.15}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
