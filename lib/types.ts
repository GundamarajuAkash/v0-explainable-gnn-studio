// ─── Types ───────────────────────────────────────────────────────────

export interface GraphNode {
  id: number
  label: number
  features: number[]
}

export interface GraphEdge {
  source: number
  target: number
}

export interface GraphDataset {
  name: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface DatasetSummary {
  name: string
  numNodes: number
  numEdges: number
  numClasses: number
  classCounts: Record<number, number> | { classId: number; count: number }[]
  classNames?: string[]  // Actual class names for the dataset
  featureNames?: string[] // Sample feature names for the dataset
  majorClass: number
  minorClass: number
  imbalanceRatio: number
  balanceStatus?: 'balanced' | 'imbalanced' | 'highly_imbalanced'
  isBuiltIn?: boolean
  isBuiltin?: boolean  // Alternative spelling
  featureDimension?: number
  numFeatures?: number
  density: number
  avgDegree: number
}

export interface PerClassMetric {
  classId: string
  precision: number
  recall: number
  f1: number
  specificity: number
  fpr: number
  support: number
}

// Metric value can be number or string with std (e.g., "0.821 ± 0.012")
export type MetricValue = number | string

export interface BenchmarkResult {
  model: string
  method: string
  ACC: MetricValue
  bACC: MetricValue
  MacroF1: MetricValue
  ECE: MetricValue
  Brier: MetricValue
  WorstRecall: MetricValue
  GMean: MetricValue
  perClassMetrics: PerClassMetric[]
  confusionMatrix: number[][]
}

export interface ExplainabilityResult {
  dataset: string
  model: string
  method: string
  nodeId: number
  predictedClass: number
  trueClass: number
  confidence: number
  subgraphNodes: { id: number; label: number; isTarget: boolean }[]
  subgraphEdges: { source: number; target: number; importance: number }[]
  featureImportance: { feature: string; importance: number }[]
  fidelity: number
  coverage: number
}

export interface TrainingCurvePoint {
  epoch: number
  loss: number
  valAcc: number
}

export interface TrainingCurveSeries {
  key: string
  model: string
  method: string
  points: TrainingCurvePoint[]
}

export interface GlobalExplainabilityData {
  perClassFidelity: { class: string; value: number; isMajor: boolean }[]
  perClassCoverage: { class: string; value: number; isMajor: boolean }[]
  stabilityMatrix: { rowModel: string; colModel: string; value: number }[]
}

// ─── Constants ───────────────────────────────────────────────────────

export const MODELS = ['GCN', 'GraphSAGE', 'GAT', 'ChebNet', 'GIN', 'PinSAGE'] as const
export const METHODS = ['baseline', 'weighted', 'focal', 'oversample', 'undersample', 'nodeimport', 'svwng'] as const
