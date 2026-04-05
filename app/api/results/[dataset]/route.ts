import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Allowed datasets (case-insensitive)
const ALLOWED_DATASETS = ["cora", "citeseer", "pubmed", "amazon-photo", "amazon-computers"];

// Map dataset names to file names (lowercase, handle variations)
function normalizeDatasetName(dataset: string): string | null {
  const lower = dataset.toLowerCase().replace(/\s+/g, "-");
  
  // Handle various input formats
  const mappings: Record<string, string> = {
    "cora": "cora",
    "citeseer": "citeseer",
    "pubmed": "pubmed",
    "amazon-photo": "photo",
    "amazonphoto": "photo",
    "amazon_photo": "photo",
    "photo": "photo",
    "amazon-computers": "computers",
    "amazoncomputers": "computers",
    "amazon_computers": "computers",
    "computers": "computers",
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
 * GET /api/results/[dataset]
 * Load all results for a dataset from public/results/{dataset}.json
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string }> }
) {
  try {
    const { dataset } = await params;
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
    // Training tab loads "after" balancing results
    const filePath = path.join(process.cwd(), "public", "results", `${normalizedDataset}_after.json`);
    
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

    return NextResponse.json({
      status: "success",
      dataset: normalizedDataset,
      count: results.length,
      data: results,
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
