import { NextResponse } from 'next/server'

// This endpoint is deprecated - use /api/datasets/pyg instead
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dataset = searchParams.get('dataset')

  if (!dataset) {
    return NextResponse.json(
      { error: 'Missing dataset parameter. Use /api/datasets/pyg to load PyG datasets.' },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/datasets/pyg to load PyTorch Geometric datasets.' },
    { status: 410 }
  )
}
