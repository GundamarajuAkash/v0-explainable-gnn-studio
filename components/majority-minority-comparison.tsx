'use client'

import { useMemo } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { TooltipLabel } from '@/components/tooltip-label'
import { cn } from '@/lib/utils'

const FAIRNESS_THRESHOLD = 0.15

export function MajorityMinorityComparison() {
  const results = useAppStore((s) => s.benchmarkResults)
  const activeDataset = useAppStore((s) => s.activeDataset)
  const getDatasetSummary = useAppStore((s) => s.getDatasetSummary)
  const summary = getDatasetSummary(activeDataset)

  const comparison = useMemo(() => {
    if (!summary || results.length === 0) return null

    const majorClassId = `C${summary.majorClass}`
    const minorClassId = `C${summary.minorClass}`

    // Average across all results
    let majorF1Sum = 0, minorF1Sum = 0
    let majorRecallSum = 0, minorRecallSum = 0
    let count = 0

    for (const r of results) {
      const major = r.perClassMetrics.find((pc) => pc.classId === majorClassId)
      const minor = r.perClassMetrics.find((pc) => pc.classId === minorClassId)
      if (major && minor) {
        majorF1Sum += major.f1
        minorF1Sum += minor.f1
        majorRecallSum += major.recall
        minorRecallSum += minor.recall
        count++
      }
    }

    if (count === 0) return null

    const majorF1 = majorF1Sum / count
    const minorF1 = minorF1Sum / count
    const majorRecall = majorRecallSum / count
    const minorRecall = minorRecallSum / count
    const f1Diff = Math.abs(majorF1 - minorF1)
    const recallDiff = Math.abs(majorRecall - minorRecall)

    return {
      majorClassId, minorClassId,
      majorF1, minorF1, f1Diff,
      majorRecall, minorRecall, recallDiff,
      f1GapHigh: f1Diff > FAIRNESS_THRESHOLD,
      recallGapHigh: recallDiff > FAIRNESS_THRESHOLD,
    }
  }, [results, summary])

  if (!comparison) return null

  const cards = [
    {
      label: 'F1 Score',
      majorVal: comparison.majorF1,
      minorVal: comparison.minorF1,
      diff: comparison.f1Diff,
      gapHigh: comparison.f1GapHigh,
      tooltip: 'Balance between precision and recall. Big gap means imbalance hurts the minority class.',
    },
    {
      label: 'Recall',
      majorVal: comparison.majorRecall,
      minorVal: comparison.minorRecall,
      diff: comparison.recallDiff,
      gapHigh: comparison.recallGapHigh,
      tooltip: 'How well the model detects each class. Big gap means the minority class is being missed.',
    },
  ]

  return (
    <Card className="border-border bg-card">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Majority vs Minority Comparison
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Average performance gap between {comparison.majorClassId} (majority) and {comparison.minorClassId} (minority) across all runs.
            </p>
          </div>
          {(comparison.f1GapHigh || comparison.recallGapHigh) && (
            <Badge variant="outline" className="border-destructive/50 bg-destructive/10 text-destructive text-[10px] gap-1">
              <AlertTriangle className="size-3" />
              High Fairness Gap
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <Card key={c.label} className={cn('border-border', c.gapHigh && 'border-destructive/30')}>
              <CardContent className="p-3">
                <TooltipLabel
                  label={<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{c.label}</p>}
                  title={c.label}
                  explanation={c.tooltip}
                  showIcon
                  side="top"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-muted-foreground">{comparison.majorClassId}</p>
                    <p className="text-base font-bold text-accent">{c.majorVal.toFixed(4)}</p>
                  </div>
                  <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                  <div className="text-center flex-1">
                    <p className="text-[10px] text-muted-foreground">{comparison.minorClassId}</p>
                    <p className="text-base font-bold text-destructive">{c.minorVal.toFixed(4)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Difference</span>
                  <span className={cn(
                    'text-xs font-semibold',
                    c.gapHigh ? 'text-destructive' : 'text-card-foreground'
                  )}>
                    {c.diff.toFixed(4)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
