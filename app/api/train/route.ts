import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Seeded random generator for deterministic mock results
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

const MODELS = ["GCN", "SAGE", "GAT", "Cheb", "GIN", "Pin"] as const;
const METHODS = ["baseline", "weighted", "focal", "oversample", "undersample", "nodeimport", "svwng"] as const;

interface TrainPayload {
  dataset_id: string;
  models: string[];
  methods: string[];
  epochs?: number;
}

function generateMockMetrics(
  model: string,
  method: string,
  datasetId: string,
  numClasses: number
) {
  const seed = `${datasetId}-${model}-${method}`;
  const rand = seededRandom(seed);

  // Base accuracy varies by model
  const modelBonuses: Record<string, number> = {
    GCN: 0.0,
    SAGE: 0.02,
    GAT: 0.03,
    Cheb: 0.01,
    GIN: 0.015,
    Pin: 0.025,
  };

  // Method bonuses for balanced accuracy
  const methodBonuses: Record<string, number> = {
    baseline: 0,
    weighted: 0.03,
    focal: 0.025,
    oversample: 0.02,
    undersample: 0.01,
    nodeimport: 0.035,
    svwng: 0.05,
  };

  const baseAcc = 0.72 + rand() * 0.12 + (modelBonuses[model] || 0);
  const methodBonus = methodBonuses[method] || 0;

  const acc = Math.min(0.95, baseAcc + rand() * 0.03);
  const bAcc = Math.min(0.92, baseAcc - 0.05 + methodBonus + rand() * 0.04);
  const macroF1 = Math.min(0.9, bAcc - 0.02 + rand() * 0.03);
  const ece = Math.max(0.02, 0.15 - methodBonus - rand() * 0.08);
  const brier = Math.max(0.05, 0.25 - acc * 0.15 - rand() * 0.05);
  const worstRecall = Math.max(0.3, bAcc - 0.15 + methodBonus + rand() * 0.1);
  const gmean = Math.min(0.9, Math.sqrt(bAcc * worstRecall) + rand() * 0.02);

  // Per-class metrics
  const perClassMetrics = Array.from({ length: numClasses }, (_, i) => {
    const classRand = seededRandom(`${seed}-class-${i}`);
    const isMinority = i >= numClasses - 2;
    const classBonus = isMinority ? methodBonus * 1.5 : 0;

    return {
      class_id: i,
      precision: Math.min(0.95, 0.65 + classRand() * 0.25 + classBonus),
      recall: Math.min(0.95, 0.6 + classRand() * 0.3 + classBonus),
      f1: Math.min(0.95, 0.62 + classRand() * 0.28 + classBonus),
      specificity: Math.min(0.98, 0.85 + classRand() * 0.1),
      fpr: Math.max(0.02, 0.15 - classRand() * 0.1),
      support: Math.floor(100 + classRand() * 400),
    };
  });

  // Confusion matrix
  const confusionMatrix = Array.from({ length: numClasses }, (_, i) =>
    Array.from({ length: numClasses }, (_, j) => {
      const cmRand = seededRandom(`${seed}-cm-${i}-${j}`);
      if (i === j) {
        return Math.floor(50 + cmRand() * 150 * acc);
      }
      return Math.floor(cmRand() * 20 * (1 - acc));
    })
  );

  return {
    model,
    method,
    acc: Math.round(acc * 10000) / 10000,
    bAcc: Math.round(bAcc * 10000) / 10000,
    macroF1: Math.round(macroF1 * 10000) / 10000,
    ece: Math.round(ece * 10000) / 10000,
    brier: Math.round(brier * 10000) / 10000,
    worstRecall: Math.round(worstRecall * 10000) / 10000,
    gmean: Math.round(gmean * 10000) / 10000,
    perClassMetrics,
    confusionMatrix,
  };
}

function generateTrainingCurves(
  model: string,
  method: string,
  datasetId: string,
  epochs: number
) {
  const seed = `${datasetId}-${model}-${method}-curves`;
  const rand = seededRandom(seed);

  const curves = [];
  let loss = 2.0 + rand() * 0.5;
  let trainAcc = 0.1 + rand() * 0.1;
  let valAcc = 0.08 + rand() * 0.1;

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const progress = epoch / epochs;
    const decay = Math.exp(-3 * progress);

    loss = Math.max(0.1, loss * (0.95 + rand() * 0.03) - 0.02 * (1 - decay));
    trainAcc = Math.min(0.98, trainAcc + (0.9 - trainAcc) * 0.05 * (1 + rand() * 0.5));
    valAcc = Math.min(0.95, valAcc + (0.85 - valAcc) * 0.04 * (1 + rand() * 0.5));

    curves.push({
      epoch,
      loss: Math.round(loss * 10000) / 10000,
      trainAcc: Math.round(trainAcc * 10000) / 10000,
      valAcc: Math.round(valAcc * 10000) / 10000,
    });
  }

  return curves;
}

export async function POST(request: NextRequest) {
  try {
    const payload: TrainPayload = await request.json();
    const { dataset_id, models, methods, epochs = 200 } = payload;

    if (!dataset_id) {
      return NextResponse.json(
        { status: "error", message: "dataset_id is required" },
        { status: 400 }
      );
    }
    if (!models || models.length === 0) {
      return NextResponse.json(
        { status: "error", message: "At least one model is required" },
        { status: 400 }
      );
    }
    if (!methods || methods.length === 0) {
      return NextResponse.json(
        { status: "error", message: "At least one method is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get dataset info
    const { data: datasetData } = await supabase
      .from("datasets")
      .select("num_classes")
      .eq("id", dataset_id)
      .single();

    const numClasses = datasetData?.num_classes || 7;

    // Generate results for all model-method combinations
    const results = [];
    const trainingCurves: Record<string, unknown[]> = {};

    for (const model of models) {
      for (const method of methods) {
        const metrics = generateMockMetrics(model, method, dataset_id, numClasses);
        results.push(metrics);

        const curveKey = `${model}-${method}`;
        trainingCurves[curveKey] = generateTrainingCurves(model, method, dataset_id, epochs);

        // Persist to Supabase
        const { error } = await supabase.from("training_results").upsert(
          {
            dataset_id,
            model,
            method,
            acc: metrics.acc,
            b_acc: metrics.bAcc,
            macro_f1: metrics.macroF1,
            ece: metrics.ece,
            brier: metrics.brier,
            worst_recall: metrics.worstRecall,
            gmean: metrics.gmean,
            per_class_metrics: metrics.perClassMetrics,
            confusion_matrix: metrics.confusionMatrix,
            epochs,
          },
          { onConflict: "dataset_id,model,method" }
        );

        if (error) {
          console.error("[v0] Training result insert error:", error);
        }
      }
    }

    return NextResponse.json({
      status: "success",
      message: `Training complete: ${results.length} combinations`,
      data: {
        dataset_id,
        results,
        training_curves: trainingCurves,
        duration_seconds: 0.5 + Math.random() * 1.5,
      },
    });
  } catch (err) {
    console.error("[v0] Train error:", err);
    return NextResponse.json(
      { status: "error", message: "Training failed" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch cached results
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get("dataset_id");

    if (!datasetId) {
      return NextResponse.json(
        { status: "error", message: "dataset_id query param required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("training_results")
      .select("*")
      .eq("dataset_id", datasetId);

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { status: "error", message: "No results found" },
        { status: 404 }
      );
    }

    // Transform to frontend format
    const results = data.map((row) => ({
      model: row.model,
      method: row.method,
      acc: row.acc,
      bAcc: row.b_acc,
      macroF1: row.macro_f1,
      ece: row.ece,
      brier: row.brier,
      worstRecall: row.worst_recall,
      gmean: row.gmean,
      perClassMetrics: row.per_class_metrics,
      confusionMatrix: row.confusion_matrix,
    }));

    return NextResponse.json({
      status: "success",
      data: { dataset_id: datasetId, results },
    });
  } catch (err) {
    console.error("[v0] Get results error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
