'use client'

import { Zap, Spinner } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Spinner as SpinnerComp } from '@/components/ui/spinner'
import { useAppStore } from '@/lib/store'
import { MODELS, METHODS } from '@/lib/types'
import { TooltipLabel } from '@/components/tooltip-label'
import { getMetricTooltip } from '@/lib/metrics-glossary'

const CLASS_BAR_COLOR_MAJOR = 'hsl(221 83% 53%)'   // blue - majority classes
const CLASS_BAR_COLOR_MINOR = 'hsl(45 96% 53%)'     // amber - minority classes

function HorizontalClassBars({
  title,
  data,
}: {
  title: string
  data: { class: string; value: number; isMajor: boolean }[]
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        Per-Class
      </p>
      <h4 className="text-sm font-semibold text-card-foreground mb-3">{title}</h4>
      <div className="space-y-1.5">
        {data.map((row) => (
          <div key={row.class} className="flex items-center gap-2">
            <span
              className={`text-xs font-mono w-6 shrink-0 ${row.isMajor ? 'text-card-foreground' : 'font-bold text-amber-500'}`}
            >
              {row.class}
            </span>
            <div className="flex-1 h-5 bg-muted/40 rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${row.value * 100}%`,
                  backgroundColor: row.isMajor ? CLASS_BAR_COLOR_MAJOR : CLASS_BAR_COLOR_MINOR,
                }}
              />
            </div>
            <span
              className={`text-xs font-mono w-8 text-right shrink-0 ${row.isMajor ? 'text-card-foreground' : 'font-bold text-amber-500'}`}
            >
              {row.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StabilityHeatmap({
  matrix,
  models,
}: {
  matrix: { rowModel: string; colModel: string; value: number }[]
  models: string[]
}) {
  const getColor = (v: number) => {
    // Blue scale: 0.5 = light blue, 1.0 = deep navy
    const intensity = Math.max(0, Math.min(1, (v - 0.5) / 0.5))
    const r = Math.round(10 + (1 - intensity) * 60)
    const g = Math.round(20 + (1 - intensity) * 80)
    const b = Math.round(80 + intensity * 120)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-semibold text-card-foreground mb-3">
        Explanation Stability Across Models
      </h4>
      <div className="overflow-x-auto">
        <table className="text-xs border-separate border-spacing-0.5">
          <thead>
            <tr>
              <td className="w-10" />
              {models.map((m) => (
                <td key={m} className="text-center text-muted-foreground font-medium w-12 pb-1">
                  {m.replace('GraphSAGE', 'SAGE')}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((rowModel) => (
              <tr key={rowModel}>
                <td className="text-muted-foreground font-medium pr-1 text-right">
                  {rowModel.replace('GraphSAGE', 'SAGE')}
                </td>
                {models.map((colModel) => {
                  const cell = matrix.find(
                    (m) => m.rowModel === rowModel && m.colModel === colModel
                  )
                  const val = cell?.value ?? 0
                  const isDiag = rowModel === colModel
                  return (
                    <td
                      key={colModel}
                      className="w-12 h-10 text-center rounded-sm font-semibold"
                      style={{
                        backgroundColor: getColor(val),
                        color: isDiag ? '#fff' : val > 0.82 ? '#fff' : '#cce',
                        border: isDiag ? '1px solid rgba(255,255,255,0.2)' : 'none',
                      }}
                    >
                      {val.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <div
          className="h-2 w-20 rounded-sm"
          style={{
            background: 'linear-gradient(to right, rgb(70,100,130), rgb(10,20,200))',
          }}
        />
        <span className="text-[10px] text-muted-foreground">0.7</span>
        <span className="text-[10px] text-muted-foreground ml-6">0.8</span>
        <span className="text-[10px] text-muted-foreground ml-5">0.9</span>
        <span className="text-[10px] text-muted-foreground ml-4">1.0</span>
      </div>
    </div>
  )
}

export function GlobalExplainabilityPanel() {
  const globalExplainData = useAppStore((s) => s.globalExplainData)
  const globalExplainModel = useAppStore((s) => s.globalExplainModel)
  const setGlobalExplainModel = useAppStore((s) => s.setGlobalExplainModel)
  const globalExplainMethod = useAppStore((s) => s.globalExplainMethod)
  const setGlobalExplainMethod = useAppStore((s) => s.setGlobalExplainMethod)
  const isGeneratingGlobal = useAppStore((s) => s.isGeneratingGlobal)
  const runGlobalExplainability = useAppStore((s) => s.runGlobalExplainability)
  const selectedModels = useAppStore((s) => s.selectedModels)

  const displayModels =
    selectedModels.length > 0
      ? selectedModels
      : ['GCN', 'GAT', 'GraphSAGE', 'ChebNet', 'GIN', 'PinSAGE']

  const fidelityTooltip = getMetricTooltip('Fidelity')
  const coverageTooltip = getMetricTooltip('Coverage')

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
            Model
          </Label>
          <Select value={globalExplainModel} onValueChange={setGlobalExplainModel}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">
            Balancing Method
          </Label>
          <Select value={globalExplainMethod} onValueChange={setGlobalExplainMethod}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={runGlobalExplainability}
          disabled={isGeneratingGlobal}
          size="sm"
          className="gap-2"
        >
          {isGeneratingGlobal ? (
            <>
              <SpinnerComp className="size-3.5" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="size-3.5" />
              Generate Global Insights
            </>
          )}
        </Button>
        {globalExplainData && (
          <span className="text-xs text-muted-foreground">
            Showing: {globalExplainModel} / {globalExplainMethod.toUpperCase()}
          </span>
        )}
      </div>

      {!globalExplainData ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-sm">No global explainability data yet.</p>
          <p className="text-xs mt-1">Click "Generate Global Insights" to compute across all classes.</p>
        </div>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Global Explainability Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="flex gap-8 flex-wrap">
              {/* Fidelity per class */}
              <div className="flex-1 min-w-[200px]">
                {fidelityTooltip ? (
                  <TooltipLabel
                    label={<span className="text-sm font-semibold text-card-foreground">Avg. Fidelity per Class</span>}
                    title={fidelityTooltip.title}
                    explanation={fidelityTooltip.explanation}
                    showIcon
                    side="top"
                  />
                ) : (
                  <p className="text-sm font-semibold text-card-foreground mb-3">Avg. Fidelity per Class</p>
                )}
                <div className="mt-3 space-y-1.5">
                  {globalExplainData.perClassFidelity.map((row) => (
                    <div key={row.class} className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono w-6 shrink-0 ${row.isMajor ? 'text-card-foreground' : 'font-bold text-amber-500'}`}
                      >
                        {row.class}
                      </span>
                      <div className="flex-1 h-5 bg-muted/40 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{
                            width: `${row.value * 100}%`,
                            backgroundColor: row.isMajor ? CLASS_BAR_COLOR_MAJOR : CLASS_BAR_COLOR_MINOR,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-mono w-8 text-right shrink-0 ${row.isMajor ? 'text-card-foreground' : 'font-bold text-amber-500'}`}
                      >
                        {row.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coverage per class */}
              <div className="flex-1 min-w-[200px]">
                {coverageTooltip ? (
                  <TooltipLabel
                    label={<span className="text-sm font-semibold text-card-foreground">Avg. Coverage per Class</span>}
                    title={coverageTooltip.title}
                    explanation={coverageTooltip.explanation}
                    showIcon
                    side="top"
                  />
                ) : (
                  <p className="text-sm font-semibold text-card-foreground mb-3">Avg. Coverage per Class</p>
                )}
                <div className="mt-3 space-y-1.5">
                  {globalExplainData.perClassCoverage.map((row) => (
                    <div key={row.class} className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono w-6 shrink-0 ${row.isMajor ? 'text-card-foreground' : 'font-bold text-amber-500'}`}
                      >
                        {row.class}
                      </span>
                      <div className="flex-1 h-5 bg-muted/40 rounded-sm overflow-hidden">
                        <div
                          className="h-full rounded-sm transition-all"
                          style={{
                            width: `${row.value * 100}%`,
                            backgroundColor: row.isMajor ? '#10b981' : CLASS_BAR_COLOR_MINOR,
                          }}
                        />
                      </div>
                      <span
                        className={`text-xs font-mono w-8 text-right shrink-0 ${row.isMajor ? 'text-card-foreground' : 'font-bold text-amber-500'}`}
                      >
                        {row.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stability heatmap */}
              <StabilityHeatmap
                matrix={globalExplainData.stabilityMatrix}
                models={displayModels}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
