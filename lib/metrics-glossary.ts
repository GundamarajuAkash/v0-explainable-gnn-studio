// Comprehensive glossary for all metrics with beginner-friendly explanations

export const METRICS_GLOSSARY = {
  ACC: {
    technical: 'Accuracy',
    beginner: 'Correct Predictions',
    explanation: 'What percentage of all predictions did the model get right? (0-100%)',
    higherBetter: true,
  },
  bACC: {
    technical: 'Balanced Accuracy (Fair Accuracy)',
    beginner: 'Fairness Across Classes',
    explanation: 'On average, how well does the model predict each class? Good when classes are imbalanced.',
    higherBetter: true,
  },
  MacroF1: {
    technical: 'Macro-Averaged F1 Score (Class Balance Score)',
    beginner: 'Overall Class Performance',
    explanation: 'Average quality of predictions for each class combined. Balances both precision and recall.',
    higherBetter: true,
  },
  ECE: {
    technical: 'Expected Calibration Error (Confidence Reliability)',
    beginner: 'Confidence Accuracy',
    explanation: 'How much do the model\'s confidence scores match reality? Lower is better - high ECE means the model is overconfident.',
    higherBetter: false,
  },
  Brier: {
    technical: 'Brier Score (Prediction Confidence Error)',
    beginner: 'Confidence Quality',
    explanation: 'Measures how far off the model\'s probability predictions are from actual outcomes. Lower is better.',
    higherBetter: false,
  },
  WorstRecall: {
    technical: 'Worst Recall (Worst Class Recall)',
    beginner: 'Minority Class Detection',
    explanation: 'The recall score of the class that the model struggles with the most. Ensures no class is completely ignored.',
    higherBetter: true,
  },
  GMean: {
    technical: 'Geometric Mean (Minority Class Score)',
    beginner: 'All-Around Class Performance',
    explanation: 'Balanced measure of how well the model performs across all classes. Emphasizes minority class performance.',
    higherBetter: true,
  },
  IR: {
    technical: 'Imbalance Ratio (Class Imbalance Score)',
    beginner: 'Class Size Difference',
    explanation: 'How unbalanced is the dataset? 1 = all classes equal. Higher numbers = more severe imbalance.',
    higherBetter: false,
  },
  Precision: {
    technical: 'Precision (Positive Predictive Value)',
    beginner: 'Prediction Correctness',
    explanation: 'Out of all predictions for this class, how many were correct.',
    higherBetter: true,
  },
  Recall: {
    technical: 'Recall (Sensitivity / True Positive Rate)',
    beginner: 'Detection Rate',
    explanation: 'Out of all real samples of this class, how many were detected.',
    higherBetter: true,
  },
  F1: {
    technical: 'F1 Score (Harmonic Mean of Precision & Recall)',
    beginner: 'Balanced Performance',
    explanation: 'Balance between precision and recall. High F1 means good at both finding and correctly labeling.',
    higherBetter: true,
  },
  Specificity: {
    technical: 'Specificity (True Negative Rate)',
    beginner: 'Other-Class Rejection',
    explanation: 'How well the model avoids confusing other classes as this class.',
    higherBetter: true,
  },
  FPR: {
    technical: 'False Positive Rate',
    beginner: 'False Alarm Rate',
    explanation: 'How often other classes are incorrectly predicted as this class.',
    higherBetter: false,
  },
  Support: {
    technical: 'Support (Sample Count)',
    beginner: 'Number of Samples',
    explanation: 'Number of real samples belonging to this class in the dataset.',
    higherBetter: undefined,
  },
  Fidelity: {
    technical: 'Fidelity (Explanation Accuracy)',
    beginner: 'Explanation Trustworthiness',
    explanation: 'Does the explanation actually show why the model made its decision? Higher means more trustworthy.',
    higherBetter: true,
  },
  Coverage: {
    technical: 'Coverage (Subgraph Completeness)',
    beginner: 'Explanation Completeness',
    explanation: 'What portion of the important information is included in the explanation? Higher means more complete.',
    higherBetter: true,
  },
}

export const BALANCING_METHODS_GLOSSARY = {
  baseline: {
    name: 'Baseline',
    description: 'No balancing applied',
    simpleExplanation: 'Train on the original imbalanced data as-is',
    effect: 'None - uses dataset exactly as provided',
  },
  weighted: {
    name: 'Weighted Loss',
    description: 'Assigns higher weight to minority class samples',
    simpleExplanation: 'Make the model pay more attention to the minority class during training',
    effect: 'Increases minority class importance without changing data',
  },
  focal: {
    name: 'Focal Loss',
    description: 'Focuses on hard-to-classify samples',
    simpleExplanation: 'Make the model focus on samples it gets wrong',
    effect: 'Helps the model learn from difficult cases',
  },
  oversample: {
    name: 'Oversampling',
    description: 'Duplicates minority class samples',
    simpleExplanation: 'Copy minority class samples to make classes more balanced',
    effect: 'Increases minority class count to match majority',
  },
  undersample: {
    name: 'Undersampling',
    description: 'Removes majority class samples',
    simpleExplanation: 'Remove some majority class samples to balance with minority',
    effect: 'Decreases majority class count to match minority',
  },
  nodeimport: {
    name: 'Node Importance',
    description: 'Weights samples by node importance',
    simpleExplanation: 'Give more weight to important nodes in the graph',
    effect: 'Increases focus on structurally important nodes',
  },
  svwng: {
    name: 'SVW-NG (Selective Validation-Weighted NodeImport Gating)',
    description: 'An ensemble method that trains multiple GNN models with different imbalance-handling techniques, then combines their predictions using validation-guided weights and node-level importance selection.',
    simpleExplanation: 'Trains several models using different balancing strategies, then smartly combines their answers — giving more trust to models that perform better on validation data and focusing on the most informative nodes.',
    effect: 'Avoids relying on a single balancing strategy by aggregating diverse models weighted by their validation performance',
  },
}

export const DATASET_STATS_GLOSSARY = {
  numNodes: {
    technical: 'Number of Nodes',
    beginner: 'Graph Size',
    explanation: 'How many entities (nodes) does the graph contain?',
  },
  numEdges: {
    technical: 'Number of Edges',
    beginner: 'Connection Count',
    explanation: 'How many connections (edges) exist between nodes?',
  },
  numClasses: {
    technical: 'Number of Classes',
    beginner: 'Category Count',
    explanation: 'How many different categories are nodes classified into?',
  },
  featureDimension: {
    technical: 'Feature Dimension',
    beginner: 'Attribute Count',
    explanation: 'How many attributes (features) does each node have?',
  },
  density: {
    technical: 'Graph Density',
    beginner: 'Connectedness',
    explanation: 'What percentage of all possible connections actually exist? Low = sparse graph, High = dense graph.',
  },
  avgDegree: {
    technical: 'Average Degree',
    beginner: 'Average Connections',
    explanation: 'On average, how many neighbors does each node have?',
  },
  IR: {
    technical: 'Imbalance Ratio',
    beginner: 'Class Size Difference',
    explanation: 'Ratio of the largest class to smallest class. 1 = balanced, higher = more imbalanced.',
  },
  majorClass: {
    technical: 'Majority Class',
    beginner: 'Largest Class',
    explanation: 'The class with the most samples. In imbalanced datasets, this class dominates and can bias the model.',
  },
  minorClass: {
    technical: 'Minority Class',
    beginner: 'Smallest Class',
    explanation: 'The class with the fewest samples. Models often struggle to learn this class well due to limited examples.',
  },
  classDistribution: {
    technical: 'Class Distribution',
    beginner: 'How Samples Are Spread',
    explanation: 'Shows how many nodes belong to each class. A uniform bar means balanced; skewed bars indicate imbalance.',
  },
  balanceStatus: {
    technical: 'Balance Status',
    beginner: 'Dataset Health',
    explanation: 'Indicates whether the dataset classes are roughly equal (Balanced), somewhat uneven (Imbalanced), or severely skewed (Highly Imbalanced).',
  },
}

export function getMetricTooltip(metricKey: string): { title: string; explanation: string } | null {
  const metric = METRICS_GLOSSARY[metricKey as keyof typeof METRICS_GLOSSARY]
  if (!metric) return null
  return {
    title: metric.technical,
    explanation: metric.explanation,
  }
}

export function getBalancingMethodTooltip(methodKey: string): { title: string; explanation: string } | null {
  const method = BALANCING_METHODS_GLOSSARY[methodKey as keyof typeof BALANCING_METHODS_GLOSSARY]
  if (!method) return null
  return {
    title: method.name,
    explanation: method.simpleExplanation,
  }
}

export function getDatasetStatTooltip(statKey: string): { title: string; explanation: string } | null {
  const stat = DATASET_STATS_GLOSSARY[statKey as keyof typeof DATASET_STATS_GLOSSARY]
  if (!stat) return null
  return {
    title: stat.technical,
    explanation: stat.explanation,
  }
}
