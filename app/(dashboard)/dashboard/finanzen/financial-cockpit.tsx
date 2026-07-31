'use client'

// Schritt 10d: FinancialCockpit orchestriert RevenueCostChart/OfferProfitabilityTable sowie
// Filterleiste, KPIs, Kostenstruktur, Bruttogewinn-nach-Zielgruppen und Periodenpruefung aus
// Layout_Admin_Finanzcockpit.html.

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { RevenueCostChart } from '@/app/components/kurse-admin/revenue-cost-chart'
import { OfferProfitabilityTable } from '@/app/components/kurse-admin/offer-profitability-table'
import {
  EXPENSE_CATEGORY_LABELS,
  REVENUE_BASIS_LABELS,
  type RevenueBasis,
  type OfferFinancialSummary,
  type FinancialPeriodDB,
} from '@/types/kurs-finanzen'
import {
  getMonthlySeries,
  getCostBreakdown,
  getOfferProfitability,
  getBruttogewinnByAudience,
  saveExpenseEntryAction,
  saveFinancialAdjustmentAction,
  advanceFinancialPeriodAction,
  reopenFinancialPeriodAction,
  type MonthlyPoint,
  type CostBreakdown,
  type AudienceProfit,
  type YearKpis,
} from './actions'

const PERIOD_STATUS_LABELS: Record<'open' | 'review' | 'locked', string> = { open: 'offen', review: 'in Prüfung', locked: 'abgeschlossen' }
const PERIOD_ACTION_LABELS: Record<'open' | 'review' | 'locked', string> = { open: 'Periode prüfen', review: 'Periode abschliessen', locked: 'Abgeschlossen' }

function formatChf(rappen: number): string {
  return 'CHF ' + (rappen / 100).toLocaleString('de-CH', { maximumFractionDigits: 0 })
}

export function FinancialCockpit({ year, kpis, period }: { year: number; kpis: YearKpis; period: FinancialPeriodDB | null }) {
  const router = useRouter()
  const [basis, setBasis] = useState<RevenueBasis>('recognized')
  const [series, setSeries] = useState<MonthlyPoint[]>([])
  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null)
  const [offers, setOffers] = useState<OfferFinancialSummary[]>([])
  const [audienceProfit, setAudienceProfit] = useState<AudienceProfit[]>([])
  const [loading, startLoadingTransition] = useTransition()
  const [periodState, setPeriodState] = useState<'idle' | 'busy'>('idle')
  const [message, setMessage] = useState('')

  const [expenseCategory, setExpenseCategory] = useState<'room' | 'material' | 'marketing' | 'external_service' | 'overhead'>('room')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')

  useEffect(() => {
    startLoadingTransition(async () => {
      const [seriesResult, breakdownResult, offersResult, audienceResult] = await Promise.all([
        getMonthlySeries(year, basis),
        getCostBreakdown(year),
        getOfferProfitability(year, basis),
        getBruttogewinnByAudience(year, basis),
      ])
      if (seriesResult.success && seriesResult.data) setSeries(seriesResult.data)
      if (breakdownResult.success && breakdownResult.data) setBreakdown(breakdownResult.data)
      if (offersResult.success && offersResult.data) setOffers(offersResult.data)
      if (audienceResult.success && audienceResult.data) setAudienceProfit(audienceResult.data)
    })
  }, [year, basis, startLoadingTransition])

  const handleYearChange = (newYear: number) => router.push(`/dashboard/finanzen?year=${newYear}`)

  const handleAdvancePeriod = async () => {
    setPeriodState('busy')
    const result = await advanceFinancialPeriodAction(year)
    setPeriodState('idle')
    setMessage(result.success ? result.message : result.error)
    if (result.success) router.refresh()
  }

  const handleReopenPeriod = async () => {
    setPeriodState('busy')
    const result = await reopenFinancialPeriodAction(year)
    setPeriodState('idle')
    setMessage(result.success ? result.message : result.error)
    if (result.success) router.refresh()
  }

  const handleSaveExpense = async () => {
    setPeriodState('busy')
    const result = await saveExpenseEntryAction({ category: expenseCategory, amountChf: Number(expenseAmount), serviceDate: expenseDate, receiptRef: null })
    setPeriodState('idle')
    setMessage(result.success ? result.message : result.error)
    if (result.success) {
      setExpenseAmount('')
      router.refresh()
    }
  }

  const handleSaveAdjustment = async () => {
    setPeriodState('busy')
    const result = await saveFinancialAdjustmentAction(year, { amountChf: Number(adjustmentAmount), reason: adjustmentReason, category: null })
    setPeriodState('idle')
    setMessage(result.success ? result.message : result.error)
    if (result.success) {
      setAdjustmentAmount('')
      setAdjustmentReason('')
      router.refresh()
    }
  }

  const periodStatus = period?.status ?? 'open'
  const totalCostForBreakdown = breakdown?.totalRappen ?? 0

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-end gap-4 justify-between">
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Geschäftsjahr</label>
            <select value={year} onChange={(e) => handleYearChange(Number(e.target.value))} className="h-10 px-3 rounded-lg border border-border bg-background text-sm">
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Einnahmensicht</label>
            <select value={basis} onChange={(e) => setBasis(e.target.value as RevenueBasis)} className="h-10 px-3 rounded-lg border border-border bg-background text-sm">
              {Object.entries(REVENUE_BASIS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Badge variant={periodStatus === 'locked' ? 'default' : 'secondary'}>
            Geschäftsjahr {year} · {PERIOD_STATUS_LABELS[periodStatus]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleAdvancePeriod} disabled={periodState === 'busy' || periodStatus === 'locked'}>
            {periodState === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {PERIOD_ACTION_LABELS[periodStatus]}
          </Button>
          {periodStatus === 'locked' && (
            <Button type="button" variant="outline" onClick={handleReopenPeriod} disabled={periodState === 'busy'}>
              {periodState === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Wieder öffnen
            </Button>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
        <strong>Kapazitätsreferenz:</strong> 10 Schüler pro Kursgruppe. Auslastung = aktive Anmeldungen ÷ Summe der Kursgruppenkapazitäten. Für Prüfungssimulationen und Selbststudium wird keine Auslastung ausgewiesen.
      </div>

      {message && (
        <div className="rounded-xl border border-secondary/50 bg-secondary/10 p-3 text-sm">{message}</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <small className="font-mono text-[10px] uppercase text-muted-foreground">Teilnehmer</small>
          <strong className="block font-serif text-xl mt-1">{kpis.participantCount}</strong>
          <span className="text-xs text-muted-foreground">aktive Anmeldungen</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <small className="font-mono text-[10px] uppercase text-muted-foreground">Gebucht</small>
          <strong className="block font-serif text-xl mt-1">{formatChf(kpis.bookedRappen)}</strong>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <small className="font-mono text-[10px] uppercase text-muted-foreground">Bezahlt</small>
          <strong className="block font-serif text-xl mt-1">{formatChf(kpis.paidRappen)}</strong>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <small className="font-mono text-[10px] uppercase text-muted-foreground">Verdient</small>
          <strong className="block font-serif text-xl mt-1">{formatChf(kpis.recognizedRappen)}</strong>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <small className="font-mono text-[10px] uppercase text-muted-foreground">Gesamtkosten</small>
          <strong className="block font-serif text-xl mt-1">{formatChf(kpis.totalCostRappen)}</strong>
          <span className="text-xs text-muted-foreground">Lohn + übrige Kosten</span>
        </div>
        <div className="rounded-xl border border-secondary/40 bg-secondary/5 p-4">
          <small className="font-mono text-[10px] uppercase text-muted-foreground">Ergebnis</small>
          <strong className="block font-serif text-xl mt-1 text-secondary-foreground">{formatChf(kpis.resultRappen)}</strong>
          <span className="text-xs text-muted-foreground">{kpis.marginPercent.toFixed(1)}% Ergebnismarge</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Lädt …
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_0.9fr] gap-4">
            <RevenueCostChart points={series} />
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground mb-3">Kostenstruktur</h3>
              <div className="space-y-2">
                {breakdown && totalCostForBreakdown > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>Lohnkosten</span>
                      <strong>{((breakdown.payrollRappen / totalCostForBreakdown) * 100).toFixed(0)}%</strong>
                    </div>
                    {Object.entries(breakdown.byCategory).map(([category, rappen]) => (
                      <div key={category} className="flex justify-between text-sm">
                        <span>{EXPENSE_CATEGORY_LABELS[category as keyof typeof EXPENSE_CATEGORY_LABELS]}</span>
                        <strong>{((rappen / totalCostForBreakdown) * 100).toFixed(0)}%</strong>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-border flex justify-between font-serif text-lg">
                      <span className="text-sm text-muted-foreground self-center">Total</span>
                      <strong>{formatChf(totalCostForBreakdown)}</strong>
                    </div>
                  </>
                )}
                {(!breakdown || totalCostForBreakdown === 0) && <p className="text-sm text-muted-foreground">Keine Kosten im gewählten Jahr erfasst.</p>}
              </div>
              <div className="mt-4 rounded-lg border-l-4 border-accent bg-accent/10 p-3 text-xs text-foreground">
                <strong>Direkte Lohnkosten je Angebot:</strong> genehmigte Arbeitsminuten × vom Administrator hinterlegter, am Leistungsdatum gültiger Stundensatz. Das Cockpit übernimmt ausschliesslich den abgeschlossenen Payroll-Snapshot.
              </div>
            </section>
          </div>

          <OfferProfitabilityTable summaries={offers} basis={basis} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-base font-semibold text-foreground mb-3">Bruttogewinn nach Zielgruppen</h3>
              <div className="space-y-1">
                {audienceProfit.map((row) => (
                  <div key={row.audienceId} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{row.audienceLabel}</span>
                    <strong className={row.contributionRappen < 0 ? 'text-destructive' : ''}>{formatChf(row.contributionRappen)}</strong>
                  </div>
                ))}
                {audienceProfit.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten im gewählten Jahr.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground mb-2">Ausgabe erfassen</h3>
                <div className="grid grid-cols-2 gap-2">
                  <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value as typeof expenseCategory)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm">
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm" />
                  <input type="number" min={0} step={0.05} placeholder="Betrag CHF" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm col-span-2" />
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={handleSaveExpense} disabled={periodState === 'busy' || !expenseAmount}>
                  Als Entwurf erfassen
                </Button>
              </div>
              <div className="pt-3 border-t border-border">
                <h3 className="text-base font-semibold text-foreground mb-2">Korrekturbuchung</h3>
                <input type="number" step={0.05} placeholder="Betrag CHF (± )" value={adjustmentAmount} onChange={(e) => setAdjustmentAmount(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-sm w-full mb-2" />
                <textarea placeholder="Begründung" value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-sm resize-none mb-2" />
                <Button size="sm" variant="outline" className="w-full" onClick={handleSaveAdjustment} disabled={periodState === 'busy' || !adjustmentAmount || !adjustmentReason}>
                  Korrektur buchen
                </Button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
