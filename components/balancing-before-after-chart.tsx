'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BalancingBeforeAfterProps {
  method: string
  originalDistribution: Record<number, number>
  balancedDistribution: Record<number, number>
}

export function BalancingBeforeAfterChart({
  method,
  originalDistribution,
  balancedDistribution,
}: BalancingBeforeAfterProps) {
  const classLabels = Object.keys(originalDistribution).map(Number).sort((a, b) => a - b)

  const data = classLabels.map((classLabel) => ({
    class: `Class ${classLabel}`,
    Before: originalDistribution[classLabel] || 0,
    After: balancedDistribution[classLabel] || 0,
  }))

  const originalCounts = Object.values(originalDistribution)
  const balancedCounts = Object.values(balancedDistribution)
  const originalIR = Math.max(...originalCounts) / Math.min(...originalCounts)
  const balancedIR = Math.max(...balancedCounts) / Math.min(...balancedCounts)
  const irImprovement = ((originalIR - balancedIR) / originalIR * 100).toFixed(1)

  const colors = [
    'var(--color-chart-1)',
    'var(--color-chart-2)',
    'var(--color-chart-3)',
    'var(--color-chart-4)',
    'var(--color-chart-5)',
  ]

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Class Distribution Before & After {method}</CardTitle>
        <CardDescription>
          Imbalance Ratio: {originalIR.toFixed(2)} → {balancedIR.toFixed(2)} ({irImprovement}% improvement)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="class" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
              }}
              labelStyle={{ color: 'var(--foreground)' }}
              formatter={(value) => [`${value} nodes`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }} />
            <Bar dataKey="Before" fill="var(--muted)" radius={[3, 3, 0, 0]} opacity={0.7} />
            <Bar dataKey="After" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Original IR</p>
            <p className="text-lg font-semibold text-card-foreground">{originalIR.toFixed(2)}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Balanced IR</p>
            <p className="text-lg font-semibold text-card-foreground">{balancedIR.toFixed(2)}</p>
          </div>
          <div className="rounded-md bg-accent/10 p-3">
            <p className="text-xs text-muted-foreground mb-1">Improvement</p>
            <p className="text-lg font-semibold text-accent">{irImprovement}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
