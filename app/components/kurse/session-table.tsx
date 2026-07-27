import type { SessionColumn, SessionRow } from '@/types/marketing'
import { StatusBadge } from '@/app/components/kurse/status-badge'
import { SessionDetails } from '@/app/components/kurse/session-details'
import { BookingButton } from '@/app/components/kurse/booking-button'
import { formatChfRappen } from '@/lib/pricing'

interface SessionTableProps {
  columns: SessionColumn[]
  rows: SessionRow[]
  ariaLabel?: string
  onBook?: (row: SessionRow) => void
}

// Gleiche Zugänglichkeits-Strategie wie im gelieferten SessionTable.jsx-Prototyp: EINE
// Datenquelle, ZWEI Render-Pfade (echte <table> ab md:, Karten-Liste darunter, beide im DOM via
// hidden/md:hidden statt display:none-CSS-Trick, damit Screenreader nichts doppelt vorlesen).
// Anders als der Prototyp liest diese Version echte SessionRow.availability/bookingAction/ablauf
// statt der veralteten flachen row.status/row.href/row.ablauf-Felder.
function SessionTable({ columns, rows, ariaLabel = 'Kursübersicht und Buchung', onBook }: SessionTableProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <table className="hidden w-full border-collapse text-[13.5px] md:table">
        <caption className="sr-only">{ariaLabel}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="border-t border-border px-2 py-3 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase first:border-t-0"
              >
                {column.label}
              </th>
            ))}
            <th scope="col" className="border-t-0 px-2 py-3">
              <span className="sr-only">Aktion</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={index % 2 === 1 ? 'bg-muted/40' : undefined}>
              {columns.map((column) => (
                <td key={column.key} className="border-t border-border px-2 py-[11px] align-top">
                  {renderCell(row, column)}
                </td>
              ))}
              <td className="border-t border-border px-2 py-[11px] align-top">
                <BookingButton action={row.bookingAction} onBook={() => onBook?.(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-3 p-3 md:hidden" aria-label={ariaLabel}>
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 font-serif text-[16.5px] font-semibold text-foreground">{row.kurs}</p>
            <dl className="space-y-2">
              {columns
                .filter((column) => column.key !== 'kurs')
                .map((column) => (
                  <div key={column.key} className="border-t border-border pt-2">
                    <dt className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                      {column.mobileLabel ?? column.label}
                    </dt>
                    <dd>{renderCell(row, column)}</dd>
                  </div>
                ))}
            </dl>
            <div className="mt-3 border-t border-border pt-3">
              <BookingButton action={row.bookingAction} onBook={() => onBook?.(row)} block />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function renderCell(row: SessionRow, column: SessionColumn) {
  switch (column.key) {
    case 'status':
      return <StatusBadge status={row.availability.status} />
    case 'details':
      return <SessionDetails ablauf={row.ablauf} label={column.label} />
    case 'location':
      return row.standort
    case 'date':
      return row.dateLabel
    case 'time':
      return row.timeLabel
    case 'kurs':
      return row.kurs
    case 'price':
      return (
        <span className="flex flex-col gap-0.5">
          <span>{formatChfRappen(row.pricing.effectivePriceRappen)}</span>
          {row.pricing.isEarlyBird ? (
            <span className="font-mono text-[11px] text-secondary">Frühbucherpreis</span>
          ) : null}
        </span>
      )
    case 'booking':
      return null
    default:
      return null
  }
}

export { SessionTable }
