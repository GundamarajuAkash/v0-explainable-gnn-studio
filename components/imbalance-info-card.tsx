'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const CLASS_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-primary)',
  'var(--color-accent)',
  'var(--color-muted-foreground)',
  'var(--color-chart-1)',
  'var(--color-chart-2)',
]

export function ImbalanceInfoCard() {
  const activeDataset = useAppStore((s) => s.activeDataset)
  const getDatasetSummary = useAppStore((s) => s.getDatasetSummary)
  const summary = getDatasetSummary(activeDataset)

  if (!summary) return null

  // classCounts is an array of {classId, count} objects
  const chartData = summary.classCounts.map((item) => ({
    class: `Class ${item.classId}`,
    count: item.count,
    classIdx: item.classId,
  }))

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-semibold text-card-foreground">
          Dataset Imbalance
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="flex flex-col items-center rounded-md bg-secondary/50 p-2">
            <span className="text-[10px] text-muted-foreground">Major</span>
            <Badge variant="secondary" className="mt-0.5 text-xs">
              {summary.majorClass}
            </Badge>
          </div>
          <div className="flex flex-col items-center rounded-md bg-secondary/50 p-2">
            <span className="text-[10px] text-muted-foreground">Minor</span>
            <Badge variant="secondary" className="mt-0.5 text-xs">
              {summary.minorClass}
            </Badge>
          </div>
          <div className="flex flex-col items-center rounded-md bg-secondary/50 p-2">
            <span className="text-[10px] text-muted-foreground">Ratio</span>
            <span className="mt-0.5 text-xs font-semibold text-card-foreground">
              {summary.imbalanceRatio}x
            </span>
          </div>
        </div>

        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="class"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <YAxis
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
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={CLASS_COLORS[entry.classIdx % CLASS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
