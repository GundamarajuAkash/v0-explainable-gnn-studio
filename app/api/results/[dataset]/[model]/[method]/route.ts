import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Allowed datasets (case-insensitive)
const ALLOWED_DATASETS = ["cora", "citeseer", "pubmed", "amazon-photo", "amazon-computers"];

// Map dataset names to file names
function normalizeDatasetName(dataset: string): string | null {
  const lower = dataset.toLowerCase().replace(/\s+/g, "-");
  
  const mappings: Record<string, string> = {
    "cora": "cora",
    "citeseer": "citeseer",
    "pubmed": "pubmed",
    "amazon-photo": "amazon-photo",
    "amazonphoto": "amazon-photo",
    "amazon_photo": "amazon-photo",
    "amazon-computers": "amazon-computers",
    "amazoncomputers": "amazon-computers",
    "amazon_computers": "amazon-computers",
  };

  return mappings[lower] || null;
}

interface ResultRow {
  Dataset: string;
  Model: string;
  Method: string;
  ACC: string;
  bACC: string;
  MacroF1: string;
  ECE: string;
  Brier: string;
  WorstRecall: string;
  GMean: string;
}

/**
 * GET /api/results/[dataset]/[model]/[method]
 * Load a specific result row for dataset/model/method combination
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string; model: string; method: string }> }
) {
  try {
    const { dataset, model, method } = await params;
    const normalizedDataset = normalizeDatasetName(dataset);

    if (!normalizedDataset) {
      return NextResponse.json(
        {
          status: "error",
          message: `Unknown dataset: ${dataset}. Allowed datasets: ${ALLOWED_DATASETS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Load the JSON file from public/results/
    const filePath = path.join(process.cwd(), "public", "results", `${normalizedDataset}.json`);
    
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, "utf-8");
    } catch {
      return NextResponse.json(
        {
          status: "error",
          message: `Results file not found for dataset: ${normalizedDataset}`,
        },
        { status: 404 }
      );
    }

    const results: ResultRow[] = JSON.parse(fileContent);

    // Case-insensitive search for model and method
    const matchedRow = results.find(
      (row) =>
        row.Model.toLowerCase() === model.toLowerCase() &&
        row.Method.toLowerCase() === method.toLowerCase()
    );

    if (!matchedRow) {
      return NextResponse.json(
        {
          status: "error",
          message: `No results found for Model=${model}, Method=${method} in dataset ${normalizedDataset}`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "success",
      dataset: normalizedDataset,
      model: matchedRow.Model,
      method: matchedRow.Method,
      data: matchedRow,
    });
  } catch (error) {
    console.error("[results API] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
