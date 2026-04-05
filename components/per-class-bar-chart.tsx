'use client'

import { useState, useMemo } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'

const METRIC_OPTIONS = [
  { key: 'precision', label: 'Precision' },
  { key: 'recall', label: 'Recall' },
  { key: 'f1', label: 'F1 Score' },
  { key: 'specificity', label: 'Specificity' },
] as const

type MetricKey = (typeof METRIC_OPTIONS)[number]['key']

export function PerClassBarChart() {
  const results = useAppStore((s) => s.benchmarkResults)
  const [metric, setMetric] = useState<MetricKey>('f1')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedMethod, setSelectedMethod] = useState('')

  const models = useMemo(() => [...new Set(results.map((r) => r.model))], [results])
  const methods = useMemo(() => [...new Set(results.map((r) => r.method))], [results])

  const activeModel = selectedModel || models[0] || ''
  const activeMethod = selectedMethod || methods[0] || ''

  const activeResult = useMemo(() => {
    return results.find((r) => r.model === activeModel && r.method === activeMethod)
  }, [results, activeModel, activeMethod])

  const chartData = useMemo(() => {
    if (!activeResult) return []
    return activeResult.perClassMetrics.map((pc) => ({
      class: pc.classId,
      Precision: pc.precision,
      Recall: pc.recall,
      'F1 Score': pc.f1,
    }))
  }, [activeResult])

  const singleMetricData = useMemo(() => {
    if (!activeResult) return []
    return activeResult.perClassMetrics.map((pc) => ({
      class: pc.classId,
      value: pc[metric],
    }))
  }, [activeResult, metric])

  if (results.length === 0) return null

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Per-Class Metric Visualization
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Grouped bars showing Precision, Recall, F1 per class — or select a single metric.
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
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger size="sm" className="w-28 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key} className="text-xs">{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'f1' ? (
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="class" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: 12, color: 'var(--color-popover-foreground)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Precision" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Recall" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="F1 Score" fill="var(--color-chart-3)" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            ) : (
              <BarChart data={singleMetricData} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="class" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: 12, color: 'var(--color-popover-foreground)' }} />
                <Bar dataKey="value" name={METRIC_OPTIONS.find((o) => o.key === metric)?.label ?? metric} fill="var(--color-chart-4)" radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
