'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ExplainabilityResult } from '@/lib/types'

interface FeatureImportanceChartProps {
  featureImportance: ExplainabilityResult['featureImportance']
}

export function FeatureImportanceChart({ featureImportance }: FeatureImportanceChartProps) {
  const data = featureImportance.slice(0, 10).map((f) => ({
    feature: f.feature,
    importance: f.importance,
  }))

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold text-card-foreground">
          Feature Importance (Top 10)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="feature"
                width={70}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
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
                formatter={(value: number) => [value.toFixed(4), 'Importance']}
              />
              <Bar
                dataKey="importance"
                fill="var(--color-chart-2)"
                radius={[0, 3, 3, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
