'use client'

import { useMemo } from 'react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { MODELS } from '@/lib/types'

// One color per method slot (up to 7 methods)
const METHOD_FIDELITY_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'hsl(280 70% 60%)',
  'hsl(30 90% 55%)',
  'hsl(160 60% 45%)',
]
const METHOD_COVERAGE_COLORS = [
  'var(--color-chart-3)',
  'hsl(200 70% 55%)',
  'hsl(340 65% 55%)',
  'hsl(60 80% 50%)',
  'hsl(100 55% 45%)',
  'hsl(20 80% 55%)',
  'hsl(250 60% 60%)',
]

const METHOD_SPARSITY_COLORS = [
  'hsl(120 65% 50%)',
  'hsl(180 70% 50%)',
  'hsl(220 80% 55%)',
  'hsl(270 75% 55%)',
  'hsl(330 70% 55%)',
  'hsl(40 85% 55%)',
  'hsl(150 75% 50%)',
]

export function ExplainabilityComparisonChart() {
  const activeDataset = useAppStore((s) => s.activeDataset)
  const explainMethods = useAppStore((s) => s.explainMethods)

  const chartData = useMemo(() => {
    if (!activeDataset || explainMethods.length === 0) return []
    
    // Create sample data showing explainability metrics across methods
    // In a real app, this would load from the explainer JSON files
    return MODELS.map((model) => {
      const row: Record<string, string | number> = { model }
      explainMethods.forEach((method, idx) => {
        // Mock data - replace with real data from store if available
        const fidelity = 0.7 + Math.random() * 0.25
        const sparsity = 0.3 + Math.random() * 0.4
        const coverage = 0.6 + Math.random() * 0.35
        row[`Fidelity_${method}`] = Math.round(fidelity * 100) / 100
        row[`Sparsity_${method}`] = Math.round(sparsity * 100) / 100
        row[`Coverage_${method}`] = Math.round(coverage * 100) / 100
      })
      return row
    })
  }, [activeDataset, explainMethods])

  if (!activeDataset || chartData.length === 0) return null

  const methodLabel = explainMethods.length === 1
    ? explainMethods[0]
    : `${explainMethods.length} methods`

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold text-card-foreground">
          Explainability Metrics Across Models ({methodLabel})
        </CardTitle>
        {explainMethods.length > 1 && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Blue bars = Fidelity, Green bars = Sparsity, Red bars = Coverage — grouped by model
          </p>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {explainMethods.flatMap((method, i) => [
                <Bar
                  key={`fidelity-${method}`}
                  dataKey={`Fidelity_${method}`}
                  name={`Fidelity (${method})`}
                  fill={METHOD_FIDELITY_COLORS[i % METHOD_FIDELITY_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />,
                <Bar
                  key={`sparsity-${method}`}
                  dataKey={`Sparsity_${method}`}
                  name={`Sparsity (${method})`}
                  fill={METHOD_SPARSITY_COLORS[i % METHOD_SPARSITY_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />,
                <Bar
                  key={`coverage-${method}`}
                  dataKey={`Coverage_${method}`}
                  name={`Coverage (${method})`}
                  fill={METHOD_COVERAGE_COLORS[i % METHOD_COVERAGE_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={20}
                />,
              ])}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
