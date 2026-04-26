'use client'

import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/lib/store'
import { MODELS, METHODS } from '@/lib/types'
import { TooltipLabel, MethodLabel } from '@/components/tooltip-label'
import { getBalancingMethodTooltip } from '@/lib/metrics-glossary'
import { ImbalanceInfoCard } from './imbalance-info-card'
import { ResultsTable } from './results-table'
import { ComparisonBarChart } from './comparison-bar-chart'
import { PerClassMetricsTable } from './per-class-metrics-table'
import { MajorityMinorityComparison } from './majority-minority-comparison'
import { MethodRadarChart } from './method-radar-chart'
import { ImbalancePerformanceChart } from './imbalance-performance-chart'

export function TrainingTab() {
  const selectedModels = useAppStore((s) => s.selectedModels)
  const setSelectedModels = useAppStore((s) => s.setSelectedModels)
  const selectedMethods = useAppStore((s) => s.selectedMethods)
  const setSelectedMethods = useAppStore((s) => s.setSelectedMethods)
  const isTraining = useAppStore((s) => s.isTraining)
  const trainingProgress = useAppStore((s) => s.trainingProgress)
  const runTraining = useAppStore((s) => s.runTraining)

  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      setSelectedModels(selectedModels.filter((m) => m !== model))
    } else {
      setSelectedModels([...selectedModels, model])
    }
  }

  const toggleMethod = (method: string) => {
    if (selectedMethods.includes(method)) {
      setSelectedMethods(selectedMethods.filter((m) => m !== method))
    } else {
      setSelectedMethods([...selectedMethods, method])
    }
  }

  const allModelsSelected = selectedModels.length === MODELS.length
  const allMethodsSelected = selectedMethods.length === METHODS.length

  const toggleAllModels = () => {
    setSelectedModels(allModelsSelected ? [] : [...MODELS])
  }

  const toggleAllMethods = () => {
    setSelectedMethods(allMethodsSelected ? [] : [...METHODS])
  }

  return (
    <div className="flex gap-5 h-full">
      {/* Left sidebar controls */}
      <aside className="w-56 shrink-0 flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-semibold text-card-foreground mb-2 uppercase tracking-wide">
            Models
          </h3>
          <div className="flex flex-col gap-1.5">
            {/* Select All */}
            <div className="flex items-center gap-2 pb-1 mb-0.5 border-b border-border">
              <Checkbox
                id="model-select-all"
                checked={allModelsSelected}
                onCheckedChange={toggleAllModels}
                className="size-3.5"
              />
              <Label htmlFor="model-select-all" className="text-xs font-medium text-muted-foreground cursor-pointer">
                Select All
              </Label>
            </div>
            {MODELS.map((model) => (
              <div key={model} className="flex items-center gap-2">
                <Checkbox
                  id={`model-${model}`}
                  checked={selectedModels.includes(model)}
                  onCheckedChange={() => toggleModel(model)}
                  className="size-3.5"
                />
                <Label htmlFor={`model-${model}`} className="text-xs text-card-foreground cursor-pointer">
                  {model}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-card-foreground mb-2 uppercase tracking-wide">
            Balancing Methods
          </h3>
          <div className="flex flex-col gap-1.5">
            {/* Select All */}
            <div className="flex items-center gap-2 pb-1 mb-0.5 border-b border-border">
              <Checkbox
                id="method-select-all"
                checked={allMethodsSelected}
                onCheckedChange={toggleAllMethods}
                className="size-3.5"
              />
              <Label htmlFor="method-select-all" className="text-xs font-medium text-muted-foreground cursor-pointer">
                Select All
              </Label>
            </div>
            {METHODS.map((method) => {
              const tooltip = getBalancingMethodTooltip(method)
              return (
                <div key={method} className="flex items-center gap-2">
                  <Checkbox
                    id={`method-${method}`}
                    checked={selectedMethods.includes(method)}
                    onCheckedChange={() => toggleMethod(method)}
                    className="size-3.5"
                  />
                  {tooltip ? (
                    <TooltipLabel
                      label={<Label htmlFor={`method-${method}`} className="text-xs cursor-pointer"><MethodLabel method={method} /></Label>}
                      title={tooltip.title}
                      explanation={tooltip.explanation}
                      showIcon
                      side="right"
                    />
                  ) : (
                    <Label htmlFor={`method-${method}`} className="text-xs cursor-pointer">
                      <MethodLabel method={method} />
                    </Label>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <Button
          onClick={runTraining}
          disabled={isTraining || selectedModels.length === 0 || selectedMethods.length === 0}
          className="w-full gap-2"
          size="sm"
        >
          {isTraining ? (
            <>
              <Spinner className="size-3.5" />
              Training...
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Run Training
            </>
          )}
        </Button>

        {/* Training Progress Indicator */}
        {isTraining && trainingProgress > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(trainingProgress)}%</span>
            </div>
            <Progress value={trainingProgress} className="h-1.5" />
          </div>
        )}

        <ImbalanceInfoCard />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <ResultsTable />
        <ComparisonBarChart />
        <MethodRadarChart />
        <ImbalancePerformanceChart />
        <PerClassMetricsTable />
        <MajorityMinorityComparison />
      </div>
    </div>
  )
}
