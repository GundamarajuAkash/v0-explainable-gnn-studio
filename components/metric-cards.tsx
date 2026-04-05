'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardsProps {
  metrics: { label: string; value: string | number; description?: string; variant?: 'default' | 'success' | 'warning' }[]
}

export function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
      {metrics.map((m) => (
        <Card
          key={m.label}
          className={cn(
            'border-border bg-card',
            m.variant === 'success' && 'border-accent/30',
            m.variant === 'warning' && 'border-destructive/30'
          )}
        >
          <CardContent className="p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {m.label}
            </p>
            <p className={cn(
              'text-lg font-bold',
              m.variant === 'success' ? 'text-accent' : m.variant === 'warning' ? 'text-destructive' : 'text-card-foreground'
            )}>
              {typeof m.value === 'number' ? m.value.toFixed(4) : m.value ?? '—'}
            </p>
            {m.description && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{m.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
