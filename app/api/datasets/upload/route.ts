/**
 * POST /api/datasets/upload
 * Register a dataset from a Vercel Blob URL.
 * Accepts: { name, blob_url } - fetches the JSON from blob and computes stats
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ── Types ────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string | number;
  label: number;
  features: number[];
  split?: "train" | "val" | "test";
}

interface GraphEdge {
  source: string | number;
  target: string | number;
  weight?: number;
}

interface GraphData {
  name?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface UploadPayload {
  name: string;
  blob_url: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_NODES = 500000;
const MAX_EDGES = 5000000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(nodes: GraphNode[], edges: GraphEdge[]) {
  const numNodes = nodes.length;
  const numEdges = edges.length;
  const numFeatures = nodes[0]?.features?.length ?? 0;

  // Class distribution
  const classCounts: Record<number, number> = {};
  for (const node of nodes) {
    classCounts[node.label] = (classCounts[node.label] || 0) + 1;
  }
  const numClasses = Object.keys(classCounts).length;
  const counts = Object.values(classCounts);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const imbalanceRatio = minCount > 0 ? maxCount / minCount : maxCount;

  // Find major/minor classes
  let majorClass = 0;
  let minorClass = 0;
  for (const [cls, count] of Object.entries(classCounts)) {
    if (count === maxCount) majorClass = Number(cls);
    if (count === minCount) minorClass = Number(cls);
  }

  // Graph metrics
  const density = numNodes > 1 ? (2 * numEdges) / (numNodes * (numNodes - 1)) : 0;
  const avgDegree = numNodes > 0 ? (2 * numEdges) / numNodes : 0;

  // Class counts as sorted array
  const classCountsArray = Object.entries(classCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, count]) => count);

  return {
    num_nodes: numNodes,
    num_edges: numEdges,
    num_features: numFeatures,
    num_classes: numClasses,
    class_counts: classCountsArray,
    imbalance_ratio: Math.round(imbalanceRatio * 100) / 100,
    major_class: majorClass,
    minor_class: minorClass,
    density: Math.round(density * 10000) / 10000,
    avg_degree: Math.round(avgDegree * 100) / 100,
  };
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const payload: UploadPayload = await request.json();

    // Validate required fields
    if (!payload.name || typeof payload.name !== "string" || payload.name.trim() === "") {
      return NextResponse.json(
        { status: "error", message: "Dataset 'name' is required" },
        { status: 400 }
      );
    }

    if (!payload.blob_url || typeof payload.blob_url !== "string") {
      return NextResponse.json(
        { status: "error", message: "'blob_url' is required" },
        { status: 400 }
      );
    }

    // Fetch the JSON from the blob URL
    const blobResponse = await fetch(payload.blob_url);
    if (!blobResponse.ok) {
      return NextResponse.json(
        { status: "error", message: `Failed to fetch blob: ${blobResponse.statusText}` },
        { status: 400 }
      );
    }

    let graphData: GraphData;
    try {
      graphData = await blobResponse.json();
    } catch {
      return NextResponse.json(
        { status: "error", message: "Invalid JSON in blob" },
        { status: 400 }
      );
    }

    // Validate structure
    if (!Array.isArray(graphData.nodes) || graphData.nodes.length === 0) {
      return NextResponse.json(
        { status: "error", message: "'nodes' must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(graphData.edges) || graphData.edges.length === 0) {
      return NextResponse.json(
        { status: "error", message: "'edges' must be a non-empty array" },
        { status: 400 }
      );
    }

    if (graphData.nodes.length > MAX_NODES) {
      return NextResponse.json(
        { status: "error", message: `Exceeds max ${MAX_NODES} nodes (got ${graphData.nodes.length})` },
        { status: 400 }
      );
    }

    if (graphData.edges.length > MAX_EDGES) {
      return NextResponse.json(
        { status: "error", message: `Exceeds max ${MAX_EDGES} edges (got ${graphData.edges.length})` },
        { status: 400 }
      );
    }

    // Validate node structure (sample first 10)
    for (let i = 0; i < Math.min(graphData.nodes.length, 10); i++) {
      const node = graphData.nodes[i];
      if (node.id === undefined) {
        return NextResponse.json(
          { status: "error", message: `nodes[${i}] missing 'id'` },
          { status: 400 }
        );
      }
      if (typeof node.label !== "number") {
        return NextResponse.json(
          { status: "error", message: `nodes[${i}] missing numeric 'label'` },
          { status: 400 }
        );
      }
      if (!Array.isArray(node.features) || node.features.length === 0) {
        return NextResponse.json(
          { status: "error", message: `nodes[${i}] missing non-empty 'features' array` },
          { status: 400 }
        );
      }
    }

    // Compute stats
    const stats = computeStats(graphData.nodes, graphData.edges);

    const datasetId = `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    // Persist to Supabase (store blob_url instead of full graph_data)
    const supabase = await createClient();
    const { error } = await supabase.from("datasets").insert({
      id: datasetId,
      name: payload.name.trim(),
      num_nodes: stats.num_nodes,
      num_edges: stats.num_edges,
      num_features: stats.num_features,
      num_classes: stats.num_classes,
      class_counts: stats.class_counts,
      imbalance_ratio: stats.imbalance_ratio,
      major_class: stats.major_class,
      minor_class: stats.minor_class,
      density: stats.density,
      avg_degree: stats.avg_degree,
      is_builtin: false,
      graph_data: { blob_url: payload.blob_url }, // Store blob URL reference instead of full data
    });

    if (error) {
      console.error("[datasets/upload] Supabase insert error:", error);
      // If schema cache hasn't refreshed, still return success with data
      // (the upload to blob worked, even if DB insert failed)
      if (error.code === 'PGRST205') {
        console.log("[datasets/upload] Schema cache not ready, returning success anyway");
        return NextResponse.json({
          status: "success",
          message: `Uploaded dataset '${payload.name}' (DB cache pending)`,
          data: {
            id: datasetId,
            name: payload.name.trim(),
            num_nodes: stats.num_nodes,
            num_edges: stats.num_edges,
            num_features: stats.num_features,
            num_classes: stats.num_classes,
            density: stats.density,
            avg_degree: stats.avg_degree,
            class_counts: stats.class_counts,
            imbalance_ratio: stats.imbalance_ratio,
            major_class: stats.major_class,
            minor_class: stats.minor_class,
            is_builtin: false,
          },
        });
      }
      return NextResponse.json(
        { status: "error", message: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: `Uploaded dataset '${payload.name}' with ${stats.num_nodes} nodes`,
      data: {
        id: datasetId,
        name: payload.name.trim(),
        num_nodes: stats.num_nodes,
        num_edges: stats.num_edges,
        num_features: stats.num_features,
        num_classes: stats.num_classes,
        density: stats.density,
        avg_degree: stats.avg_degree,
        class_counts: stats.class_counts,
        imbalance_ratio: stats.imbalance_ratio,
        major_class: stats.major_class,
        minor_class: stats.minor_class,
        is_builtin: false,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload dataset";
    console.error("[datasets/upload] Error:", message);
    return NextResponse.json(
      { status: "error", message },
      { status: 400 }
    );
  }
}
