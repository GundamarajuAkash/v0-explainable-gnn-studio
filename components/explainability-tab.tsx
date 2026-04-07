'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAppStore } from '@/lib/store'
import { MODELS, METHODS } from '@/lib/types'
import { FeatureImportanceChart } from './feature-importance-chart'
import { MetricCards } from './metric-cards'
import { ExplainabilityComparisonChart } from './explainability-comparison-chart'
import { ExplainerResultsTable } from './explainer-results-table'
import { TooltipLabel, MethodLabel } from './tooltip-label'
import { getMetricTooltip, getBalancingMethodTooltip } from '@/lib/metrics-glossary'
import * as api from '@/lib/api'

export function ExplainabilityTab() {
  const explainModel = useAppStore((s) => s.explainModel)
  const setExplainModel = useAppStore((s) => s.setExplainModel)
  const explainMethods = useAppStore((s) => s.explainMethods)
  const setExplainMethods = useAppStore((s) => s.setExplainMethods)
  const explainNodeId = useAppStore((s) => s.explainNodeId)
  const setExplainNodeId = useAppStore((s) => s.setExplainNodeId)
  const isExplaining = useAppStore((s) => s.isExplaining)
  const runExplanation = useAppStore((s) => s.runExplanation)
  const explainResult = useAppStore((s) => s.explainResult)
  const activeDataset = useAppStore((s) => s.activeDataset)
  const getDatasetSummary = useAppStore((s) => s.getDatasetSummary)

  const [sparsityValue, setSparsityValue] = useState<number | null>(null)

  // Load sparsity from explainer results based on selected model and method
  useEffect(() => {
    if (!activeDataset || !explainModel || explainMethods.length === 0) {
      setSparsityValue(null)
      return
    }

    api.getExplainerResults(activeDataset)
      .then((results) => {
        // Find matching row for current model and first selected method
        const matchedRow = results.find(
          (r) =>
            r.Model.toLowerCase() === explainModel.toLowerCase() &&
            r.Method.toLowerCase() === explainMethods[0].toLowerCase()
        )
        if (matchedRow) {
          setSparsityValue(parseFloat(matchedRow.Sparsity))
        } else {
          setSparsityValue(null)
        }
      })
      .catch((err) => {
        console.error('[v0] Failed to load sparsity:', err)
        setSparsityValue(null)
      })
  }, [activeDataset, explainModel, explainMethods])

  const summary = getDatasetSummary(activeDataset)
  const maxNodeId = summary?.numNodes ? summary.numNodes - 1 : 0
  const isNodeIdValid = explainNodeId >= 0 && explainNodeId <= maxNodeId
  const nodeIdError = !isNodeIdValid && summary?.numNodes
    ? `Node ID must be between 0 and ${maxNodeId}`
    : null

  const allMethodsSelected = explainMethods.length === METHODS.length

  function toggleMethod(method: string) {
    if (explainMethods.includes(method)) {
      if (explainMethods.length === 1) return
      setExplainMethods(explainMethods.filter((m) => m !== method))
    } else {
      setExplainMethods([...explainMethods, method])
    }
  }

  function toggleAllMethods() {
    setExplainMethods(allMethodsSelected ? [explainMethods[0]] : [...METHODS])
  }

  return (
    <div className="flex gap-5 h-full">
      {/* Left sidebar controls */}
      <aside className="w-56 shrink-0 flex flex-col gap-4">
        {/* Model — single select rendered as checkboxes */}
        <div>
          <Label className="text-xs font-semibold text-card-foreground uppercase tracking-wide mb-2 block">
            Model
          </Label>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 pb-1 mb-0.5 border-b border-border">
              <Checkbox
                id="explain-model-select-all"
                checked={MODELS.every((m) => m === explainModel)}
                onCheckedChange={(checked) => {
                  if (checked) setExplainModel(MODELS[0])
                }}
                className="size-3.5"
              />
              <Label
                htmlFor="explain-model-select-all"
                className="text-xs font-medium text-muted-foreground cursor-pointer"
              >
                Select All
              </Label>
            </div>
            {MODELS.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <Checkbox
                  id={`explain-model-${m}`}
                  checked={explainModel === m}
                  onCheckedChange={() => setExplainModel(m)}
                  className="size-3.5"
                />
                <Label
                  htmlFor={`explain-model-${m}`}
                  className="text-xs text-card-foreground cursor-pointer"
                >
                  {m}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Methods — multi select with Select All */}
        <div>
          <Label className="text-xs font-semibold text-card-foreground uppercase tracking-wide mb-2 block">
            Balancing Methods
          </Label>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 pb-1 mb-0.5 border-b border-border">
              <Checkbox
                id="explain-method-select-all"
                checked={allMethodsSelected}
                onCheckedChange={toggleAllMethods}
                className="size-3.5"
              />
              <Label
                htmlFor="explain-method-select-all"
                className="text-xs font-medium text-muted-foreground cursor-pointer"
              >
                Select All
              </Label>
            </div>
            {METHODS.map((method) => {
              const tt = getBalancingMethodTooltip(method)
              const checked = explainMethods.includes(method)
              return (
                <div key={method} className="flex items-center gap-2">
                  <Checkbox
                    id={`explain-method-${method}`}
                    checked={checked}
                    onCheckedChange={() => toggleMethod(method)}
                    className="size-3.5"
                  />
                  {tt ? (
                    <TooltipLabel
                      label={
                        <Label
                          htmlFor={`explain-method-${method}`}
                          className="text-xs cursor-pointer"
                        >
                          <MethodLabel method={method} />
                        </Label>
                      }
                      title={tt.title}
                      explanation={tt.explanation}
                      showIcon
                      side="right"
                    />
                  ) : (
                    <Label
                      htmlFor={`explain-method-${method}`}
                      className="text-xs cursor-pointer"
                    >
                      <MethodLabel method={method} />
                    </Label>
                  )}
                </div>
              )
            })}
          </div>
          {explainMethods.length > 1 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {explainMethods.length} methods selected. Comparison chart will show all.
            </p>
          )}
        </div>

        {/* Node ID */}
        <div>
          <Label
            htmlFor="node-id-input"
            className="text-xs font-semibold text-card-foreground uppercase tracking-wide mb-1.5 block"
          >
            Node ID
          </Label>
          <Input
            id="node-id-input"
            type="number"
            min={0}
            max={maxNodeId}
            value={explainNodeId}
            onChange={(e) => setExplainNodeId(parseInt(e.target.value) || 0)}
            className={`h-8 text-xs ${nodeIdError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          {summary?.numNodes && (
            <p className={`text-[10px] mt-1 ${nodeIdError ? 'text-destructive' : 'text-muted-foreground'}`}>
              {nodeIdError || `Valid range: 0 - ${maxNodeId}`}
            </p>
          )}
        </div>

<Button
  onClick={async () => {
    try {
      let datasetKey = activeDataset?.toLowerCase()

      if (datasetKey === 'amazon-computers') datasetKey = 'computers'
      if (datasetKey === 'amazon-photo') datasetKey = 'photo'

      const res = await fetch(`/results/${datasetKey}_explainer.json`)
      let data = await res.json()

      if (!Array.isArray(data)) {
        data = Object.values(data)
      }

let nodeData = null

if (Array.isArray(data)) {
  nodeData =
    data.find((item: any) =>
      item.node_id == explainNodeId ||
      item.id == explainNodeId ||
      item.node == explainNodeId
    ) || data[0]
} else if (typeof data === 'object') {
  nodeData =
    data[explainNodeId] ||
    Object.values(data)[0]
}

console.log("NODE DATA:", nodeData)

useAppStore.getState().setExplainResult(nodeData)

      useAppStore.getState().setExplainResult(nodeData)
    } catch (err) {
      console.error('Failed to load explanation:', err)
    }
  }}
  disabled={isExplaining || !isNodeIdValid}
  className="w-full gap-2"
  size="sm"
>
  {isExplaining ? (
    <>
      <Spinner className="size-3.5" />
      Explaining...
    </>
  ) : (
    <>
      <Zap className="size-3.5" />
      Generate Explanation
    </>
  )}
</Button>
      </aside>

      {/* Main content with sub-tabs */}
      <div className="flex-1 min-w-0">
        <Tabs defaultValue="node" className="gap-4">
          <TabsList className="h-8">
            <TabsTrigger value="node" className="text-xs px-3">
              Node-Level
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs px-3">
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="node">
            {!explainResult ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <p className="text-sm">No explanation generated yet.</p>
                <p className="text-xs mt-1">
                  Select a model, method, and node ID, then click Generate Explanation.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <MetricCards
                  metrics={[
                    {
                      label: 'Predicted Class',
                      value: explainResult.predictedClass,
                      variant:
                        explainResult.predictedClass === explainResult.trueClass
                          ? 'success'
                          : 'warning',
                    },
                    { label: 'True Class', value: explainResult.trueClass },
                    {
                      label: 'Confidence',
                      value: explainResult.confidence,
                      variant:
                        explainResult.confidence > 0.8
                          ? 'success'
                          : explainResult.confidence > 0.6
                            ? 'default'
                            : 'warning',
                    },
                  ]}
                />

                <FeatureImportanceChart featureImportance={explainResult.featureImportance} />

                <MetricCards
                  metrics={[
                    {
                      label: (() => {
                        const tt = getMetricTooltip('Fidelity')
                        return tt
                          ? `Fidelity — ${tt.explanation}`
                          : 'Fidelity [Explanation Accuracy]'
                      })(),
                      value: explainResult.fidelity,
                      description: 'How well the explanation matches model predictions',
                    },
                    {
                      label: (() => {
                        const tt = getMetricTooltip('Sparsity')
                        return tt
                          ? `Sparsity — ${tt.explanation}`
                          : 'Sparsity [Explanation Conciseness]'
                      })(),
                      value: sparsityValue ?? 0,
                      description: 'How concise and minimal the explanation is',
                    },
                    {
                      label: (() => {
                        const tt = getMetricTooltip('Coverage')
                        return tt
                          ? `Coverage — ${tt.explanation}`
                          : 'Coverage [Subgraph Completeness]'
                      })(),
                      value: explainResult.coverage,
                      description: 'Portion of important nodes included in explanation',
                    },
                  ]}
                />

                <ExplainabilityComparisonChart />
              </div>
            )}
          </TabsContent>

          <TabsContent value="results">
            <ExplainerResultsTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
