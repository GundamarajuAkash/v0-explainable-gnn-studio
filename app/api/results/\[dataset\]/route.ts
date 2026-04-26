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

    if (!datasetKey) {
      return NextResponse.json(
        { error: `Unknown dataset: ${dataset}` },
        { status: 400 }
      )
    }

    const fileName = `${datasetKey}_results.json`
    const filePath = join(process.cwd(), "public/results", fileName)

    const data = await readFile(filePath, "utf-8")
    const results = JSON.parse(data)

    return NextResponse.json(results)
  } catch (error) {
    console.error("[v0] Results GET error:", error)
    return NextResponse.json(
      { error: "Failed to load results" },
      { status: 500 }
    )
  }
}
