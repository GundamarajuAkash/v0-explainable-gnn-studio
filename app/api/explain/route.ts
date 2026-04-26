import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs/promises"

// Normalize string values
const norm = (v: any): string => String(v || "").toLowerCase().trim()

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
    
    // Log actual structure
    if (rows.length > 0) {
      console.log("[v0] SAMPLE ROW:", JSON.stringify(rows[0]))
      console.log("[v0] ALL KEYS:", Object.keys(rows[0]))
    }

    // Normalize inputs
    const inputModel = norm(model)
    const inputMethod = norm(method)
    const inputNode = Number(node_id)

    console.log("[v0] INPUT NORMALIZED:", { inputModel, inputMethod, inputNode })

    // Match row by model and method with fallbacks for both capitalized and lowercase
    const match = rows.find(
      (row: any) =>
        norm(row.Model ?? row.model) === inputModel &&
        norm(row.Method ?? row.method) === inputMethod
    )

    console.log("[v0] MATCH:", match ? "FOUND" : "NOT FOUND")

    if (!match) {
      const availableModels = [...new Set(rows.map((r: any) => r.Model ?? r.model))]
      const availableMethods = [...new Set(rows.map((r: any) => r.Method ?? r.method))]
      console.log("[v0] AVAILABLE MODELS:", availableModels)
      console.log("[v0] AVAILABLE METHODS:", availableMethods)
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

    // Extract fidelity and coverage with proper fallbacks for capitalized keys
    const fidelity = parseValue(
      match.Fidelity ?? match.fidelity ?? match.fidelity_score ?? 0
    )
    const coverage = parseValue(
      match.Coverage ?? match.coverage ?? match.coverage_score ?? 0
    )

    console.log("[v0] FIDELITY RAW:", match.Fidelity ?? match.fidelity)
    console.log("[v0] COVERAGE RAW:", match.Coverage ?? match.coverage)
    console.log("[v0] FIDELITY PARSED:", fidelity)
    console.log("[v0] COVERAGE PARSED:", coverage)

    const explainResult = {
      fidelity,
      coverage,
      explanation: match,
    }

    console.log("[v0] RETURNING:", explainResult)
    return NextResponse.json(explainResult)
  } catch (error) {
    console.error("[v0] Explain API error:", error)
    return NextResponse.json(
      { error: "Failed to generate explanation", details: String(error) },
      { status: 500 }
    )
  }
}


