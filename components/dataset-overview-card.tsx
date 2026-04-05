'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { Network, GitBranch, Zap, TrendingUp, TrendingDown, Layers, Gauge } from 'lucide-react'
import { TooltipLabel } from '@/components/tooltip-label'
import { getDatasetStatTooltip } from '@/lib/metrics-glossary'

const CLASS_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
]

export function DatasetOverviewCard() {
  const activeDataset = useAppStore((s) => s.activeDataset)
  const getDatasetSummary = useAppStore((s) => s.getDatasetSummary)
  const summary = getDatasetSummary(activeDataset)

  if (!summary) return null

  const getBalanceStatusColor = () => {
    switch (summary.balanceStatus) {
      case 'balanced':
        return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
      case 'imbalanced':
        return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
      case 'highly_imbalanced':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900'
    }
  }

  const getBalanceStatusText = () => {
    switch (summary.balanceStatus) {
      case 'balanced': return 'Balanced'
      case 'imbalanced': return 'Imbalanced'
      case 'highly_imbalanced': return 'Highly Imbalanced'
    }
  }

  const statLabel = (key: string, fallback: string) => {
    const tt = getDatasetStatTooltip(key)
    if (!tt) return <p className="text-xs text-muted-foreground uppercase tracking-wide">{fallback}</p>
    return (
      <TooltipLabel
        label={<p className="text-xs text-muted-foreground uppercase tracking-wide">{fallback}</p>}
        title={tt.title}
        explanation={tt.explanation}
        showIcon
        side="right"
      />
    )
  }

  // Prepare class distribution data for stacked bar
  // Handle both array format [{classId, count}] and object format {classId: count}
  const classEntries = Array.isArray(summary.classCounts)
    ? summary.classCounts
        .sort((a, b) => a.classId - b.classId)
        .map((item) => ({
          classIdx: item.classId,
          count: item.count,
          label: summary.classNames?.[item.classId] || `Class_${item.classId}`,
        }))
    : Object.entries(summary.classCounts)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .map(([classIdx, count]) => ({
          classIdx: parseInt(classIdx),
          count: count as number,
          label: summary.classNames?.[parseInt(classIdx)] || `Class_${classIdx}`,
        }))

  const totalNodes = classEntries.reduce((sum, c) => sum + c.count, 0)
  
  // Get actual class names for major/minor
  const majorClassName = summary.classNames?.[summary.majorClass] || `Class_${summary.majorClass}`
  const minorClassName = summary.classNames?.[summary.minorClass] || `Class_${summary.minorClass}`

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        {/* Header with title and badges */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-card-foreground">{summary.name}</h2>
          <div className="flex gap-2">
            {summary.isBuiltIn && <Badge variant="outline">Built-in</Badge>}
            <TooltipLabel
              label={
                <Badge variant="outline" className={getBalanceStatusColor()}>
                  {getBalanceStatusText()}
                </Badge>
              }
              title={getDatasetStatTooltip('balanceStatus')?.title ?? 'Balance Status'}
              explanation={getDatasetStatTooltip('balanceStatus')?.explanation ?? ''}
              showIcon={false}
              side="bottom"
            />
          </div>
        </div>

        {/* Top metrics grid - 3 columns */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Column 1 */}
          <div className="space-y-3">
            {/* Nodes */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                <Network className="w-3 h-3 text-primary" />
              </div>
              <div className="min-w-0">
                {statLabel('numNodes', 'Nodes')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.numNodes != null ? summary.numNodes.toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* Classes */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                <GitBranch className="w-3 h-3 text-primary" />
              </div>
              <div className="min-w-0">
                {statLabel('numClasses', 'Classes')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.numClasses}
                </p>
              </div>
            </div>

            {/* Feature Dimension */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 shrink-0 mt-0.5">
                <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-500" />
              </div>
              <div className="min-w-0">
                {statLabel('featureDimension', 'Features')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.featureDimension || summary.numFeatures || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Column 2 */}
          <div className="space-y-3">
            {/* Edges */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-accent/10 shrink-0 mt-0.5">
                <GitBranch className="w-3 h-3 text-accent rotate-90" />
              </div>
              <div className="min-w-0">
                {statLabel('numEdges', 'Edges')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.numEdges != null ? summary.numEdges.toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* Density */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 shrink-0 mt-0.5">
                <Gauge className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
              </div>
              <div className="min-w-0">
                {statLabel('density', 'Density')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.density != null ? (summary.density * 100).toFixed(3) : 'N/A'}%
                </p>
              </div>
            </div>

            {/* Avg Degree */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-cyan-100 dark:bg-cyan-900/30 shrink-0 mt-0.5">
                <TrendingUp className="w-3 h-3 text-cyan-600 dark:text-cyan-500" />
              </div>
              <div className="min-w-0">
                {statLabel('avgDegree', 'Avg Degree')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.avgDegree != null ? summary.avgDegree.toFixed(2) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Column 3 */}
          <div className="space-y-3">
            {/* Imbalance Ratio */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-100 dark:bg-amber-900/30 shrink-0 mt-0.5">
                <Zap className="w-3 h-3 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="min-w-0">
                {statLabel('IR', 'IR [Imbalance]')}
                <p className="text-base font-semibold text-card-foreground">
                  {summary.imbalanceRatio != null ? summary.imbalanceRatio.toFixed(2) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Major class */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-chart-1/10 shrink-0 mt-0.5">
                <TrendingUp className="w-3 h-3 text-chart-1" />
              </div>
              <div className="min-w-0">
                {statLabel('majorClass', 'Major')}
                <p className="text-sm font-semibold text-card-foreground truncate" title={majorClassName}>
                  {majorClassName}
                </p>
              </div>
            </div>

            {/* Minor class */}
            <div className="flex items-start gap-2">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-destructive/10 shrink-0 mt-0.5">
                <TrendingDown className="w-3 h-3 text-destructive" />
              </div>
              <div className="min-w-0">
                {statLabel('minorClass', 'Minor')}
                <p className="text-sm font-semibold text-card-foreground truncate" title={minorClassName}>
                  {minorClassName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Class Distribution Section */}
        <div>
          <div className="mb-3">
            {statLabel('classDistribution', 'Class Distribution')}
          </div>

          {/* Horizontal stacked bar */}
          <div className="mb-3 h-6 flex rounded-sm overflow-hidden border border-border">
            {classEntries.map((entry) => {
              const percentage = (entry.count / totalNodes) * 100
              return (
                <div
                  key={entry.classIdx}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: CLASS_COLORS[entry.classIdx % CLASS_COLORS.length],
                  }}
                  className="transition-opacity hover:opacity-80"
                  title={`${entry.label}: ${entry.count}`}
                />
              )
            })}
          </div>

          {/* Legend - class labels and counts */}
          <div className="flex flex-wrap gap-3 text-xs">
            {classEntries.map((entry) => (
              <div key={entry.classIdx} className="flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: CLASS_COLORS[entry.classIdx % CLASS_COLORS.length],
                  }}
                />
                <span className="text-muted-foreground">
                  {entry.label}: {entry.count != null ? entry.count.toLocaleString() : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
