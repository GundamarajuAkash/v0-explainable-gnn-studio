import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000"
    console.log("[v0] Proxying to backend:", backendUrl)

    const response = await fetch(`${backendUrl}/api/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Backend error:", response.status, error)
      return NextResponse.json(
        { status: "error", message: `Backend returned ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Explain API error:", error)
    return NextResponse.json(
      { status: "error", message: "Failed to generate explanation" },
      { status: 500 }
    )
  }
}
