'use client'

import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { TooltipLabel } from '@/components/tooltip-label'
import { cn } from '@/lib/utils'

export function ClassPerformanceSpread() {
  const results = useAppStore((s) => s.benchmarkResults)

  const spread = useMemo(() => {
    if (results.length === 0) return null

    let allF1: number[] = []
    let allRecall: number[] = []

    for (const r of results) {
      for (const pc of r.perClassMetrics) {
        allF1.push(pc.f1)
        allRecall.push(pc.recall)
      }
    }

    const f1Spread = Math.max(...allF1) - Math.min(...allF1)
    const recallSpread = Math.max(...allRecall) - Math.min(...allRecall)

    return { f1Spread, recallSpread }
  }, [results])

  if (!spread) return null

  const metrics = [
    {
      label: 'F1 Spread',
      value: spread.f1Spread,
      tooltip: 'Difference between the best and worst class F1 scores. A large spread means some classes are much harder to classify.',
    },
    {
      label: 'Recall Spread',
      value: spread.recallSpread,
      tooltip: 'Difference between the best and worst class recall scores. A large spread means the model misses some classes far more than others.',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((m) => {
        const isHigh = m.value > 0.2
        return (
          <Card key={m.label} className={cn('border-border bg-card', isHigh && 'border-chart-4/40')}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={cn(
                'flex items-center justify-center size-8 rounded-md shrink-0',
                isHigh ? 'bg-chart-4/10' : 'bg-accent/10'
              )}>
                <Activity className={cn('size-4', isHigh ? 'text-chart-4' : 'text-accent')} />
              </div>
              <div className="min-w-0">
                <TooltipLabel
                  label={<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{m.label}</p>}
                  title={m.label}
                  explanation={m.tooltip}
                  showIcon
                  side="top"
                />
                <p className={cn(
                  'text-lg font-bold',
                  isHigh ? 'text-chart-4' : 'text-accent'
                )}>
                  {m.value.toFixed(4)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isHigh ? 'High imbalance gap' : 'Acceptable range'}
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
