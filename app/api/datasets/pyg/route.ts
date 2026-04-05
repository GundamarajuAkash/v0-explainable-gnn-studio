import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const DATASET_NAME_MAP: Record<string, string> = {
  "Cora": "cora",
  "CiteSeer": "citeseer",
  "PubMed": "pubmed",
  "Amazon-Computers": "computers",
  "Amazon-Photo": "photo",
};

// Return available datasets
async function getAvailableDatasets() {
  return [
    { name: "Cora", type: "Planetoid", description: "Citation network of ML papers", num_classes: 7 },
    { name: "CiteSeer", type: "Planetoid", description: "Citation network of CS papers", num_classes: 6 },
    { name: "PubMed", type: "Planetoid", description: "Citation network of diabetes papers", num_classes: 3 },
    { name: "Amazon-Computers", type: "Amazon", description: "Amazon product co-purchase - Computers", num_classes: 10 },
    { name: "Amazon-Photo", type: "Amazon", description: "Amazon product co-purchase - Photo", num_classes: 8 },
  ];
}

export async function GET() {
  try {
    const datasetList = await getAvailableDatasets();
    return NextResponse.json({
      status: "success",
      data: datasetList,
    });
  } catch (error) {
    console.error("[datasets/pyg] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to load dataset list" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const datasetName = body.dataset;

    if (!datasetName) {
      return NextResponse.json(
        { status: "error", message: "Missing 'dataset' field" },
        { status: 400 }
      );
    }

    const jsonKey = DATASET_NAME_MAP[datasetName];
    if (!jsonKey) {
      return NextResponse.json(
        { status: "error", message: `Unknown dataset: ${datasetName}` },
        { status: 400 }
      );
    }

    const filePath = join(process.cwd(), "public/data/dataset_stats.json");
    const data = await readFile(filePath, "utf-8");
    const datasets = JSON.parse(data);

    const dataset = datasets.find((d: any) => d.dataset === jsonKey);
    if (!dataset) {
      return NextResponse.json(
        { status: "error", message: `Dataset not found: ${datasetName}` },
        { status: 404 }
      );
    }

    const classCounts = Object.values(dataset.class_distribution);
    const maxCount = Math.max(...classCounts);
    const minCount = Math.min(...classCounts);
    const imbalanceRatio = maxCount / minCount;
    const avgDegree = (dataset.num_edges * 2) / dataset.num_nodes;

    const response = {
      id: `pyg-${datasetName.toLowerCase().replace(/\s+/g, "-")}`,
      name: datasetName,
      num_nodes: dataset.num_nodes,
      num_edges: dataset.num_edges,
      num_features: dataset.num_features,
      num_classes: dataset.num_classes,
      density: dataset.density,
      avg_degree: avgDegree,
      class_counts: classCounts,
      class_distribution: dataset.class_distribution,
      class_names: Array.from({ length: dataset.num_classes }, (_, i) => `Class ${i}`),
      imbalance_ratio: Math.round(imbalanceRatio * 100) / 100,
      major_class: classCounts.indexOf(maxCount),
      minor_class: classCounts.indexOf(minCount),
      top_features: dataset.top_10_features,
      is_builtin: true,
    };

    return NextResponse.json({
      status: "success",
      data: response,
    });
  } catch (error) {
    console.error("[datasets/pyg] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to load dataset" },
      { status: 500 }
    );
  }
}
