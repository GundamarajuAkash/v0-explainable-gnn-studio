/**
 * POST /api/balance
 * Get before/after class distribution preview for a dataset.
 * If graph_after is stored, use actual data; otherwise compute simulated balancing.
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface BalancePayload {
  dataset_id: string;
  method: string;
}

interface GraphData {
  nodes: { id: string | number; label: number; features: number[] }[];
  edges: { source: string | number; target: string | number }[];
}

/**
 * Extract class counts from graph data
 */
function getClassCountsFromGraph(graph: GraphData): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const node of graph.nodes) {
    counts[node.label] = (counts[node.label] || 0) + 1;
  }
  return counts;
}

/**
 * Convert class counts object to sorted array
 */
function countsToArray(counts: Record<number, number>): number[] {
  return Object.entries(counts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, count]) => count);
}

/**
 * Simulate balancing when no graph_after is stored
 */
function simulateBalancing(classCounts: number[], method: string): number[] {
  const maxCount = Math.max(...classCounts);
  const minCount = Math.min(...classCounts);

  switch (method) {
    case "oversample":
      // Oversample minority classes to match majority
      return classCounts.map(() => maxCount);

    case "undersample":
      // Undersample majority classes to match minority
      return classCounts.map(() => minCount);

    case "smote":
      // SMOTE-like: interpolate towards majority
      return classCounts.map((c) => Math.round(c + (maxCount - c) * 0.7));

    case "weighted":
    case "focal":
    case "nodeimport":
    case "svwng":
      // Loss-based methods don't change sample counts
      return [...classCounts];

    case "baseline":
    default:
      return [...classCounts];
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload: BalancePayload = await request.json();
    const { dataset_id, method } = payload;

    if (!dataset_id || !method) {
      return NextResponse.json(
        { status: "error", message: "dataset_id and method are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check cache first
    const { data: cached } = await supabase
      .from("balance_previews")
      .select("result")
      .eq("dataset_id", dataset_id)
      .eq("method", method)
      .single();

    if (cached?.result) {
      return NextResponse.json({
        status: "success",
        message: "Balance preview from cache",
        data: cached.result,
      });
    }

    // Get dataset with graph_before and graph_after
    const { data: datasetData, error: fetchError } = await supabase
      .from("datasets")
      .select("class_counts, graph_before, graph_after")
      .eq("id", dataset_id)
      .single();

    if (fetchError || !datasetData) {
      return NextResponse.json(
        { status: "error", message: "Dataset not found" },
        { status: 404 }
      );
    }

    let beforeCounts: number[];
    let afterCounts: number[];

    // If graph_before and graph_after are stored, use actual data
    if (datasetData.graph_before && datasetData.graph_after) {
      const beforeGraph = datasetData.graph_before as GraphData;
      const afterGraph = datasetData.graph_after as GraphData;

      const beforeCountsObj = getClassCountsFromGraph(beforeGraph);
      const afterCountsObj = getClassCountsFromGraph(afterGraph);

      beforeCounts = countsToArray(beforeCountsObj);
      afterCounts = countsToArray(afterCountsObj);
    } else if (datasetData.graph_before) {
      // Only graph_before exists, simulate balancing
      const beforeGraph = datasetData.graph_before as GraphData;
      const beforeCountsObj = getClassCountsFromGraph(beforeGraph);
      beforeCounts = countsToArray(beforeCountsObj);
      afterCounts = simulateBalancing(beforeCounts, method);
    } else {
      // Fallback to class_counts column or default
      beforeCounts = datasetData.class_counts || [818, 426, 418, 298, 217, 180, 351];
      afterCounts = simulateBalancing(beforeCounts, method);
    }

    // Calculate improvement in balance
    const maxBefore = Math.max(...beforeCounts);
    const minBefore = Math.min(...beforeCounts);
    const irBefore = maxBefore / Math.max(minBefore, 1);

    const maxAfter = Math.max(...afterCounts);
    const minAfter = Math.min(...afterCounts);
    const irAfter = maxAfter / Math.max(minAfter, 1);

    const improvement = irBefore > 1 ? ((irBefore - irAfter) / (irBefore - 1)) * 100 : 0;

    const result = {
      before: beforeCounts,
      after: afterCounts,
      percentage_improvement: Math.round(improvement * 100) / 100,
      has_real_after: !!(datasetData.graph_before && datasetData.graph_after),
    };

    // Persist to Supabase cache
    const { error } = await supabase.from("balance_previews").upsert(
      {
        dataset_id,
        method,
        result,
      },
      { onConflict: "dataset_id,method" }
    );

    if (error) {
      console.error("[balance] Cache insert error:", error);
    }

    return NextResponse.json({
      status: "success",
      message: result.has_real_after
        ? "Balance preview from stored graph_after"
        : `Simulated balance preview for ${method}`,
      data: result,
    });
  } catch (err) {
    console.error("[balance] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to generate balance preview" },
      { status: 500 }
    );
  }
}
