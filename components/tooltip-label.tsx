'use client'

import { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle, FlaskConical } from 'lucide-react'

interface TooltipLabelProps {
  label: string | ReactNode
  title: string
  explanation: string
  showIcon?: boolean
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function TooltipLabel({
  label,
  title,
  explanation,
  showIcon = false,
  side = 'top',
}: TooltipLabelProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <span>{label}</span>
            {showIcon && <HelpCircle className="w-3.5 h-3.5 text-muted-foreground opacity-60 hover:opacity-100" />}
          </div>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{explanation}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Renders a method name with special visual treatment for "svwng" (proposed method). */
export function MethodLabel({ method, className }: { method: string; className?: string }) {
  const isSvwng = method === 'svwng'
  if (!isSvwng) {
    return <span className={className}>{method}</span>
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <span className="font-semibold text-primary">{method}</span>
      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 border border-primary/30 px-1.5 py-0 text-[10px] font-semibold text-primary leading-4">
        <FlaskConical className="w-2.5 h-2.5" />
        Proposed Method
      </span>
    </span>
  )
}
