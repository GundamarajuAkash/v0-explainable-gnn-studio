'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'
import * as api from '@/lib/api'

export function ExplainerResultsTable() {
  const { activeDataset } = useAppStore()
  const [results, setResults] = useState<api.APIExplainerRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])

  useEffect(() => {
    if (!activeDataset) return

    setIsLoading(true)
    setError(null)

    api.getExplainerResults(activeDataset)
      .then((data) => {
        console.log('[v0] Loaded explainer results:', data.length, 'rows')
        if (data.length > 0) {
          console.log('[v0] First row sample:', JSON.stringify(data[0]))
        }
        setResults(data)
        
        // Initialize with all available models and methods
        const uniqueModels = [...new Set(data.map(r => r.Model))].sort()
        const uniqueMethods = [...new Set(data.map(r => r.Method))].sort()
        setSelectedModels(uniqueModels)
        setSelectedMethods(uniqueMethods)
      })
      .catch((err) => {
        console.error('[v0] Failed to load explainer results:', err)
        setError('Failed to load explainer results')
      })
      .finally(() => setIsLoading(false))
  }, [activeDataset])

  const models = useMemo(() => {
    const modelSet = new Set<string>()
    results.forEach((row) => modelSet.add(row.Model))
    return Array.from(modelSet).sort()
  }, [results])

  const methods = useMemo(() => {
    const methodSet = new Set<string>()
    results.forEach((row) => {
      if (row.Method) methodSet.add(row.Method)
    })
    return Array.from(methodSet).sort()
  }, [results])

  const filteredResults = useMemo(() => {
    return results.filter(
      (r) => selectedModels.includes(r.Model) && selectedMethods.includes(r.Method)
    )
  }, [results, selectedModels, selectedMethods])

  const allModelsSelected = selectedModels.length === models.length
  const allMethodsSelected = selectedMethods.length === methods.length

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    )
  }

  const toggleAllModels = () => {
    setSelectedModels(allModelsSelected ? [] : [...models])
  }

  const toggleMethod = (method: string) => {
    setSelectedMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    )
  }

  const toggleAllMethods = () => {
    setSelectedMethods(allMethodsSelected ? [] : [...methods])
  }

  if (!activeDataset) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">Please load a dataset first</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">Loading explainer results...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">No explainer results available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Explainer Results - {activeDataset}</CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Showing {filteredResults.length} of {results.length} results
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter Controls */}
        <div className="flex gap-6 flex-wrap p-3 bg-muted/30 rounded-md">
          {/* Models Filter */}
          <div>
            <Label className="text-xs font-semibold text-card-foreground uppercase tracking-wide mb-2 block">
              Models
            </Label>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="explainer-select-all-models"
                  checked={allModelsSelected && models.length > 0}
                  onCheckedChange={toggleAllModels}
                  className="size-3.5"
                />
                <Label
                  htmlFor="explainer-select-all-models"
                  className="text-xs font-medium text-muted-foreground cursor-pointer"
                >
                  Select All
                </Label>
              </div>
              {models.map((model) => (
                <div key={model} className="flex items-center gap-2">
                  <Checkbox
                    id={`explainer-model-${model}`}
                    checked={selectedModels.includes(model)}
                    onCheckedChange={() => toggleModel(model)}
                    className="size-3.5"
                  />
                  <Label
                    htmlFor={`explainer-model-${model}`}
                    className="text-xs cursor-pointer"
                  >
                    {model}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Methods Filter */}
          <div>
            <Label className="text-xs font-semibold text-card-foreground uppercase tracking-wide mb-2 block">
              Methods
            </Label>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="explainer-select-all-methods"
                  checked={allMethodsSelected && methods.length > 0}
                  onCheckedChange={toggleAllMethods}
                  className="size-3.5"
                />
                <Label
                  htmlFor="explainer-select-all-methods"
                  className="text-xs font-medium text-muted-foreground cursor-pointer"
                >
                  Select All
                </Label>
              </div>
              {methods.map((method) => (
                <div key={method} className="flex items-center gap-2">
                  <Checkbox
                    id={`explainer-method-${method}`}
                    checked={selectedMethods.includes(method)}
                    onCheckedChange={() => toggleMethod(method)}
                    className="size-3.5"
                  />
                  <Label
                    htmlFor={`explainer-method-${method}`}
                    className="text-xs cursor-pointer"
                  >
                    {method}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Model</TableHead>
                <TableHead className="font-semibold">Method</TableHead>
                <TableHead className="text-right">Fidelity</TableHead>
                <TableHead className="text-right">Sparsity</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{row.Model}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{row.Method || 'baseline'}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400">{row.Fidelity}</TableCell>
                  <TableCell className="text-right text-green-600 dark:text-green-400">{row.Sparsity}</TableCell>
                  <TableCell className="text-right text-purple-600 dark:text-purple-400">{row.Coverage}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
