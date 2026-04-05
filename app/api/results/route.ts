import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const DATASET_KEY_MAP: Record<string, string> = {
  "Cora": "cora",
  "CiteSeer": "citeseer",
  "PubMed": "pubmed",
  "Amazon-Computers": "computers",
  "Amazon-Photo": "photo",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dataset, type } = body;

    if (!dataset || !type) {
      return NextResponse.json(
        { status: "error", message: "Missing 'dataset' or 'type' field" },
        { status: 400 }
      );
    }

    const validTypes = ["before", "after", "explainer"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { status: "error", message: `Invalid type: ${type}. Valid: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const datasetKey = DATASET_KEY_MAP[dataset];
    if (!datasetKey) {
      return NextResponse.json(
        { status: "error", message: `Unknown dataset: ${dataset}` },
        { status: 400 }
      );
    }

    const fileName = `${datasetKey}_${type}.json`;
    const filePath = join(process.cwd(), "public/results", fileName);
    
    const data = await readFile(filePath, "utf-8");
    const results = JSON.parse(data);

    return NextResponse.json({
      status: "success",
      data: results,
    });
  } catch (error) {
    console.error("[results] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to load results" },
      { status: 500 }
    );
  }
}
