'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import type { TrainingCurveSeries } from '@/lib/types'

// Consistent color palette per series index
const SERIES_COLORS = [
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
]

interface CurveChartProps {
  curves: TrainingCurveSeries[]
  metric: 'loss' | 'valAcc'
  title: string
  subtitle: string
  formatter: (v: number) => string
  domain?: [number, number]
}

function CurveChart({ curves, metric, title, subtitle, formatter, domain }: CurveChartProps) {
  // Pivot: array of {epoch, [key]: value}
  const epochs = curves[0]?.points.length ?? 20
  const data = Array.from({ length: epochs }, (_, i) => {
    const pt: Record<string, number> = { epoch: i + 1 }
    curves.forEach((s) => {
      pt[s.key] = s.points[i]?.[metric] ?? 0
    })
    return pt
  })

  const finalVal = curves[0]?.points[epochs - 1]?.[metric]

  return (
    <Card className="flex-1 min-w-0 border-border bg-card">
      <CardHeader className="py-3 px-4 pb-1">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">{title}</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          {finalVal !== undefined && (
            <span className="text-sm font-bold text-primary">
              {formatter(finalVal)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-2">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
            <XAxis
              dataKey="epoch"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              label={{ value: `Epoch ${epochs}`, position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'var(--muted-foreground)' }}
              ticks={[1, epochs]}
              tickFormatter={(v) => v === 1 ? `Epoch 1` : ''}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              domain={domain}
              tickFormatter={(v) => formatter(v)}
              width={38}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: 11,
              }}
              labelFormatter={(v) => `Epoch ${v}`}
              formatter={(val: number, name: string) => [formatter(val), name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
              formatter={(val) => <span style={{ color: 'var(--muted-foreground)' }}>{val}</span>}
            />
            {curves.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={1.8}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TrainingCurvesPanel() {
  const curves = useAppStore((s) => s.trainingCurves)

  if (curves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No training data yet.</p>
        <p className="text-xs mt-1">Run training from the Training &amp; Results tab to generate curves.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-card-foreground uppercase tracking-wide">
          Training Curves
        </h2>
        <span className="text-xs text-muted-foreground">{curves.length} model/method combinations</span>
      </div>
      <div className="flex gap-4">
        <CurveChart
          curves={curves}
          metric="loss"
          title="Loss vs Epoch"
          subtitle="Cross-entropy loss"
          formatter={(v) => v.toFixed(3)}
          domain={[0, 2]}
        />
        <CurveChart
          curves={curves}
          metric="valAcc"
          title="Validation Accuracy vs Epoch"
          subtitle="Node classification"
          formatter={(v) => `${(v * 100).toFixed(1)}%`}
          domain={[0, 1]}
        />
      </div>
    </div>
  )
}
