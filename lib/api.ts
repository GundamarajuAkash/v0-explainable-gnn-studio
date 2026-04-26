// Simple HTTP request helper
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const json = await res.json()
  return json.data || json
}

// Type definitions
export interface APIResultRow {
  Model: string
  Method: string
  ACC: string
  ACC_CI_Lower?: string
  ACC_CI_Upper?: string
  bACC: string
  bACC_CI_Lower?: string
  bACC_CI_Upper?: string
  MacroF1: string
  MacroF1_CI_Lower?: string
  MacroF1_CI_Upper?: string
  ECE: string
  ECE_CI_Lower?: string
  ECE_CI_Upper?: string
  Brier: string
  Brier_CI_Lower?: string
  Brier_CI_Upper?: string
  WorstRecall: string
  WorstRecall_CI_Lower?: string
  WorstRecall_CI_Upper?: string
  GMean: string
  GMean_CI_Lower?: string
  GMean_CI_Upper?: string
}

export interface APITrainingResult {
  Dataset: string
  Model: string
  Method: string
  Accuracy: string
  Accuracy_CI_Lower?: string
  Accuracy_CI_Upper?: string
  Precision: string
  Precision_CI_Lower?: string
  Precision_CI_Upper?: string
  Recall: string
  Recall_CI_Lower?: string
  Recall_CI_Upper?: string
  F1: string
  F1_CI_Lower?: string
  F1_CI_Upper?: string
}

export interface APIExplainerRow {
  Dataset: string
  Model: string
  Method: string
  Fidelity: string
  Sparsity: string
  Coverage: string
}

export interface APIExplainResult {
  nodeId: number
  predictedClass: number
  trueClass: number
  confidence: number
  subgraphNodes: number[]
  subgraphEdges: Array<{ source: number; target: number; importance: number }>
  featureImportance: Array<{ feature_name: string; importance: number }>
  fidelity: number
  coverage: number
}

// Dataset Functions
export async function getAvailablePyGDatasets() {
  return request<any>('/api/datasets/pyg')
}

export async function loadPyGDataset(datasetName: string) {
  return request<any>('/api/datasets/pyg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset: datasetName }),
  })
}

// Results Functions
export async function getDatasetResults(dataset: string): Promise<APIResultRow[]> {
  return request<APIResultRow[]>(`/api/results/${encodeURIComponent(dataset)}`)
}

export async function getResultsData(dataset: string, phase: 'before' | 'after'): Promise<APIResultRow[]> {
  return request<APIResultRow[]>(`/api/results/${encodeURIComponent(dataset)}?phase=${phase}`)
}

export async function getExplainerResults(dataset: string): Promise<APIExplainerRow[]> {
  return request<APIExplainerRow[]>(`/api/explainer/${encodeURIComponent(dataset)}`)
}

// Explain Function
export async function runExplain(payload: {
  dataset_id: string
  model: string
  method: string
  node_id: number
}): Promise<APIExplainResult> {
  const response = await request<any>('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  
  // Extract explanation from response wrapper
  if (response.explanation) {
    return {
      ...response.explanation,
      fidelity: response.fidelity ?? 0,
      coverage: response.coverage ?? 0,
    }
  }
  
  // Fallback: return response as-is
  return response
}

