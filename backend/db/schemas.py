"""
Pydantic request/response schemas.
Standard envelope: {status, message, data}
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ── Enums ───────────────────────────────────────────────────────────────────

class ModelName(str, Enum):
    GCN = "GCN"
    GAT = "GAT"
    GraphSAGE = "GraphSAGE"
    ChebNet = "ChebNet"
    GIN = "GIN"
    PinSAGE = "PinSAGE"


class MethodName(str, Enum):
    baseline = "baseline"
    weighted = "weighted"
    focal = "focal"
    oversample = "oversample"
    undersample = "undersample"
    nodeimport = "nodeimport"
    svwng = "svwng"


class BuiltInDataset(str, Enum):
    # Planetoid citation networks
    Cora = "Cora"
    CiteSeer = "CiteSeer"
    PubMed = "PubMed"
    # Amazon co-purchase
    AmazonPhoto = "Amazon-Photo"
    AmazonComputers = "Amazon-Computers"


# ── Standard Envelope ───────────────────────────────────────────────────────

class APIResponse(BaseModel):
    status: str = "success"
    message: str = ""
    data: Any = None


# ── Dataset Schemas ─────────────────────────────────────────────────────────

class GraphEdge(BaseModel):
    source: int
    target: int


class GraphUpload(BaseModel):
    """JSON graph payload for upload."""
    name: str
    nodes: list[dict[str, Any]]  # each node: {id, features: [...], label: int}
    edges: list[GraphEdge]
    num_classes: int
    feature_dim: int
    train_mask: Optional[list[int]] = None
    val_mask: Optional[list[int]] = None
    test_mask: Optional[list[int]] = None


class DatasetURLRequest(BaseModel):
    url: str
    name: Optional[str] = None


class LoadBuiltInRequest(BaseModel):
    dataset: BuiltInDataset


class ClassCount(BaseModel):
    class_id: str
    count: int


class DatasetSummary(BaseModel):
    id: str
    name: str
    num_nodes: int
    num_edges: int
    num_features: int
    num_classes: int
    density: float
    avg_degree: float
    class_counts: list[ClassCount]
    imbalance_ratio: float
    major_class: int
    minor_class: int
    is_builtin: bool = False


# ── Per-Class Metric ────────────────────────────────────────────────────────

class PerClassMetric(BaseModel):
    class_id: str
    precision: float
    recall: float
    f1: float
    specificity: float
    fpr: float
    support: int


# ── Training Schemas ────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    dataset_id: str
    models: list[ModelName]
    methods: list[MethodName]
    epochs: int = Field(default=200, ge=1, le=1000)
    lr: float = Field(default=0.01, gt=0, le=1)
    hidden_dim: int = Field(default=64, ge=8, le=512)
    dropout: float = Field(default=0.5, ge=0, le=1)
    weight_decay: float = Field(default=5e-4, ge=0)
    seed: int = Field(default=42)


class BenchmarkResult(BaseModel):
    model: str
    method: str
    ACC: float
    bACC: float
    MacroF1: float
    ECE: float
    Brier: float
    WorstRecall: float
    GMean: float
    per_class_metrics: list[PerClassMetric]
    confusion_matrix: list[list[int]]


class TrainingCurvePoint(BaseModel):
    epoch: int
    train_loss: float
    val_loss: float
    train_acc: float
    val_acc: float


class TrainResult(BaseModel):
    dataset_id: str
    results: list[BenchmarkResult]
    training_curves: dict[str, list[TrainingCurvePoint]]  # key: "model__method"
    duration_seconds: float


class TrainJobStatus(BaseModel):
    job_id: str
    status: str  # "pending", "running", "completed", "failed"
    progress: float = 0.0  # 0-100
    result: Optional[TrainResult] = None
    error: Optional[str] = None


# ── Explainability Schemas ──────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    dataset_id: str
    model: ModelName
    method: MethodName
    node_id: int = Field(ge=0)


class SubgraphNode(BaseModel):
    id: int
    label: int
    importance: float


class SubgraphEdge(BaseModel):
    source: int
    target: int
    weight: float


class FeatureImportance(BaseModel):
    feature_name: str
    importance: float


class ExplainResult(BaseModel):
    node_id: int
    predicted_class: int
    true_class: int
    confidence: float
    subgraph_nodes: list[SubgraphNode]
    subgraph_edges: list[SubgraphEdge]
    feature_importance: list[FeatureImportance]
    fidelity: float
    coverage: float


class GlobalExplainRequest(BaseModel):
    dataset_id: str
    model: ModelName
    method: MethodName
    num_samples: int = Field(default=50, ge=10, le=500)


class ClassExplainability(BaseModel):
    class_id: str
    avg_fidelity: float
    avg_coverage: float
    avg_subgraph_size: float


class StabilityEntry(BaseModel):
    class_id: str
    mean_jaccard: float


class GlobalExplainResult(BaseModel):
    per_class: list[ClassExplainability]
    stability: list[StabilityEntry]
    overall_fidelity: float
    overall_coverage: float


# ── Balance Preview Schemas ─────────────────────────────────────────────────

class BalancePreviewRequest(BaseModel):
    dataset_id: str
    method: MethodName


class BalancePreviewResult(BaseModel):
    method: str
    original_counts: list[ClassCount]
    balanced_counts: list[ClassCount]
    original_ir: float
    balanced_ir: float
    ir_improvement: float
