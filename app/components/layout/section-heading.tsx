import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const sectionHeadingVariants = cva('flex flex-col gap-2', {
  variants: {
    align: {
      left: 'items-start text-left',
      center: 'items-center text-center',
    },
  },
  defaultVariants: {
    align: 'left',
  },
})

const sectionHeadingTitleVariants = cva('font-semibold tracking-tight text-foreground', {
  variants: {
    size: {
      default: 'text-2xl md:text-3xl',
      lg: 'text-3xl md:text-4xl',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

interface SectionHeadingProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof sectionHeadingVariants>,
    VariantProps<typeof sectionHeadingTitleVariants> {
  title: string
  description?: string
  /** Small uppercase label above the title, e.g. "Was uns auszeichnet". */
  eyebrow?: string
  /** Heading level, for consistent H2/H3 hierarchy within a page. Defaults to h2. */
  level?: 2 | 3
}

function SectionHeading({
  className,
  title,
  description,
  eyebrow,
  align,
  size,
  level = 2,
  ...props
}: SectionHeadingProps) {
  const Heading = level === 3 ? 'h3' : 'h2'

  return (
    <div
      data-slot="section-heading"
      className={cn(sectionHeadingVariants({ align }), className)}
      {...props}
    >
      {eyebrow ? (
        <span className="font-mono text-xs tracking-wide text-secondary uppercase">{eyebrow}</span>
      ) : null}
      <Heading className={cn(sectionHeadingTitleVariants({ size }))}>{title}</Heading>
      {description ? (
        <p className="max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export { SectionHeading }
