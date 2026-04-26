import { NextRequest, NextResponse } from "next/server"

// Normalize string values
const norm = (v: any): string => String(v).toLowerCase().trim()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dataset_id, model, method, node_id } = body

    // Normalize dataset_id (strip "pyg-" prefix)
    const normalizedDataset = (dataset_id || "").replace(/^pyg-/i, "")

    console.log("[v0] EXPLAIN REQUEST - dataset:", dataset_id, "-> normalized:", normalizedDataset)
    console.log("[v0] INPUT - model:", model, "method:", method, "node_id:", node_id)

    // Fetch explainer results from the endpoint
    const response = await fetch(
      `${req.nextUrl.origin}/api/explainer/${encodeURIComponent(normalizedDataset)}`,
      { method: "GET" }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error("[v0] Failed to fetch explainer - status:", response.status, "body:", errText)
      return NextResponse.json(
        { error: "Failed to fetch explanation data", status: response.status },
        { status: response.status }
      )
    }

    const data = await response.json()
    const rows = Array.isArray(data) ? data : Object.values(data)

    console.log("[v0] Loaded", rows.length, "explainer rows")
    if (rows.length > 0) {
      console.log("[v0] Sample row:", JSON.stringify(rows[0]).substring(0, 100))
    }

    // Match row by model and method
    const match = rows.find(
      (row: any) =>
        norm(row.Model) === norm(model) &&
        norm(row.Method) === norm(method)
    )

    if (!match) {
      console.log("[v0] No match found for model:", model, "method:", method)
      console.log("[v0] Available models:", [...new Set(rows.map((r: any) => r.Model))].join(", "))
      console.log("[v0] Available methods:", [...new Set(rows.map((r: any) => r.Method))].join(", "))
      return NextResponse.json(
        { error: "No explanation found for given inputs" },
        { status: 404 }
      )
    }

    console.log("[v0] Found matching row")

    // Parse metric values (handle "X.XX ± Y.YY" format)
    const parseValue = (val: any): number => {
      if (typeof val === "number") return val
      if (typeof val === "string") {
        const match = String(val).match(/^([\d.]+)/)
        return match ? parseFloat(match[1]) : 0
      }
      return 0
    }

    // Extract fidelity and coverage with fallbacks
    const fidelity = parseValue(match.fidelity ?? match.fidelity_score ?? match.Fidelity ?? 0)
    const coverage = parseValue(match.coverage ?? match.coverage_score ?? match.Coverage ?? 0)

    // Map fields safely
    const explainResult = {
      fidelity,
      coverage,
      explanation: {
        nodeId: Number(node_id ?? 0),
        predictedClass: 0,
        trueClass: 0,
        confidence: 0.5,
        subgraphNodes: [Number(node_id ?? 0)],
        subgraphEdges: [],
        featureImportance: [],
      }
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


