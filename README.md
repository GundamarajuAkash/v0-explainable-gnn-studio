# Explainable GNN Studio

An interactive web application for training, benchmarking, and explaining Graph Neural Networks (GNNs) with a focus on class-imbalanced node classification.

Built with Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Recharts, and Zustand.

---

## Features

### Dataset Management

- **Dataset overview card** -- Prominent left-sidebar panel displaying comprehensive dataset statistics: node count, edge count, class count, feature dimension, graph density, average degree, Imbalance Ratio [Class Imbalance Score], major/minor classes, balance status (Balanced/Imbalanced/Highly Imbalanced), and a stacked bar chart of per-class distribution with color-coded legend.
- **Balance detection** -- Automatically classifies datasets based on Imbalance Ratio (IR): Balanced (IR < 1.5), Imbalanced (1.5 ≤ IR < 3), or Highly Imbalanced (IR ≥ 3). Status displayed prominently in dataset overview card with color-coded badges.
- **Three dataset loading methods** (selectable tabs in upload panel):
  1. **JSON file upload** -- Upload custom graph datasets in the format `{ name, nodes: [{ id, label, features }], edges: [{ source, target }] }`. File validation, balance status calculation, and summary display.
  2. **Load from external URL** -- Paste any public URL (GitHub raw, Hugging Face, etc.) to fetch and load JSON datasets. Test URLs provided: `/api/sample-dataset` (sample 10-node dataset) and PyG GitHub links.
  3. **Built-in datasets** -- Select from 5 pre-configured benchmark datasets (Cora, CiteSeer, PubMed, Amazon Photo, Amazon Computers) with instant API-based loading. Each dataset shows node/class count in the dropdown.
- **Global dataset selector** -- Header dropdown to switch between any loaded dataset (uploaded or built-in); all panels update automatically.

### Training and Benchmark

- **Model selection** -- Choose any combination of GCN, GraphSAGE, GAT, ChebNet, GIN, and PinSAGE.
- **Balancing methods** -- Pair models with class-imbalance strategies: baseline, weighted loss, focal loss, oversampling, undersampling, NodeImport, and SVWNG. Each method includes interactive tooltips explaining how it works in beginner-friendly terms.
- **Before & after visualization** -- See class distribution before and after applying a balancing method. The chart displays original vs. balanced node counts per class, shows Imbalance Ratio (IR) improvement, and highlights the effectiveness of the selected strategy.
- **Results table** -- Sortable, searchable table displaying ACC [Accuracy], bACC [Fair Accuracy], Macro-F1 [Class Balance Score], ECE [Confidence Reliability], Brier [Prediction Confidence Error], WorstRecall [Worst Class Recall], and G-Mean [Minority Class Score] for every model/method combination. Hover over any metric for a simple explanation. Export results as CSV.
- **Imbalance info card** -- Visual breakdown of per-class node counts with a horizontal bar chart and key statistics (majority class, minority class, imbalance ratio).
- **Comparison chart** -- Grouped bar chart comparing selected models across any chosen metric, filterable by balancing method. ECE and Brier provide calibration insights for confidence-sensitive applications.

### Explainability

- **Node-level explanations** -- Select a model, balancing method, and target node ID to generate a local explanation.
- **Prediction summary** -- Color-coded cards showing predicted class, true class, and model confidence.
- **Subgraph viewer** -- Interactive SVG visualization of the target node's computational subgraph. The target node is highlighted in red, neighbors in blue, and edge thickness reflects importance scores. Supports scroll-to-zoom and drag-to-pan.
- **Feature importance** -- Horizontal bar chart ranking node features by attribution score (e.g., Degree, Clustering, Betweenness, PageRank).
- **Explainability metrics** -- Fidelity [Explanation Accuracy] and Coverage [Subgraph Completeness] scores for the generated explanation.
- **Cross-model comparison** -- Grouped bar chart comparing Fidelity and Coverage metrics across all models and balancing methods for the selected node.

---

## Project Structure

```
app/
  layout.tsx            Root layout (Inter + JetBrains Mono fonts)
  page.tsx              Main page with header, dataset selector, and tabs
  globals.css           Design tokens and Tailwind CSS v4 theme
  api/
    datasets/route.ts   API endpoint for lazy-loading built-in datasets
    sample-dataset/route.ts   Test dataset endpoint for URL upload testing

components/
  dataset-overview-card.tsx           Dataset stats (nodes, edges, features, density, degree, IR, class distribution)
  dataset-upload-panel.tsx            Tabbed upload panel (JSON file / External URL / Built-in datasets)
  balancing-before-after-chart.tsx    Class distribution before & after balancing with IR improvement
  imbalance-info-card.tsx             Class distribution card with bar chart
  training-tab.tsx                    Model/method checkboxes with tooltips, before-after chart, run button
  results-table.tsx                   Sortable/searchable benchmark table with metric tooltips
  comparison-bar-chart.tsx            Grouped bar chart for metric comparison (ACC, bACC, Macro-F1, ECE, Brier, G-Mean, Worst Recall)
  explainability-tab.tsx              Explanation controls and result panels
  subgraph-viewer.tsx                 Interactive SVG graph visualization
  feature-importance-chart.tsx        Horizontal feature attribution chart
  metric-cards.tsx                    Reusable metric summary cards
  explainability-comparison-chart.tsx Cross-model explainability chart (Fidelity, Coverage)
  tooltip-label.tsx                   Reusable tooltip wrapper for consistent hover explanations
  ui/                                 shadcn/ui primitives

lib/
  mock-data.ts          Type definitions, dataset generators, benchmark simulators
  metrics-glossary.ts   Technical and beginner-friendly explanations for all metrics, balancing methods, and dataset statistics
  store.ts              Zustand global state with dataset loading methods (URL, built-in)
  utils.ts              Tailwind class merge utility
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Dataset Loading Guide

The Dataset Upload Panel provides three methods to load datasets:

### Method 1: JSON File Upload
Select a local JSON file from your computer. The file is parsed, validated, and imported with automatic balance status detection.

### Method 2: Load from External URL
Paste a public URL to any JSON dataset file. Commonly used test URLs:
- **Sample Test Dataset** (built-in): `/api/sample-dataset` - A 10-node, 3-class test graph
- **PyG Examples (GitHub)**: `https://raw.githubusercontent.com/pytorch/pytorch_geometric/master/examples/data/`
- **Hugging Face Datasets**: URLs to graph datasets in JSON format

Example workflow:
1. Click the "External URL" tab
2. Paste the URL (or click a test URL to auto-populate)
3. Click "Load from URL"
4. The dataset is fetched, validated, and added to your session

### Method 3: Built-in Datasets
Select from a dropdown of pre-configured benchmark datasets:
- **Cora** (2,708 nodes, 7 classes, highly imbalanced)
- **CiteSeer** (3,327 nodes, 6 classes, imbalanced)
- **PubMed** (19,717 nodes, 3 classes, imbalanced)
- **Amazon Photo** (7,650 nodes, 8 classes, imbalanced)
- **Amazon Computers** (13,752 nodes, 10 classes, highly imbalanced)

Each dataset's summary is precomputed and displays instantly. Click "Load" to add it to your session.

---

## Dataset JSON Format

Upload datasets as a single JSON file with the following structure:

```json
{
  "name": "MyGraph",
  "nodes": [
    { "id": 0, "label": 0, "features": [0.12, -0.34, 0.56, ...] },
    { "id": 1, "label": 1, "features": [0.78, 0.90, -0.12, ...] }
  ],
  "edges": [
    { "source": 0, "target": 1 },
    { "source": 1, "target": 2 }
  ]
}
```

| Field             | Type     | Description                              |
| ----------------- | -------- | ---------------------------------------- |
| `name`            | string   | Dataset display name (optional, falls back to filename) |
| `nodes[].id`      | number   | Unique integer node identifier           |
| `nodes[].label`   | number   | Integer class label for classification   |
| `nodes[].features`| number[] | Feature vector for the node              |
| `edges[].source`  | number   | Source node ID                           |
| `edges[].target`  | number   | Target node ID                           |

### Dataset Statistics Computed Automatically

When a dataset is uploaded or selected, the following statistics are automatically calculated and displayed in the Dataset Overview Card:

| Statistic           | Description                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| **Nodes**           | Total number of nodes in the graph                                             |
| **Edges**           | Total number of edges (connections) in the graph                              |
| **Classes**         | Number of distinct node class labels                                          |
| **Features**        | Dimensionality of node feature vectors                                        |
| **Density**         | Percentage of possible edges present in the graph (0-100%). Sparse graphs have low density |
| **Avg Degree**      | Average number of connections per node. Higher degree = more densely connected |
| **IR (Imbalance Ratio)** | Ratio of majority class to minority class. Higher values indicate more severe class imbalance |
| **Major Class**      | The class label with the most nodes (dominant class)                          |
| **Minor Class**      | The class label with the fewest nodes (underrepresented class)                |
| **Balance Status**   | Categorical assessment: Balanced, Imbalanced, or Highly Imbalanced            |

---

## Metrics Reference

### Classification Metrics (with Beginner-Friendly Terms)

| Metric           | Beginner Term              | Description                                                                    |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------ |
| ACC              | Accuracy                   | Standard accuracy; percentage of correctly predicted samples                  |
| bACC             | Fair Accuracy              | Balanced accuracy; macro-averaged recall across all classes (good for imbalanced data) |
| Macro-F1         | Class Balance Score        | Macro-averaged F1 score across all classes; average of per-class precision-recall |
| ECE              | Confidence Reliability     | Expected Calibration Error; measures difference between predicted confidence and actual accuracy (lower is better) |
| Brier            | Prediction Confidence Error | Brier score; mean squared error between predicted probabilities and true labels (lower is better) |
| WorstRecall      | Worst Class Recall         | Recall of the worst-performing class; ensures minority class detection          |
| G-Mean           | Minority Class Score       | Geometric mean of per-class recalls; emphasizes minority class performance     |

### Imbalance Ratio (Class Imbalance Score)

| IR Value          | Category               | Interpretation                                              |
| ----------------- | ---------------------- | ----------------------------------------------------------- |
| IR < 1.5          | **Balanced**            | Classes are fairly well-distributed; standard ML approaches work |
| 1.5 ≤ IR < 3      | **Imbalanced**          | Moderate class imbalance; consider balancing methods        |
| IR ≥ 3            | **Highly Imbalanced**   | Severe class imbalance; balancing strategies strongly recommended |

### Explainability Metrics (with Beginner-Friendly Terms)

| Metric           | Beginner Term               | Description                                                          |
| ---------------- | --------------------------- | -------------------------------------------------------------------- |
| Fidelity         | Explanation Accuracy        | How well the explanation reflects the model's actual decision process (0-1; higher is better) |
| Coverage         | Subgraph Completeness       | Proportion of important nodes included in the explanation (0-1; higher is better) |

---

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 16 (App Router)             |
| UI         | React 19, shadcn/ui, Tailwind CSS 4 |
| Charts     | Recharts                            |
| State      | Zustand                             |
| Typography | Inter (body), JetBrains Mono (code) |

---

## Deployment

Click **Publish** in v0 to deploy to Vercel, or install locally with:

```bash
npx shadcn@latest init
```

---

## Tooltip Explanations & Beginner-Friendly Terms

Every metric, balancing method, and dataset statistic includes an interactive tooltip that explains the concept in simple terms:

- **Metric tooltips** -- Hover over column headers in the results table to see a technical name and a beginner-friendly explanation (e.g., "bACC [Fair Accuracy]" → "On average, how well does the model predict each class?")
- **Balancing method tooltips** -- Hover over method checkboxes to learn how each strategy works (e.g., "Oversampling" → "Copy minority class samples to make classes more balanced")
- **Dataset stat tooltips** -- Hover over dataset statistics to understand what each metric means (e.g., "Density" → "What percentage of all possible connections actually exist?")

The `metrics-glossary.ts` file contains the complete glossary with 30+ explanation pairs designed for researchers, practitioners, and beginners alike.

---

## Before & After Balancing Visualization

When you select a balancing method, a **before-after chart** automatically appears showing:

- **Original class distribution** (left bars) -- The class counts in the original imbalanced dataset
- **Balanced class distribution** (right bars) -- The class counts after applying the selected balancing method
- **Imbalance Ratio (IR) comparison** -- Original IR vs. balanced IR with percentage improvement
- **Class-by-class analysis** -- See exactly how each class is affected (oversampled, undersampled, weighted, etc.)

This visual feedback helps users understand the immediate impact of each balancing strategy on their data.

---

## Reusable Build Prompt

Use this prompt to rebuild or extend the Explainable GNN Studio UI with any AI coding tool:

```
Build an interactive Explainable GNN Studio for graph neural networks with class-imbalanced node classification. 

ARCHITECTURE OVERVIEW:
- Framework: Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui, Recharts, Zustand
- Layout: Header with global dataset selector, sticky navigation. Main content split into narrow left sidebar (dataset controls) and wide right panel (tabbed interface)
- State Management: Zustand for datasets, training results, explainability results
- Design Tokens: 3-5 color palette with primary (indigo/blue), accents (teal), neutrals (grays), 2 fonts (Inter body, JetBrains Mono code)

MAIN FEATURES:

1. DATASET MANAGEMENT (Left Sidebar):
   - Dataset Overview Card: Show node count, edge count, class count, feature dimension, graph density, average degree, Imbalance Ratio (IR) [Class Imbalance Score], major/minor classes, balance status badge (Balanced/Imbalanced/Highly Imbalanced based on IR thresholds: <1.5 balanced, 1.5-3 imbalanced, ≥3 highly imbalanced), horizontal stacked bar chart of per-class distribution with legend
   - Dataset Upload Panel: Tabbed interface with three dataset loading methods:
     * Tab 1 - JSON File Upload: Local file picker, validation, balance status detection
     * Tab 2 - External URL: Text input for public URLs (GitHub, Hugging Face, etc.), test URLs provided (/api/sample-dataset, PyG GitHub links)
     * Tab 3 - Built-in Datasets: Dropdown selector (Cora, CiteSeer, PubMed, Amazon Photo, Amazon Computers) with precomputed summaries, instant API loading
   - Global Dataset Selector (header): Dropdown to switch between all loaded datasets (uploaded or built-in)
   - Datasets automatically have: name, numNodes, numEdges, numClasses, classCounts{}, majorClass, minorClass, imbalanceRatio, featureDimension, density, avgDegree, balanceStatus (enum), isBuiltIn (boolean)

2. TRAINING & BENCHMARK TAB:
   - Model selection: Checkboxes for GCN, GraphSAGE, GAT, ChebNet, GIN, PinSAGE with multi-select
   - Balancing method selection: Checkboxes for baseline, weighted, focal, oversample, undersample, nodeimport, svwng. Each method includes interactive tooltips explaining how it works in beginner-friendly terms (e.g., "Oversampling [Simple explanation of copying minority samples]")
   - Before & After Visualization: When a method is selected, display a side-by-side class distribution chart showing:
     * Original class counts (gray bars)
     * Balanced class counts (accent-colored bars)
     * Original IR vs. Balanced IR comparison
     * Percentage improvement in IR
   - Run Training button with spinner during simulation
   - Results Table:
     * Columns: Model, Method, ACC [Accuracy], bACC [Fair Accuracy], MacroF1 [Class Balance Score], ECE [Confidence Reliability], Brier [Prediction Confidence Error], WorstRecall [Worst Class Recall], GMean [Minority Class Score]
     * Sortable by clicking headers (show ↑↓ icons)
     * Searchable by model/method name
     * Metric headers have interactive tooltips with beginner explanations
     * CSV export button
   - Imbalance Info Card: Horizontal bar chart of per-class distribution with legend, showing node counts
   - Method Comparison Chart:
     * Grouped bar chart comparing models across a selectable metric (dropdown with 7 options: ACC, bACC, MacroF1, ECE, Brier, GMean, WorstRecall)
     * Each metric option shows the beginner term in brackets in the dropdown
     * Filter bars by balancing method (multi-select checkboxes)

3. EXPLAINABILITY TAB:
   - Left sidebar controls:
     * Model selector dropdown (GCN, GraphSAGE, GAT, ChebNet, GIN, PinSAGE)
     * Balancing Method selector dropdown (baseline, weighted, focal, oversample, undersample, nodeimport, svwng)
     * Node ID input (number)
     * Generate Explanation button with spinner
   - Results panels (show only after generation):
     * Prediction Summary: 3 metric cards showing Predicted Class (color-coded), True Class, Confidence (0-1, color intensity varies)
     * Subgraph Viewer: Interactive SVG showing target node (red), neighbors (blue), edges with thickness = importance. Support scroll-to-zoom and drag-to-pan
     * Feature Importance: Horizontal bar chart of top node features (e.g., Degree, Clustering, Betweenness, PageRank, etc.) ranked by attribution
     * Explainability Metrics: 2 metric cards showing Fidelity [Explanation Accuracy] and Coverage [Subgraph Completeness] (remove Sparsity completely)
     * Cross-Model Comparison: Grouped bar chart showing Fidelity and Coverage [do NOT include Sparsity] across all models for the selected node and method

4. TYPE DEFINITIONS:
   - DatasetSummary: { name, numNodes, numEdges, numClasses, classCounts{}, majorClass, minorClass, imbalanceRatio, featureDimension, density, avgDegree, balanceStatus: 'balanced'|'imbalanced'|'highly_imbalanced', isBuiltIn: boolean }
   - BenchmarkResult: { model, method, ACC, bACC, MacroF1, ECE, Brier, WorstRecall, GMean }
   - ExplainabilityResult: { dataset, model, method, nodeId, predictedClass, trueClass, confidence, subgraphNodes[], subgraphEdges[], featureImportance[], fidelity, coverage } [NO sparsity field]

5. METRICS & TERMINOLOGY:
   - Always display beginner-friendly terms in brackets next to technical names:
     * bACC [Fair Accuracy]
     * MacroF1 [Class Balance Score]
     * ECE [Confidence Reliability]
     * Brier [Prediction Confidence Error]
     * WorstRecall [Worst Class Recall]
     * GMean [Minority Class Score]
     * Imbalance Ratio [Class Imbalance Score]
     * Fidelity [Explanation Accuracy]
     * Coverage [Subgraph Completeness]

6. UI/UX GUIDELINES:
   - Use responsive flexbox for layout (no floats/absolute positioning unless necessary)
   - Sticky header with logo, dataset selector, and navigation
   - Color-code results and metrics intuitively (green=good, red=bad, amber=caution)
   - Provide helpful hover tooltips and descriptions
   - Include loading states (spinners) for async operations
   - Empty states with friendly messages when no results yet
   - Compact tables and charts for readability on various screen sizes

MOCK DATA:
- Built-in datasets have realistic stats but no actual node/edge data
- Benchmark results should be generated deterministically based on dataset/model/method
- Explainability results include realistic feature importances and confidence distributions

This UI is designed to be beginner-friendly while maintaining technical accuracy for researchers studying imbalanced GNNs.
```

---

## Extending the Studio

The Dataset Upload Panel's three-method architecture can be extended:

1. **Custom Dataset APIs**: Add more routes in `app/api/datasets/` to fetch from PyTorch Geometric, Open Graph Benchmark, Kaggle, or proprietary sources
2. **Dataset Validation**: Enhance URL loading with schema validation, sample preview, and format auto-detection (CSV→Graph conversion)
3. **Model Training**: Replace mock `generateBenchmarkResults` with actual model inference via Python backend, FastAPI, or cloud ML services
4. **Database Persistence**: Add Supabase/Neon to persist user datasets, training results, and explanations
5. **Authentication**: Implement auth to track user projects, shared workspaces, and collaborative features
6. **Real-time Updates**: Use WebSockets for live model training progress and multi-user collaboration
