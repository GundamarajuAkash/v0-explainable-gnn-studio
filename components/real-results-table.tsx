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
import { useAppStore } from '@/lib/store'
import * as api from '@/lib/api'

export function RealResultsTable() {
  const { activeDataset } = useAppStore()
  const [results, setResults] = useState<api.APIResultRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeDataset) return

    setIsLoading(true)
    setError(null)

    api.getResultsData(activeDataset, 'after')
      .then((data) => {
        setResults(data as api.APIResultRow[])
      })
      .catch((err) => {
        console.error('[v0] Failed to load training results:', err)
        setError('Failed to load training results')
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

  if (!activeDataset) {
    return null
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-muted-foreground">Loading training results...</p>
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
    return null
  }

  return (
    <Card className="mt-6 border-blue-200 dark:border-blue-900">
      <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
        <CardTitle className="text-base">Training Results with Confidence Intervals</CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          {results.length} results • {models.length} models • {methods.length} methods
        </p>
      </CardHeader>
      <CardContent className="pt-6 overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Model</TableHead>
              <TableHead className="font-semibold">Method</TableHead>
              <TableHead className="text-right">ACC</TableHead>
              <TableHead className="text-right">bACC</TableHead>
              <TableHead className="text-right">MacroF1</TableHead>
              <TableHead className="text-right">ECE</TableHead>
              <TableHead className="text-right">Brier</TableHead>
              <TableHead className="text-right">Worst Recall</TableHead>
              <TableHead className="text-right">G-Mean</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, idx) => (
              <TableRow key={idx} className="hover:bg-blue-50 dark:hover:bg-blue-950/20">
                <TableCell className="font-medium">{row.Model}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{row.Method || 'baseline'}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-blue-600 dark:text-blue-400">{row.ACC}</span></TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-green-600 dark:text-green-400">{row.bACC}</span></TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-purple-600 dark:text-purple-400">{row.MacroF1}</span></TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-red-600 dark:text-red-400">{row.ECE}</span></TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-orange-600 dark:text-orange-400">{row.Brier}</span></TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-pink-600 dark:text-pink-400">{row.WorstRecall}</span></TableCell>
                <TableCell className="text-right font-mono text-[11px] whitespace-nowrap"><span className="text-white">±</span> <span className="text-teal-600 dark:text-teal-400">{row.GMean}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
