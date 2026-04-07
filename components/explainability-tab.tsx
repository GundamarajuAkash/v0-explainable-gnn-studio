'use client'

import { useState } from 'react'

export function ExplainabilityTab() {
  const [dataset, setDataset] = useState('cora')
  const [model, setModel] = useState('gcn')
  const [method, setMethod] = useState('baseline')
  const [nodeId, setNodeId] = useState(0)
  const [explanation, setExplanation] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerateExplanation = async () => {
    try {
      setLoading(true)

      let datasetKey = dataset

      if (dataset === 'amazon-computers') datasetKey = 'computers'
      if (dataset === 'amazon-photo') datasetKey = 'photo'

      const res = await fetch(`/results/${datasetKey}_explainer.json`)
      let data = await res.json()

      if (!Array.isArray(data)) {
        data = Object.values(data)
      }

      const nodeData =
        data.find((item: any) =>
          item.node_id == nodeId ||
          item.id == nodeId ||
          item.node == nodeId
        ) || data[0]

      setExplanation(nodeData)
    } catch (error) {
      console.error('Error loading explanation:', error)
      setExplanation(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-4 flex-wrap">

        <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
          <option value="cora">Cora</option>
          <option value="citeseer">CiteSeer</option>
          <option value="pubmed">PubMed</option>
          <option value="amazon-computers">Amazon Computers</option>
          <option value="amazon-photo">Amazon Photo</option>
        </select>

        <select value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="gcn">GCN</option>
          <option value="graphsage">GraphSAGE</option>
          <option value="gat">GAT</option>
          <option value="chebnet">ChebNet</option>
          <option value="gin">GIN</option>
          <option value="pinsage">PinSAGE</option>
        </select>

        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="baseline">Baseline</option>
          <option value="weighted">Weighted</option>
          <option value="focal">Focal</option>
          <option value="oversample">Oversample</option>
          <option value="undersample">Undersample</option>
          <option value="nodeimport">NodeImport</option>
          <option value="svwng">SVWNG</option>
        </select>

        <input
          type="number"
          value={nodeId}
          onChange={(e) => setNodeId(Number(e.target.value))}
          className="border px-2 py-1"
        />

        <button
          onClick={handleGenerateExplanation}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Loading...' : 'Generate Explanation'}
        </button>
      </div>

      <div className="mt-4">
        {!explanation && !loading && (
          <p>No explanation generated yet.</p>
        )}

        {loading && <p>Loading...</p>}

        {explanation && (
          <div className="space-y-2">
            <h3 className="font-bold">Node: {nodeId}</h3>

            <p>Predicted Class: {explanation.predictedClass}</p>
            <p>Confidence: {explanation.confidence}</p>
            <p>True Class: {explanation.trueClass}</p>

            <div>
              <h4 className="font-semibold">Top Features:</h4>
              <ul>
                {explanation.featureImportance?.map((f: any, i: number) => (
                  <li key={i}>
                    {f.feature_name}: {f.importance}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p>Fidelity: {explanation.fidelity}</p>
              <p>Coverage: {explanation.coverage}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
