import { METHODS } from '@/lib/types'

export function getBalancedDistribution(
  originalCounts: Record<number, number>,
  method: string
): Record<number, number> {
  if (method === 'baseline') {
    return originalCounts
  }

  const counts = { ...originalCounts }
  const values = Object.values(counts)
  const maxCount = Math.max(...values)
  const minCount = Math.min(...values)

  if (method === 'oversample') {
    // Oversample minority classes to match majority
    for (const key in counts) {
      counts[key] = maxCount
    }
  } else if (method === 'undersample') {
    // Undersample majority classes to match minority
    for (const key in counts) {
      counts[key] = minCount
    }
  } else if (method === 'smote') {
    // SMOTE: synthetic oversampling - approximate with smooth transition
    const avgCount = (maxCount + minCount) / 2
    for (const key in counts) {
      counts[key] = Math.round(avgCount)
    }
  } else if (method === 'adasyn') {
    // ADASYN: adaptive synthetic - similar to SMOTE with weighted approach
    const avgCount = (maxCount + minCount) / 2
    for (const key in counts) {
      counts[key] = Math.round(avgCount * 1.1)
    }
  } else if (method === 'mixup') {
    // Mixup: interpolate between classes - moderate balancing
    const targetCount = Math.round(maxCount * 0.7 + minCount * 0.3)
    for (const key in counts) {
      counts[key] = targetCount
    }
  } else if (method === 'cutmix') {
    // CutMix: region-based mixing - similar effect to mixup
    const targetCount = Math.round(maxCount * 0.75 + minCount * 0.25)
    for (const key in counts) {
      counts[key] = targetCount
    }
  } else if (method === 'svwng') {
    // SVWNG: Support Vector Weighted Nearest Neighbor Generalization
    // Aggressive balancing using weighted re-sampling
    for (const key in counts) {
      counts[key] = maxCount
    }
  }

  return counts
}
