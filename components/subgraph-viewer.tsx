'use client'

import { useRef, useMemo, useEffect, useCallback, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ExplainabilityResult } from '@/lib/types'

// Dynamically import react-force-graph-2d to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 flex items-center justify-center bg-muted/20 rounded-md border border-border">
      <span className="text-xs text-muted-foreground">Loading graph...</span>
    </div>
  ),
})

interface SubgraphViewerProps {
  result: ExplainabilityResult
}

interface GraphNode {
  id: number
  label: number
  isTarget: boolean
  importance?: number
}

interface GraphLink {
  source: number
  target: number
  importance: number
}

export function SubgraphViewer({ result }: SubgraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<unknown>(null)
  const [dims, setDims] = useState({ width: 500, height: 288 })

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setDims({
        width: entry.contentRect.width || 500,
        height: entry.contentRect.height || 288,
      })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Build graph data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = result.subgraphNodes.map((n) => ({
      id: n.id,
      label: n.label,
      isTarget: n.isTarget,
    }))

    const links: GraphLink[] = result.subgraphEdges.map((e) => ({
      source: e.source,
      target: e.target,
      importance: e.importance,
    }))

    return { nodes, links }
  }, [result])

  // Node color based on target status
  const nodeColor = useCallback((node: GraphNode) => {
    if (node.isTarget) return 'hsl(0, 72%, 51%)' // destructive red
    return 'hsl(221, 83%, 53%)' // chart-1 blue
  }, [])

  // Node canvas rendering
  const nodeCanvasObject = useCallback(
    (node: GraphNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const radius = node.isTarget ? 10 : 7

      // Node circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = node.isTarget ? 'hsla(0, 72%, 51%, 0.2)' : 'hsla(221, 83%, 53%, 0.15)'
      ctx.fill()
      ctx.strokeStyle = nodeColor(node)
      ctx.lineWidth = node.isTarget ? 2.5 : 1.5
      ctx.stroke()

      // Node label
      ctx.font = `${node.isTarget ? 'bold ' : ''}9px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = nodeColor(node)
      ctx.fillText(String(node.id), x, y)
    },
    [nodeColor]
  )

  // Link width based on importance
  const linkWidth = useCallback((link: GraphLink) => {
    return 1 + link.importance * 3
  }, [])

  // Link color with opacity based on importance
  const linkColor = useCallback((link: GraphLink) => {
    const opacity = 0.3 + link.importance * 0.7
    return `hsla(221, 83%, 53%, ${opacity})`
  }, [])

  // Center on target node after initial render
  useEffect(() => {
    const fg = graphRef.current as { centerAt?: (x: number, y: number, ms: number) => void; zoom?: (k: number, ms: number) => void } | null
    if (fg && fg.centerAt && fg.zoom) {
      setTimeout(() => {
        fg.centerAt(0, 0, 500)
        fg.zoom(2.5, 500)
      }, 300)
    }
  }, [result])

  return (
    <div
      ref={containerRef}
      className="w-full h-72 rounded-md border border-border bg-muted/20 overflow-hidden"
    >
      <ForceGraph2D
        ref={graphRef}
        width={dims.width}
        height={dims.height}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: GraphNode & { x?: number; y?: number }, color, ctx) => {
          const x = node.x ?? 0
          const y = node.y ?? 0
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x, y, 10, 0, 2 * Math.PI)
          ctx.fill()
        }}
        linkWidth={linkWidth}
        linkColor={linkColor}
        linkDirectionalParticles={0}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        cooldownTicks={50}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.3}
        backgroundColor="transparent"
      />
    </div>
  )
}
