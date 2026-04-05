'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { TooltipLabel, MethodLabel } from '@/components/tooltip-label'
import { getDatasetStatTooltip, getBalancingMethodTooltip } from '@/lib/metrics-glossary'
import { getBalancedDistribution } from '@/lib/balancing-methods'
import { METHODS } from '@/lib/types'

const CLASS_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#f97316',
]

interface Props {
  mode: 'before' | 'after'
}

export function BalancingDistributionTab({ mode }: Props) {
  const activeDataset = useAppStore((s) => s.activeDataset)
  const getDatasetSummary = useAppStore((s) => s.getDatasetSummary)
  const summary = getDatasetSummary(activeDataset)

  // Local method selector — only used in "after" mode
  const [selectedMethod, setSelectedMethod] = useState<string>('oversample')

  if (!summary) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        No dataset loaded.
      </div>
    )
  }

  // Convert classCounts array to object format {classId: count}
  const originalCounts = Array.isArray(summary.classCounts)
    ? summary.classCounts.reduce((acc, { classId, count }) => {
        acc[classId] = count
        return acc
      }, {} as Record<number, number>)
    : summary.classCounts
  const activeMethod = mode === 'after' ? selectedMethod : 'baseline'
  const balancedCounts =
    mode === 'after' ? getBalancedDistribution(originalCounts, activeMethod) : originalCounts

  const displayCounts = balancedCounts
  const labels = Object.keys(displayCounts).map(Number).sort((a, b) => a - b)
  
  // Use actual class names if available
  const classNames = summary.classNames || labels.map((l) => `Class ${l}`)

  const chartData = labels.map((l, idx) => ({
    class: classNames[l] || classNames[idx] || `Class ${l}`,
    count: displayCounts[l],
    label: l,
  }))

  const counts = Object.values(displayCounts)
  
  // Guard against empty or invalid counts
  if (counts.length === 0 || counts.some(c => !Number.isFinite(c))) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        No valid distribution data available.
      </div>
    )
  }
  
  const maxCount = Math.max(...counts)
  const minCount = Math.min(...counts)
  const ir = parseFloat((maxCount / minCount).toFixed(2))
  const originalIR = summary.imbalanceRatio ?? ir
  const irImprovement =
    mode === 'after' && originalIR > ir
      ? `${(((originalIR - ir) / originalIR) * 100).toFixed(1)}% better`
      : null

  const getBalanceLabel = (ratio: number) => {
    if (ratio < 1.5) return { label: 'Balanced', className: 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400' }
    if (ratio < 3) return { label: 'Imbalanced', className: 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400' }
    return { label: 'Highly Imbalanced', className: 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400' }
  }

  const balance = getBalanceLabel(ir)
  const irTooltip = getDatasetStatTooltip('IR')

  return (
    <div className="space-y-4">
      {/* Method selector — After mode only */}
      {mode === 'after' && (
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Select Balancing Method
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose a technique to see how it transforms the class distribution.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="flex flex-wrap gap-2">
              {METHODS.map((method) => {
                const tt = getBalancingMethodTooltip(method)
                const isActive = selectedMethod === method
                return (
                  <TooltipLabel
                    key={method}
                    label={
                      <button
                        onClick={() => setSelectedMethod(method)}
                        className={[
                          'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : method === 'svwng'
                              ? 'bg-primary/5 text-primary border-primary/40 hover:border-primary hover:bg-primary/10'
                              : 'bg-card text-card-foreground border-border hover:border-primary/60 hover:bg-primary/5',
                        ].join(' ')}
                      >
                        <MethodLabel method={method} className={isActive ? 'text-primary-foreground [&_span]:text-primary-foreground [&_span]:border-primary-foreground/40 [&_span]:bg-primary-foreground/10' : ''} />
                      </button>
                    }
                    title={tt?.title ?? method}
                    explanation={tt?.explanation ?? ''}
                    side="bottom"
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-card-foreground">
            {mode === 'before'
              ? 'Class Distribution — Before Balancing'
              : `Class Distribution — After Applying "${selectedMethod}"`}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mode === 'before'
              ? 'Original imbalanced dataset distribution'
              : `Estimated distribution after applying the "${selectedMethod}" balancing technique`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={balance.className}>
            {balance.label}
          </Badge>
          {mode === 'after' && irImprovement && (
            <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400">
              {irImprovement}
            </Badge>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total Nodes</p>
            <p className="text-lg font-bold text-card-foreground">
              {counts.reduce((s, c) => s + c, 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            {irTooltip ? (
              <TooltipLabel
                label={<p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Imbalance Ratio (IR)</p>}
                title={irTooltip.title}
                explanation={irTooltip.explanation}
                showIcon
                side="top"
              />
            ) : (
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Imbalance Ratio (IR)</p>
            )}
            <p className="text-lg font-bold text-card-foreground">{ir.toFixed(2)}</p>
            {mode === 'after' && (
              <p className="text-[10px] text-muted-foreground">was {originalIR != null ? originalIR.toFixed(2) : 'N/A'}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Majority Class</p>
            <p className="text-base font-bold text-card-foreground truncate" title={classNames[labels[counts.indexOf(maxCount)]] || `Class ${labels[counts.indexOf(maxCount)]}`}>
              {classNames[labels[counts.indexOf(maxCount)]] || `Class ${labels[counts.indexOf(maxCount)]}`}
            </p>
            <p className="text-xs text-muted-foreground">{maxCount.toLocaleString()} nodes</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Minority Class</p>
            <p className="text-base font-bold text-card-foreground truncate" title={classNames[labels[counts.indexOf(minCount)]] || `Class ${labels[counts.indexOf(minCount)]}`}>
              {classNames[labels[counts.indexOf(minCount)]] || `Class ${labels[counts.indexOf(minCount)]}`}
            </p>
            <p className="text-xs text-muted-foreground">{minCount.toLocaleString()} nodes</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar chart */}
      <Card className="border-border bg-card">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold text-card-foreground">
            Per-Class Node Counts
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-5 pt-0">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
              <XAxis dataKey="class" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v.toLocaleString()} nodes`, 'Count']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={entry.class} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Side-by-side comparison only on "after" mode */}
      {mode === 'after' && (
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold text-card-foreground">
              Before vs After Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={labels.map((l) => ({
                  class: classNames[l] || `Class ${l}`,
                  Before: originalCounts[l],
                  After: displayCounts[l],
                }))}
                margin={{ top: 4, right: 8, left: -4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.4} />
                <XAxis dataKey="class" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.375rem',
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v.toLocaleString()} nodes`, '']}
                />
                <Bar dataKey="Before" fill="var(--muted-foreground)" radius={[3, 3, 0, 0]} opacity={0.5} />
                <Bar dataKey="After" fill="hsl(221 83% 53%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
