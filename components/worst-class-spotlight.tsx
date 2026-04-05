'use client'

import { useMemo } from 'react'
import { TrendingDown, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { TooltipLabel } from '@/components/tooltip-label'

export function WorstClassSpotlight() {
  const results = useAppStore((s) => s.benchmarkResults)

  const worst = useMemo(() => {
    if (results.length === 0) return null

    let worstRecallClass = ''
    let worstRecallValue = 1
    let worstF1Class = ''
    let worstF1Value = 1

    for (const r of results) {
      for (const pc of r.perClassMetrics) {
        if (pc.recall < worstRecallValue) {
          worstRecallValue = pc.recall
          worstRecallClass = pc.classId
        }
        if (pc.f1 < worstF1Value) {
          worstF1Value = pc.f1
          worstF1Class = pc.classId
        }
      }
    }

    return { worstRecallClass, worstRecallValue, worstF1Class, worstF1Value }
  }, [results])

  if (!worst) return null

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-md bg-amber-100 dark:bg-amber-900/30 shrink-0">
            <TrendingDown className="size-4 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="min-w-0">
            <TooltipLabel
              label={<p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-medium">Lowest Recall Class</p>}
              title="Lowest Recall"
              explanation="The class that the model misses the most. Low recall means many real samples are not being detected."
              showIcon
              side="top"
            />
            <p className="text-base font-semibold text-foreground truncate">{worst.worstRecallClass}</p>
            <p className="text-xs text-muted-foreground">
              Recall: <span className="font-medium text-amber-600 dark:text-amber-500">{worst.worstRecallValue.toFixed(4)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-md bg-orange-100 dark:bg-orange-900/30 shrink-0">
            <Target className="size-4 text-orange-600 dark:text-orange-500" />
          </div>
          <div className="min-w-0">
            <TooltipLabel
              label={<p className="text-[10px] uppercase tracking-wider text-orange-700 dark:text-orange-400 font-medium">Lowest F1 Class</p>}
              title="Lowest F1"
              explanation="The class with the lowest balance of precision and recall. This class may need the most improvement."
              showIcon
              side="top"
            />
            <p className="text-base font-semibold text-foreground truncate">{worst.worstF1Class}</p>
            <p className="text-xs text-muted-foreground">
              F1: <span className="font-medium text-orange-600 dark:text-orange-500">{worst.worstF1Value.toFixed(4)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
