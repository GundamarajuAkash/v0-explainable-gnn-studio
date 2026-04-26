import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

const DATASET_KEY_MAP: Record<string, string> = {
  "cora": "cora",
  "citeseer": "citeseer",
  "pubmed": "pubmed",
  "computers": "computers",
  "amazon-computers": "computers",
  "photo": "photo",
  "amazon-photo": "photo",
}

export async function GET(
  request: NextRequest,
  { params }: { params: { dataset: string } }
) {
  try {
    const dataset = params.dataset
    const datasetKey = DATASET_KEY_MAP[dataset.toLowerCase()]

    console.log("[v0] Explainer GET - dataset:", dataset, "mapped to:", datasetKey)

    if (!datasetKey) {
      return NextResponse.json(
        { error: `Unknown dataset: ${dataset}` },
        { status: 400 }
      )
    }

    const fileName = `${datasetKey}_explainer.json`
    const filePath = join(process.cwd(), "public/results", fileName)

    console.log("[v0] Reading file:", filePath)

    const data = await readFile(filePath, "utf-8")
    const results = JSON.parse(data)

    console.log("[v0] Loaded", Array.isArray(results) ? results.length : Object.keys(results).length, "rows")

    return NextResponse.json(results)
  } catch (error) {
    console.error("[v0] Explainer GET error:", error)
    return NextResponse.json(
      { error: "Failed to load explainer results" },
      { status: 500 }
    )
  }
}
