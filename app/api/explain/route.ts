import { NextRequest, NextResponse } from "next/server"

// Normalize string values
const norm = (v: any): string => String(v).toLowerCase().trim()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { dataset_id, model, method, node_id } = body

    console.log("[v0] EXPLAIN REQUEST")
    console.log("[v0] DATASET:", dataset_id)
    console.log("[v0] INPUT:", { model, method, node_id })

    // Fetch explainer results from the endpoint
    const response = await fetch(
      `${req.nextUrl.origin}/api/explainer/${encodeURIComponent(dataset_id || "")}`,
      { method: "GET" }
    )

    if (!response.ok) {
      console.error("[v0] Failed to fetch explainer results:", response.status)
      return NextResponse.json(
        { error: "Failed to fetch explanation data" },
        { status: response.status }
      )
    }

    const data = await response.json()
    const rows = Array.isArray(data) ? data : Object.values(data)

    console.log("[v0] ROWS:", rows.length)
    if (rows.length > 0) {
      console.log("[v0] SAMPLE:", rows[0])
    }

    // Match row by model and method
    const match = rows.find(
      (row: any) =>
        norm(row.Model) === norm(model) &&
        norm(row.Method) === norm(method)
    )

    console.log("[v0] MATCH:", match ? "found" : "not found")

    if (!match) {
      return NextResponse.json(
        { error: "No explanation found", inputs: { model, method, node_id } },
        { status: 404 }
      )
    }

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

    console.log("[v0] RETURNING:", explainResult)
    return NextResponse.json(explainResult)
  } catch (error) {
    console.error("[v0] Explain API error:", error)
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 500 }
    )
  }
}

