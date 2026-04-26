import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"

// Normalize string values
const norm = (v: any): string => String(v).toLowerCase().trim()

// Map dataset name to JSON file
const fileMap: Record<string, string> = {
  cora: "cora_explainer.json",
  citeseer: "citeseer_explainer.json",
  computers: "computers_explainer.json",
  photo: "photo_explainer.json",
  pubmed: "pubmed_explainer.json",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dataset_id, model, method, node_id } = body

    // Normalize dataset (strip "pyg-" prefix)
    const rawDataset = String(dataset_id || "").toLowerCase().replace(/^pyg-/, "").trim()
    const fileName = fileMap[rawDataset]

    console.log("[v0] DATASET:", rawDataset)
    console.log("[v0] FILE:", fileName)
    console.log("[v0] INPUT:", { model, method, node_id })

    if (!fileName) {
      return NextResponse.json(
        { error: "Invalid dataset", received: dataset_id },
        { status: 400 }
      )
    }

    // Read JSON file directly
    const filePath = path.join(process.cwd(), "public", "results", fileName)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const data = JSON.parse(fileContent)

    const rows = Array.isArray(data) ? data : Object.values(data)
    console.log("[v0] ROWS:", rows.length)

    // Normalize inputs
    const inputModel = norm(model)
    const inputMethod = norm(method)
    const inputNode = Number(node_id)

    // Match row by model and method
    const match = rows.find(
      (row: any) =>
        norm(row.Model) === inputModel &&
        norm(row.Method) === inputMethod
    )

    console.log("[v0] MATCH:", match ? "FOUND" : "NOT FOUND")

    if (!match) {
      const availableModels = [...new Set(rows.map((r: any) => r.Model))]
      const availableMethods = [...new Set(rows.map((r: any) => r.Method))]
      return NextResponse.json(
        {
          error: "No match found",
          inputs: { model, method, node_id },
          available: { models: availableModels, methods: availableMethods },
          sample: rows[0],
        },
        { status: 404 }
      )
    }

    // Parse metric values (handle "X.XX ± Y.YY" format)
    const parseValue = (val: any): number => {
      if (typeof val === "number") return val
      if (typeof val === "string") {
        const numMatch = String(val).match(/^([\d.]+)/)
        return numMatch ? parseFloat(numMatch[1]) : 0
      }
      return 0
    }

    // Extract fidelity and coverage
    const fidelity = parseValue(match.fidelity ?? match.fidelity_score ?? match.Fidelity ?? 0)
    const coverage = parseValue(match.coverage ?? match.coverage_score ?? match.Coverage ?? 0)

    const explainResult = {
      fidelity,
      coverage,
      explanation: match,
    }

    console.log("[v0] RETURNING fidelity:", fidelity, "coverage:", coverage)
    return NextResponse.json(explainResult)
  } catch (error) {
    console.error("[v0] Explain API error:", error)
    return NextResponse.json(
      { error: "Failed to generate explanation", details: String(error) },
      { status: 500 }
    )
  }
}


