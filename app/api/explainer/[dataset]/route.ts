import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Map dataset names to file names (lowercase, handle variations)
function normalizeDatasetName(dataset: string): string | null {
  const lower = dataset.toLowerCase().replace(/\s+/g, '-').replace(/^pyg-/, '') // Remove "pyg-" prefix
  
  // Handle various input formats
  const mappings: Record<string, string> = {
    "cora": "cora",
    "citeseer": "citeseer",
    "pubmed": "pubmed",
    "amazon-photo": "photo",
    "amazonphoto": "photo",
    "amazon_photo": "photo",
    "photo": "photo",
    "amazon-computers": "computers",
    "amazoncomputers": "computers",
    "amazon_computers": "computers",
    "computers": "computers",
  }

  return mappings[lower] || null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string }> }
) {
  try {
    const { dataset } = await params
    const normalizedName = normalizeDatasetName(dataset)
    
    console.log('[v0] Explainer request - dataset:', dataset, '-> normalized:', normalizedName)
    
    if (!normalizedName) {
      console.log('[v0] Unknown dataset:', dataset)
      return NextResponse.json(
        { error: `Unknown dataset: ${dataset}` },
        { status: 404 }
      )
    }
    
    // Try to load from JSON file
    const jsonFile = path.join(process.cwd(), 'public', 'results', `${normalizedName}_explainer.json`)
    
    console.log('[v0] Looking for explainer file:', jsonFile)
    if (fs.existsSync(jsonFile)) {
      const data = fs.readFileSync(jsonFile, 'utf-8')
      const parsed = JSON.parse(data)
      console.log('[v0] Loaded explainer results, rows:', Array.isArray(parsed) ? parsed.length : 1)
      return NextResponse.json(parsed)
    }
    
    console.log('[v0] Explainer file not found:', jsonFile)
    return NextResponse.json(
      { error: `Explainer results not found for dataset: ${dataset}` },
      { status: 404 }
    )
  } catch (error) {
    console.error('[v0] Error loading explainer results:', error)
    return NextResponse.json(
      { error: 'Failed to load explainer results' },
      { status: 500 }
    )
  }
}

