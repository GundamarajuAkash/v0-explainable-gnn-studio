-- =============================================================================
-- Migration: Add graph_before and graph_after columns
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Add new columns for before/after balancing graph data
ALTER TABLE datasets 
ADD COLUMN IF NOT EXISTS graph_before JSONB,
ADD COLUMN IF NOT EXISTS graph_after JSONB;

-- Migrate existing data: move graph_data to graph_before
UPDATE datasets 
SET graph_before = graph_data 
WHERE graph_data IS NOT NULL AND graph_before IS NULL;

-- Drop old column (optional - can keep for backward compatibility)
-- ALTER TABLE datasets DROP COLUMN IF EXISTS graph_data;

-- Add comment for documentation
COMMENT ON COLUMN datasets.graph_before IS 'Full graph JSON before balancing (nodes, edges, name)';
COMMENT ON COLUMN datasets.graph_after IS 'Full graph JSON after balancing (nodes, edges, name)';
