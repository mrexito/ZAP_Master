import type { MouseEvent } from 'react'
import NextLink from 'next/link'
import { Link } from '@/i18n/navigation'
import type { BookingAction } from '@/types/marketing'
import { Button } from '@/app/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'

interface BookingButtonProps {
  action: BookingAction
  onBook?: () => void
  block?: boolean
}

// Der eigentliche Buchungs-Flow bleibt der bestehende anmeldung-modal.tsx (Abschnitt 1b) -- "modal"
// ruft nur onBook auf, statt eine zweite, unabhängige Buchungsmodalität zu bauen.
function BookingButton({ action, onBook, block = false }: BookingButtonProps) {
  const className = block ? 'w-full min-h-[44px]' : 'min-h-[44px]'

  if (action.kind === 'disabled') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={block ? 'block w-full' : 'inline-block'}>
              <Button variant="outline" disabled aria-disabled="true" className={className}>
                {action.label}
                <span className="sr-only"> — {action.disabledReason}</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{action.disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (action.kind === 'link') {
    return (
      <Button asChild className={className}>
        {action.localized === false ? (
          <NextLink href={action.href}>{action.label}</NextLink>
        ) : (
          <Link href={action.href}>{action.label}</Link>
        )}
      </Button>
    )
  }

  // WebKit/Safari fokussiert Buttons bei einem Maus-Klick anders als Chromium/Firefox nicht
  // automatisch (bekannter Engine-Unterschied). AnmeldungModal liest beim Öffnen
  // `document.activeElement`, um den Fokus nach dem Schliessen dorthin zurückzugeben (Abschnitt
  // 10.4, Tastatur/Fokus) -- ohne den expliziten Aufruf hier bliebe document.activeElement in
  // Safari beim Öffnen bereits `<body>`, und die Fokus-Rückgabe liefe ins Leere. Der explizite
  // Aufruf macht das Verhalten browserunabhängig, statt sich auf native Klick-Fokussierung zu
  // verlassen.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.focus()
    onBook?.()
  }

  return (
    <Button onClick={handleClick} className={className}>
      {action.label}
    </Button>
  )
}

export { BookingButton }
