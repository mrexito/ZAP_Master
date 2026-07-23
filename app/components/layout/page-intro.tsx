import * as React from 'react'

import { cn } from '@/lib/utils'
import { Badge } from '@/app/components/ui/badge'

interface PageIntroProps extends React.ComponentProps<'div'> {
  title: string
  eyebrow?: string
  description?: React.ReactNode
  /** "center" für Hauptseiten (Abschnitt-Hero), "left" (Standard) für Kursdetailseiten. */
  align?: 'left' | 'center'
}

function PageIntro({ className, title, eyebrow, description, align = 'left', ...props }: PageIntroProps) {
  return (
    <div
      data-slot="page-intro"
      className={cn(
        'flex flex-col gap-3',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className
      )}
      {...props}
    >
      {eyebrow ? <Badge variant="secondary">{eyebrow}</Badge> : null}
      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-lg text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export { PageIntro }
