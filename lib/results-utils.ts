import * as api from '@/lib/api'

export async function fetchTrainingResults(dataset: string) {
  try {
    const results = await api.getResultsData(dataset, 'after')
    return results
  } catch (error) {
    console.error('[v0] Failed to fetch training results:', error)
    return []
  }
}

export async function fetchExplainerResults(dataset: string) {
  try {
    const results = await api.getExplainerResults(dataset)
    return results
  } catch (error) {
    console.error('[v0] Failed to fetch explainer results:', error)
    return []
  }
}

export function parseMetric(metricStr: string): { value: number; ci: number } {
  const match = metricStr.match(/([\d.]+)\s*±\s*([\d.]+)/)
  if (match) {
    return {
      value: parseFloat(match[1]),
      ci: parseFloat(match[2]),
    }
  }
  return { value: 0, ci: 0 }
}

export function groupResultsByModel(results: api.APIResultRow[]): Record<string, api.APIResultRow[]> {
  const grouped: Record<string, api.APIResultRow[]> = {}
  results.forEach((row) => {
    if (!grouped[row.Model]) {
      grouped[row.Model] = []
    }
    grouped[row.Model].push(row)
  })
  return grouped
}

export function groupResultsByMethod(results: api.APIResultRow[]): Record<string, api.APIResultRow[]> {
  const grouped: Record<string, api.APIResultRow[]> = {}
  results.forEach((row) => {
    const method = row.Method || 'baseline'
    if (!grouped[method]) {
      grouped[method] = []
    }
    grouped[method].push(row)
  })
  return grouped
}
