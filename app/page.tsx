'use client'

import { useEffect } from 'react'
import { Network, Database, Loader2, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { DatasetUploadPanel } from '@/components/dataset-upload-panel'
import { DatasetOverviewCard } from '@/components/dataset-overview-card'
import { TrainingTab } from '@/components/training-tab'
import { ExplainabilityTab } from '@/components/explainability-tab'
import { BalancingDistributionTab } from '@/components/balancing-distribution-tab'

export default function Home() {
  const activeDataset = useAppStore((s) => s.activeDataset)
  const activeDatasetId = useAppStore((s) => s.activeDatasetId)
  const setActiveDataset = useAppStore((s) => s.setActiveDataset)
  const fetchDatasets = useAppStore((s) => s.fetchDatasets)
  const isLoadingDatasets = useAppStore((s) => s.isLoadingDatasets)
  const datasets = useAppStore((s) => s.datasets)

  // Fetch datasets from Supabase on mount
  useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex h-12 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-7 rounded-md bg-primary">
              <Network className="size-4 text-primary-foreground" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-card-foreground">
              Explainable GNN Studio
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Database className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Dataset:</span>
            {isLoadingDatasets ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading...
              </div>
            ) : datasets.length > 0 ? (
              <Select value={activeDatasetId} onValueChange={(id) => setActiveDataset(id, id)}>
                <SelectTrigger size="sm" className="w-52 h-7 text-xs">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {d.summary.name}
                        {d.summary.isBuiltin && (
                          <Sparkles className="size-3 text-amber-500" />
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-muted-foreground italic">No datasets - upload one below</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 py-4">
        <div className="flex gap-5">
          {/* Narrow left panel for overview and upload */}
          <div className="w-80 shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-80px)]">
            <DatasetOverviewCard />
            <DatasetUploadPanel />
          </div>

          {/* Tabbed content area */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="before" className="gap-4">
              <TabsList className="h-9">
                <TabsTrigger value="before" className="text-xs gap-1.5 px-3">
                  Before Balancing
                </TabsTrigger>
                <TabsTrigger value="after" className="text-xs gap-1.5 px-3">
                  After Balancing
                </TabsTrigger>
                <TabsTrigger value="training" className="text-xs gap-1.5 px-3">
                  Training &amp; Results
                </TabsTrigger>
                <TabsTrigger value="explainability" className="text-xs gap-1.5 px-3">
                  Explainability
                </TabsTrigger>
              </TabsList>

              <TabsContent value="before">
                <BalancingDistributionTab mode="before" />
              </TabsContent>

              <TabsContent value="after">
                <BalancingDistributionTab mode="after" />
              </TabsContent>

              <TabsContent value="training">
                <TrainingTab />
              </TabsContent>

              <TabsContent value="explainability">
                <ExplainabilityTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}

