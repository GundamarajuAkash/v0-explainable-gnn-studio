import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const dataset = body.dataset_id || "cora"
    const nodeId = body.node_id

    let datasetKey = dataset.toLowerCase()

    // Fix dataset naming mismatch
    if (datasetKey === "amazon-computers") datasetKey = "computers"
    if (datasetKey === "amazon-photo") datasetKey = "photo"

    const filePath = path.join(
      process.cwd(),
      "public",
      "results",
      `${datasetKey}_explainer.json`
    )

    let rawData = JSON.parse(fs.readFileSync(filePath, "utf-8"))

    // Handle object vs array
    if (!Array.isArray(rawData)) {
      rawData = Object.values(rawData)
    }

    // Node-level filtering
    if (nodeId !== undefined) {
      const nodeData =
        rawData.find((item: any) =>
          item.node_id == nodeId ||
          item.id == nodeId ||
          item.node == nodeId
        ) || rawData[0] // fallback

      return NextResponse.json({
        status: "success",
        data: nodeData
      })
    }

    return NextResponse.json({
      status: "success",
      data: rawData
    })

  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to load JSON data" },
      { status: 500 }
    )
  }
}
