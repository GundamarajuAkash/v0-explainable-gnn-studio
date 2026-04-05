'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, FileJson, Download, ChevronDown, ChevronUp, Link as LinkIcon, Database, RefreshCw, Check, X, Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import type { DatasetSummary } from '@/lib/types'
import * as api from '@/lib/api'
import { Spinner } from '@/components/ui/spinner'

export function DatasetUploadPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'pyg' | 'upload' | 'url' | 'existing'>('pyg')
  
  // Single file upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<GraphDataset | null>(null)
  const [fileName, setFileName] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedSummary, setUploadedSummary] = useState<ReturnType<typeof summarizeDataset> | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  
  // PyG datasets state - fetch from API
  const [pygDatasets, setPygDatasets] = useState<api.APIPyGDatasetInfo[]>([])
  const [selectedPygDataset, setSelectedPygDataset] = useState("")
  const [isLoadingPyg, setIsLoadingPyg] = useState(false)
  const [pygError, setPygError] = useState<string | null>(null)
  const [pygLoaded, setPygLoaded] = useState(false)
  
  // Fetch available PyG datasets on component mount
  useEffect(() => {
    if (!pygLoaded) {
      setIsLoadingPyg(true)
      api.getAvailablePyGDatasets()
        .then((data) => {
          setPygDatasets(data)
          if (data.length > 0) {
            setSelectedPygDataset(data[0].name)
          }
          setPygLoaded(true)
        })
        .catch((err) => {
          console.error('[v0] Failed to fetch PyG datasets:', err)
          setPygError('Failed to load available datasets')
          setPygLoaded(true)
        })
        .finally(() => setIsLoadingPyg(false))
    }
  }, [pygLoaded])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const uploadDatasetToAPI = useAppStore((s) => s.uploadDatasetToAPI)
  const loadDatasetFromURL = useAppStore((s) => s.loadDatasetFromURL)
  const setActiveDataset = useAppStore((s) => s.setActiveDataset)
  const isLoadingDataset = useAppStore((s) => s.isLoadingDataset)
  const datasets = useAppStore((s) => s.datasets)
  const fetchDatasets = useAppStore((s) => s.fetchDatasets)
  const isLoadingDatasets = useAppStore((s) => s.isLoadingDatasets)

  // Auto-select first dataset when list changes
  useEffect(() => {
    if (datasets.length > 0 && !selectedDatasetId) {
      setSelectedDatasetId(datasets[0].id)
    }
  }, [datasets, selectedDatasetId])

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUploadError(null)
      setUploadedSummary(null)
      const file = e.target.files?.[0]
      if (!file) return

      if (file.size > 50 * 1024 * 1024) {
        setUploadError('File too large. Maximum size is 50MB.')
        return
      }

      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target?.result as string) as GraphDataset
          if (!json.nodes || !json.edges || !Array.isArray(json.nodes) || !Array.isArray(json.edges)) {
            setUploadError('Invalid format: JSON must have "nodes" and "edges" arrays.')
            return
          }
          if (!json.name) {
            json.name = file.name.replace('.json', '')
          }
          setUploadedFile(file) // Store the actual File object
          setParsedData(json)   // Store parsed data for validation/preview
          setFileName(file.name)
        } catch {
          setUploadError('Failed to parse JSON file.')
        }
      }
      reader.onerror = () => setUploadError('Failed to read file.')
      reader.readAsText(file)
    },
    []
  )

  // Clear file selection
  const clearFile = useCallback(() => {
    setUploadedFile(null)
    setParsedData(null)
    setFileName('')
    setUploadedSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Submit the upload
  const handleUpload = useCallback(async () => {
    if (!uploadedFile || !parsedData) {
      setUploadError('Please select a file to upload')
      return
    }

    setUploadError(null)
    try {
      // Use the File object and name from parsed data
      await uploadDatasetToAPI(uploadedFile, parsedData.name)
      
      // Show summary
      const summary = summarizeDataset(parsedData)
      setUploadedSummary(summary)
      
      // Reset form
      setUploadedFile(null)
      setParsedData(null)
      setFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      
      // Refresh dataset list
      fetchDatasets()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload dataset')
    }
  }, [uploadedFile, parsedData, uploadDatasetToAPI, fetchDatasets])

  // Handle URL loading
  const handleLoadFromURL = useCallback(async () => {
    setUrlError(null)
    if (!urlInput.trim()) {
      setUrlError('Please enter a valid URL')
      return
    }

    try {
      new URL(urlInput)
      await loadDatasetFromURL(urlInput)
      setUrlInput('')
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'Failed to load dataset from URL')
    }
  }, [urlInput, loadDatasetFromURL])

  // Handle existing dataset selection
  const handleLoadExisting = useCallback(() => {
    if (!selectedDatasetId) {
      setUploadError('Please select a dataset')
      return
    }

    const selected = datasets.find((d) => d.id === selectedDatasetId)
    if (selected) {
      setActiveDataset(selected.summary.name, selected.id)
    }
  }, [selectedDatasetId, datasets, setActiveDataset])

  // Handle PyG dataset loading
  const handleLoadPyGDataset = useCallback(async () => {
    if (!selectedPygDataset) {
      setPygError('Please select a dataset')
      return
    }

    setIsLoadingPyg(true)
    setPygError(null)
    try {
      const apiSummary = await api.loadPyGDataset(selectedPygDataset)
      
      // Convert API snake_case to camelCase for DatasetSummary
      const summary: DatasetSummary = {
        name: apiSummary.name,
        numNodes: apiSummary.num_nodes,
        numEdges: apiSummary.num_edges,
        numClasses: apiSummary.num_classes,
        numFeatures: apiSummary.num_features,
        featureDimension: apiSummary.num_features,
        density: apiSummary.density,
        avgDegree: apiSummary.avg_degree,
        classCounts: apiSummary.class_counts,
        classNames: apiSummary.class_names,
        imbalanceRatio: apiSummary.imbalance_ratio,
        majorClass: apiSummary.major_class,
        minorClass: apiSummary.minor_class,
        isBuiltin: true,
      }
      
      // Add to datasets array in store
      useAppStore.setState((state) => ({
        datasets: [
          ...state.datasets.filter((d) => d.id !== apiSummary.id),
          { id: apiSummary.id, summary }
        ],
        activeDataset: summary.name,
        activeDatasetId: apiSummary.id,
      }))
    } catch (err) {
      setPygError(err instanceof Error ? err.message : 'Failed to load dataset')
    } finally {
      setIsLoadingPyg(false)
    }
  }, [selectedPygDataset])

  // Handle mock dataset download
  const handleDownloadMock = useCallback(() => {
    const dataset = generateMockGraphDataset()
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mock-graph-dataset.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const getBalanceStatusColor = () => {
    if (!uploadedSummary) return ''
    switch (uploadedSummary.balanceStatus) {
      case 'balanced':
        return 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
      case 'imbalanced':
        return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
      case 'highly_imbalanced':
        return 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
    }
  }

  const getBalanceStatusText = () => {
    if (!uploadedSummary) return ''
    switch (uploadedSummary.balanceStatus) {
      case 'balanced':
        return 'Balanced'
      case 'imbalanced':
        return 'Imbalanced'
      case 'highly_imbalanced':
        return 'Highly Imbalanced'
    }
  }

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId)

  return (
    <Card className="border-border bg-card">
      <CardHeader
        className="cursor-pointer py-3 px-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
            <FileJson className="size-4 text-primary" />
            Load Dataset
          </CardTitle>
          {isOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="px-4 pb-4 pt-0">
          {/* Tab Navigation */}
          <div className="flex gap-1 mb-4 border-b border-border">
            <button
              onClick={() => setActiveTab('pyg')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'pyg'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              <Cpu className="size-3 inline mr-1" />
              PyG
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              <Upload className="size-3 inline mr-1" />
              Upload
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'url'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              <LinkIcon className="size-3 inline mr-1" />
              URL
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'existing'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              <Database className="size-3 inline mr-1" />
              Saved
            </button>
          </div>

          {/* PyG Datasets Tab */}
          {activeTab === 'pyg' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Load standard benchmark datasets from PyTorch Geometric.
              </p>

              <Select value={selectedPygDataset} onValueChange={setSelectedPygDataset}>
                <SelectTrigger size="sm" className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select a PyG dataset" />
                </SelectTrigger>
                <SelectContent>
                  {pygDatasets.map((d) => (
                    <SelectItem key={d.name} value={d.name} className="text-xs">
                      <span className="flex items-center gap-2">
                        {d.name}
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {d.type}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPygDataset && (
                <div className="rounded-md border border-border bg-muted/30 p-2.5">
                  <p className="text-xs text-muted-foreground mb-2">
                    {pygDatasets.find(d => d.name === selectedPygDataset)?.description}
                  </p>
                  <div className="grid grid-cols-2 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium text-right">
                      {pygDatasets.find(d => d.name === selectedPygDataset)?.type}
                    </span>
                    <span className="text-muted-foreground">Classes</span>
                    <span className="font-medium text-right">
                      {pygDatasets.find(d => d.name === selectedPygDataset)?.num_classes}
                    </span>
                  </div>
                </div>
              )}

              <Button
                variant="default"
                size="sm"
                className="w-full gap-2"
                onClick={handleLoadPyGDataset}
                disabled={isLoadingPyg || !selectedPygDataset}
              >
                {isLoadingPyg ? (
                  <>
                    <Spinner className="size-3.5" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Cpu className="size-3.5" />
                    Load Dataset
                  </>
                )}
              </Button>

              {pygError && (
                <p className="text-xs text-destructive">{pygError}</p>
              )}
            </div>
          )}

          {/* Upload JSON Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload a JSON file with graph structure (nodes and edges arrays).
              </p>

              {/* File Input */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadedFile && parsedData ? (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                    <Check className="size-3.5 text-green-600" />
                    <span className="text-xs text-green-700 dark:text-green-400 truncate flex-1">
                      {fileName}
                    </span>
                    <span className="text-[10px] text-green-600">
                      {parsedData.nodes.length} nodes
                    </span>
                    <button onClick={clearFile} className="p-0.5 hover:bg-green-200 dark:hover:bg-green-900 rounded">
                      <X className="size-3 text-green-600" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 h-9"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" />
                    Choose File
                  </Button>
                )}
              </div>

              {/* Upload Button */}
              <Button
                variant="default"
                size="sm"
                className="w-full gap-2"
                onClick={handleUpload}
                disabled={isLoadingDataset || !uploadedFile}
              >
                {isLoadingDataset ? (
                  <>
                    <Spinner className="size-3.5" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" />
                    Upload Dataset
                  </>
                )}
              </Button>

              {/* Download Sample */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center gap-2 text-muted-foreground"
                onClick={handleDownloadMock}
              >
                <Download className="size-3.5" />
                Download Sample Dataset
              </Button>

              {uploadError && (
                <p className="text-xs text-destructive">{uploadError}</p>
              )}

              {uploadedSummary && (
                <div className="mt-3 space-y-2">
                  <div className={`rounded-md p-3 ${getBalanceStatusColor()}`}>
                    <p className="text-xs font-semibold mb-2">
                      {uploadedSummary.name}
                    </p>
                    <Badge className="text-[10px] mb-2">
                      {getBalanceStatusText()}
                    </Badge>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <span className="opacity-75">Nodes</span>
                      <span className="font-medium text-right">{uploadedSummary.numNodes}</span>
                      <span className="opacity-75">Edges</span>
                      <span className="font-medium text-right">{uploadedSummary.numEdges}</span>
                      <span className="opacity-75">Classes</span>
                      <span className="font-medium text-right">{uploadedSummary.numClasses}</span>
                      <span className="opacity-75">IR</span>
                      <span className="font-medium text-right">{uploadedSummary.imbalanceRatio != null ? uploadedSummary.imbalanceRatio.toFixed(2) : 'N/A'}x</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Load from URL Tab */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste a public URL to a JSON dataset file (GitHub raw, Hugging Face, etc.)
              </p>

              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="https://example.com/dataset.json"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLoadFromURL()}
                  className="text-xs px-2.5 py-2 rounded-md border border-input bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button
                  variant="default"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={handleLoadFromURL}
                  disabled={isLoadingDataset || !urlInput.trim()}
                >
                  {isLoadingDataset ? (
                    <>
                      <Spinner className="size-3.5" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="size-3.5" />
                      Load from URL
                    </>
                  )}
                </Button>
              </div>

              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
            </div>
          )}

          {/* Existing Datasets Tab (from Supabase) */}
          {activeTab === 'existing' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Select a built-in or uploaded dataset
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchDatasets()}
                  disabled={isLoadingDatasets}
                  className="h-6 px-2"
                >
                  <RefreshCw className={`size-3 ${isLoadingDatasets ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {isLoadingDatasets ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner className="size-4" />
                  <span className="ml-2 text-xs text-muted-foreground">Loading datasets...</span>
                </div>
              ) : datasets.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">No datasets found in database.</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload a dataset to get started.</p>
                </div>
              ) : (
                <>
                  <Select value={selectedDatasetId} onValueChange={setSelectedDatasetId}>
                    <SelectTrigger size="sm" className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select a dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          <span className="flex items-center gap-2">
                            {d.summary.name}
                            {d.summary.isBuiltin && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                Built-in
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedDataset && (
                    <div className="rounded-md border border-border bg-muted/30 p-2.5">
                      <div className="grid grid-cols-2 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Nodes</span>
                        <span className="font-medium text-right">{selectedDataset.summary.numNodes}</span>
                        <span className="text-muted-foreground">Edges</span>
                        <span className="font-medium text-right">{selectedDataset.summary.numEdges}</span>
                        <span className="text-muted-foreground">Classes</span>
                        <span className="font-medium text-right">{selectedDataset.summary.numClasses}</span>
                        <span className="text-muted-foreground">IR</span>
                        <span className="font-medium text-right">{selectedDataset.summary.imbalanceRatio != null ? selectedDataset.summary.imbalanceRatio.toFixed(2) : 'N/A'}x</span>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleLoadExisting}
                    disabled={!selectedDatasetId}
                  >
                    <Database className="size-3.5" />
                    Load Selected Dataset
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
