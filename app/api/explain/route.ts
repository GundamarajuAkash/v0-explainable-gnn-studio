import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Seeded random generator
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h = (h ^ (h >>> 16)) * 0x85ebca6b;
    h = (h ^ (h >>> 13)) * 0xc2b2ae35;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

interface ExplainPayload {
  dataset_id: string;
  model: string;
  method: string;
  node_id: number;
}

// Dataset-specific feature names for citation networks
const DATASET_FEATURE_NAMES: Record<string, string[]> = {
  'cora': ['neural', 'network', 'learning', 'algorithm', 'model', 'training', 'classification', 'function', 'layer', 'optimization', 'gradient', 'backpropagation', 'activation', 'weight', 'bias'],
  'citeseer': ['system', 'database', 'query', 'information', 'retrieval', 'agent', 'interface', 'user', 'search', 'knowledge', 'reasoning', 'planning', 'machine', 'learning', 'inference'],
  'pubmed': ['diabetes', 'insulin', 'glucose', 'patient', 'treatment', 'blood', 'type', 'mellitus', 'study', 'clinical', 'control', 'plasma', 'disease', 'therapy', 'cell'],
};

function getFeatureNames(datasetId: string): string[] {
  const key = datasetId.toLowerCase().replace('builtin-', '');
  return DATASET_FEATURE_NAMES[key] || Array.from({ length: 15 }, (_, i) => `Feature_${i + 1}`);
}

function generateExplanation(
  datasetId: string,
  model: string,
  method: string,
  nodeId: number,
  numClasses: number,
  numFeatures: number
) {
  const seed = `${datasetId}-${model}-${method}-${nodeId}`;
  const rand = seededRandom(seed);
  const featureNames = getFeatureNames(datasetId);

  const trueClass = Math.floor(rand() * numClasses);
  const confidence = 0.6 + rand() * 0.35;
  const isCorrect = rand() > 0.15;
  const predictedClass = isCorrect ? trueClass : (trueClass + 1 + Math.floor(rand() * (numClasses - 1))) % numClasses;

  // Generate subgraph nodes (target + neighbors)
  const numNeighbors = 3 + Math.floor(rand() * 5);
  const subgraphNodes = [nodeId];
  for (let i = 0; i < numNeighbors; i++) {
    subgraphNodes.push(nodeId + 100 + i + Math.floor(rand() * 50));
  }

  // Generate subgraph edges with importance scores
  const subgraphEdges = [];
  for (let i = 1; i < subgraphNodes.length; i++) {
    subgraphEdges.push({
      source: nodeId,
      target: subgraphNodes[i],
      importance: Math.round((0.3 + rand() * 0.7) * 1000) / 1000,
    });
    // Add some inter-neighbor edges
    if (rand() > 0.6 && i > 1) {
      subgraphEdges.push({
        source: subgraphNodes[i - 1],
        target: subgraphNodes[i],
        importance: Math.round((0.1 + rand() * 0.4) * 1000) / 1000,
      });
    }
  }

  // Feature importance (top features) with actual feature names
  const featureCount = Math.min(numFeatures, featureNames.length, 10);
  const featureImportance = Array.from({ length: featureCount }, (_, i) => {
    const featureRand = seededRandom(`${seed}-feature-${i}`);
    return {
      feature_name: featureNames[i],
      importance: Math.round((0.1 + featureRand() * 0.9) * 1000) / 1000,
    };
  }).sort((a, b) => b.importance - a.importance);

  // Fidelity and coverage metrics
  const fidelity = 0.7 + rand() * 0.25;
  const coverage = 0.5 + rand() * 0.4;

  return {
    nodeId,
    predictedClass,
    trueClass,
    confidence: Math.round(confidence * 10000) / 10000,
    subgraphNodes,
    subgraphEdges,
    featureImportance,
    fidelity: Math.round(fidelity * 10000) / 10000,
    coverage: Math.round(coverage * 10000) / 10000,
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: ExplainPayload = await request.json();
    const { dataset_id, model, method, node_id } = payload;

    if (!dataset_id || !model || !method || node_id === undefined) {
      return NextResponse.json(
        { status: "error", message: "dataset_id, model, method, and node_id are required" },
        { status: 400 }
      );
    }

    if (node_id < 0) {
      return NextResponse.json(
        { status: "error", message: "node_id must be non-negative" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get dataset info
    const { data: datasetData } = await supabase
      .from("datasets")
      .select("num_classes, num_features")
      .eq("id", dataset_id)
      .single();

    const numClasses = datasetData?.num_classes || 7;
    const numFeatures = datasetData?.num_features || 10;

    // Check cache
    const { data: cached } = await supabase
      .from("explanations")
      .select("result")
      .eq("dataset_id", dataset_id)
      .eq("model", model)
      .eq("method", method)
      .eq("node_id", node_id)
      .single();

    if (cached?.result) {
      return NextResponse.json({
        status: "success",
        message: "Explanation retrieved from cache",
        data: cached.result,
      });
    }

    // Generate explanation
    const result = generateExplanation(
      dataset_id,
      model,
      method,
      node_id,
      numClasses,
      Math.min(numFeatures, 10)
    );

    // Persist to Supabase
    const { error } = await supabase.from("explanations").upsert(
      {
        dataset_id,
        model,
        method,
        node_id,
        result,
      },
      { onConflict: "dataset_id,model,method,node_id" }
    );

    if (error) {
      console.error("[v0] Explanation insert error:", error);
    }

    return NextResponse.json({
      status: "success",
      message: `Explanation generated for node ${node_id}`,
      data: result,
    });
  } catch (err) {
    console.error("[v0] Explain error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
