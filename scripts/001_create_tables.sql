-- =============================================================================
-- Explainable GNN Studio — Database Schema
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    num_nodes INTEGER NOT NULL,
    num_edges INTEGER NOT NULL,
    num_features INTEGER NOT NULL,
    num_classes INTEGER NOT NULL,
    density DOUBLE PRECISION NOT NULL DEFAULT 0,
    avg_degree DOUBLE PRECISION NOT NULL DEFAULT 0,
    class_counts JSONB NOT NULL DEFAULT '[]'::jsonb,
    imbalance_ratio DOUBLE PRECISION NOT NULL DEFAULT 1,
    major_class INTEGER NOT NULL DEFAULT 0,
    minor_class INTEGER NOT NULL DEFAULT 0,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    graph_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training results table
CREATE TABLE IF NOT EXISTS training_results (
    id SERIAL PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    method_name TEXT NOT NULL,
    acc DOUBLE PRECISION,
    bacc DOUBLE PRECISION,
    macro_f1 DOUBLE PRECISION,
    ece DOUBLE PRECISION,
    brier DOUBLE PRECISION,
    worst_recall DOUBLE PRECISION,
    gmean DOUBLE PRECISION,
    per_class_metrics JSONB,
    confusion_matrix JSONB,
    training_curve JSONB,
    hyperparams JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(dataset_id, model_name, method_name)
);

-- Explanations table
CREATE TABLE IF NOT EXISTS explanations (
    id SERIAL PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    method_name TEXT NOT NULL,
    node_id INTEGER NOT NULL,
    predicted_class INTEGER,
    true_class INTEGER,
    confidence DOUBLE PRECISION,
    subgraph_nodes JSONB,
    subgraph_edges JSONB,
    feature_importance JSONB,
    fidelity DOUBLE PRECISION,
    coverage DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint
    UNIQUE(dataset_id, model_name, method_name, node_id)
);

-- Balance previews table
CREATE TABLE IF NOT EXISTS balance_previews (
    id SERIAL PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    method_name TEXT NOT NULL,
    original_counts JSONB,
    balanced_counts JSONB,
    original_ir DOUBLE PRECISION,
    balanced_ir DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Unique constraint
    UNIQUE(dataset_id, method_name)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_training_results_dataset ON training_results(dataset_id);
CREATE INDEX IF NOT EXISTS idx_explanations_dataset ON explanations(dataset_id);
CREATE INDEX IF NOT EXISTS idx_balance_previews_dataset ON balance_previews(dataset_id);

-- Disable RLS for these tables (no user auth required for this app)
ALTER TABLE datasets DISABLE ROW LEVEL SECURITY;
ALTER TABLE training_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE explanations DISABLE ROW LEVEL SECURITY;
ALTER TABLE balance_previews DISABLE ROW LEVEL SECURITY;
