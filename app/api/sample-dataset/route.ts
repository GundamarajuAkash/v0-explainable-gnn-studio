export async function GET() {
  // Mock sample dataset for testing URL upload feature
  const sampleDataset = {
    name: 'Sample_Test_Graph',
    nodes: [
      { id: 0, label: 0, features: [0.1, 0.2, 0.3, 0.4, 0.5] },
      { id: 1, label: 0, features: [0.15, 0.25, 0.35, 0.45, 0.55] },
      { id: 2, label: 1, features: [0.2, 0.3, 0.4, 0.5, 0.6] },
      { id: 3, label: 1, features: [0.25, 0.35, 0.45, 0.55, 0.65] },
      { id: 4, label: 1, features: [0.3, 0.4, 0.5, 0.6, 0.7] },
      { id: 5, label: 2, features: [0.35, 0.45, 0.55, 0.65, 0.75] },
      { id: 6, label: 0, features: [0.4, 0.5, 0.6, 0.7, 0.8] },
      { id: 7, label: 2, features: [0.45, 0.55, 0.65, 0.75, 0.85] },
      { id: 8, label: 1, features: [0.5, 0.6, 0.7, 0.8, 0.9] },
      { id: 9, label: 2, features: [0.55, 0.65, 0.75, 0.85, 0.95] },
    ],
    edges: [
      { source: 0, target: 1 },
      { source: 0, target: 2 },
      { source: 1, target: 3 },
      { source: 2, target: 4 },
      { source: 2, target: 5 },
      { source: 3, target: 4 },
      { source: 3, target: 6 },
      { source: 4, target: 7 },
      { source: 5, target: 8 },
      { source: 6, target: 9 },
      { source: 7, target: 8 },
      { source: 8, target: 9 },
    ],
  }

  return Response.json(sampleDataset)
}
