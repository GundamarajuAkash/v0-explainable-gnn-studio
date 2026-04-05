"""
SQLAlchemy ORM models for PostgreSQL / SQLite.
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    Boolean,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    num_nodes = Column(Integer, nullable=False)
    num_edges = Column(Integer, nullable=False)
    num_features = Column(Integer, nullable=False)
    num_classes = Column(Integer, nullable=False)
    density = Column(Float, nullable=False)
    avg_degree = Column(Float, nullable=False)
    class_counts = Column(JSON, nullable=False)  # [{class_id, count}, ...]
    imbalance_ratio = Column(Float, nullable=False)
    major_class = Column(Integer, nullable=False)
    minor_class = Column(Integer, nullable=False)
    is_builtin = Column(Boolean, default=False)
    graph_data = Column(JSON, nullable=True)  # full graph (nodes, edges, masks)
    created_at = Column(DateTime, default=datetime.utcnow)

    training_results = relationship("TrainingResult", back_populates="dataset")


class TrainingResult(Base):
    __tablename__ = "training_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    model_name = Column(String, nullable=False)
    method_name = Column(String, nullable=False)

    # Overall metrics
    acc = Column(Float)
    bacc = Column(Float)
    macro_f1 = Column(Float)
    ece = Column(Float)
    brier = Column(Float)
    worst_recall = Column(Float)
    gmean = Column(Float)

    # Per-class metrics & confusion matrix as JSON
    per_class_metrics = Column(JSON)  # [PerClassMetric, ...]
    confusion_matrix = Column(JSON)   # [[int, ...], ...]

    # Training curves as JSON
    training_curve = Column(JSON)  # [TrainingCurvePoint, ...]

    # Hyperparameters used
    hyperparams = Column(JSON)

    # Model file path
    model_path = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="training_results")


class Explanation(Base):
    __tablename__ = "explanations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    model_name = Column(String, nullable=False)
    method_name = Column(String, nullable=False)
    node_id = Column(Integer, nullable=False)

    predicted_class = Column(Integer)
    true_class = Column(Integer)
    confidence = Column(Float)
    subgraph_nodes = Column(JSON)
    subgraph_edges = Column(JSON)
    feature_importance = Column(JSON)
    fidelity = Column(Float)
    coverage = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)


class BalancePreview(Base):
    __tablename__ = "balance_previews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    method_name = Column(String, nullable=False)
    original_counts = Column(JSON)
    balanced_counts = Column(JSON)
    original_ir = Column(Float)
    balanced_ir = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)
