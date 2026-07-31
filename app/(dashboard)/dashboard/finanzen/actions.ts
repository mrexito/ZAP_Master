'use server'

// Schritt 10d (Abschnitt 2.15 des Architektur-Briefings): Server Actions fuer das Finanz-Cockpit.
// Aggregationen laufen serverseitig in TS ueber wenige gezielte Abfragen (nicht als DB-View) --
// konsistent mit dem Muster aus getTeacherOverviewForPeriod (Schritt 10c). Admin-only.

import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@/lib/auth/config'
import { revalidatePath } from 'next/cache'
import {
  expenseEntryFormSchema,
  financialAdjustmentFormSchema,
  type ExpenseEntryFormInput,
  type FinancialAdjustmentFormInput,
  type ExpenseEntryDB,
  type FinancialPeriodDB,
  type RevenueBasis,
  type OfferFinancialSummary,
  type ExpenseCategory,
  type FinanzenActionResult,
} from '@/types/kurs-finanzen'
import { getAudienceDisplayLabel } from '@/lib/kurse/offer-admin-catalog'

async function requireAdminAuth(): Promise<
  | { authorized: true; userId: string; supabaseAccessToken: string }
  | { authorized: false; error: FinanzenActionResult<never> }
> {
  const session = await auth()
  if (!session?.user || !session.supabaseAccessToken) {
    return { authorized: false, error: { success: false, error: 'Du musst angemeldet sein, um diese Aktion auszuführen.' } }
  }
  if (session.user.role !== 'admin') {
    return { authorized: false, error: { success: false, error: 'Nur Administratorinnen und Administratoren sehen das Finanz-Cockpit.' } }
  }
  return { authorized: true, userId: session.user.id, supabaseAccessToken: session.supabaseAccessToken }
}

function yearBounds(year: number): { start: string; end: string } {
  return { start: `${year}-01-01T00:00:00Z`, end: `${year + 1}-01-01T00:00:00Z` }
}

const BASIS_TO_EVENT_TYPE: Record<RevenueBasis, 'booking' | 'payment'> = {
  booked: 'booking',
  paid: 'payment',
  recognized: 'booking', // "verdient" nutzt dieselben booking-Events, aber recognized_at statt occurred_at als Filterdatum
}

export type YearKpis = {
  participantCount: number
  bookedRappen: number
  paidRappen: number
  recognizedRappen: number
  refundRappen: number
  payrollCostRappen: number
  expenseCostRappen: number
  totalCostRappen: number
  resultRappen: number
  marginPercent: number
}

export async function getYearKpis(year: number): Promise<FinanzenActionResult<YearKpis>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { start, end } = yearBounds(year)

  const { data: events, error } = await supabase
    .from('financial_events')
    .select('event_type, amount_rappen, occurred_at, recognized_at')
    .gte('recognized_at', start)
    .lt('recognized_at', end)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Kennzahlen konnten nicht geladen werden.' }
  }

  const rows = events ?? []
  const bookedRappen = rows.filter((e) => e.event_type === 'booking').reduce((s, e) => s + e.amount_rappen, 0)
  const paidRappen = rows.filter((e) => e.event_type === 'payment').reduce((s, e) => s + e.amount_rappen, 0)
  const refundRappen = rows.filter((e) => e.event_type === 'refund').reduce((s, e) => s + e.amount_rappen, 0)
  const recognizedRappen = bookedRappen + refundRappen // Buchung minus Storno, periodengerecht per recognized_at
  const payrollCostRappen = -rows.filter((e) => e.event_type === 'payroll_cost').reduce((s, e) => s + e.amount_rappen, 0)
  const expenseCostRappen = -rows.filter((e) => e.event_type === 'course_expense' || e.event_type === 'overhead').reduce((s, e) => s + e.amount_rappen, 0)
  const totalCostRappen = payrollCostRappen + expenseCostRappen
  const resultRappen = recognizedRappen - totalCostRappen
  const marginPercent = recognizedRappen > 0 ? (resultRappen / recognizedRappen) * 100 : 0

  const { count: participantCount } = await supabase
    .from('intensivwoche_anmeldungen')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'storniert')
    .gte('created_at', start)
    .lt('created_at', end)

  return {
    success: true,
    data: {
      participantCount: participantCount ?? 0,
      bookedRappen,
      paidRappen,
      recognizedRappen,
      refundRappen,
      payrollCostRappen,
      expenseCostRappen,
      totalCostRappen,
      resultRappen,
      marginPercent,
    },
    message: 'Kennzahlen geladen',
  }
}

export type MonthlyPoint = { month: number; revenueRappen: number; costRappen: number }

export async function getMonthlySeries(year: number, basis: RevenueBasis): Promise<FinanzenActionResult<MonthlyPoint[]>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { start, end } = yearBounds(year)
  const revenueEventType = BASIS_TO_EVENT_TYPE[basis]

  const { data: events, error } = await supabase
    .from('financial_events')
    .select('event_type, amount_rappen, recognized_at')
    .gte('recognized_at', start)
    .lt('recognized_at', end)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Jahresverlauf konnte nicht geladen werden.' }
  }

  const points: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenueRappen: 0, costRappen: 0 }))
  for (const event of events ?? []) {
    const month = new Date(event.recognized_at).getUTCMonth()
    if (event.event_type === revenueEventType) {
      points[month].revenueRappen += event.amount_rappen
    } else if (event.event_type === 'refund' && basis !== 'paid') {
      points[month].revenueRappen += event.amount_rappen // negativ
    } else if (event.event_type === 'payroll_cost' || event.event_type === 'course_expense' || event.event_type === 'overhead') {
      points[month].costRappen += -event.amount_rappen
    }
  }

  return { success: true, data: points, message: 'Jahresverlauf geladen' }
}

export type CostBreakdown = { payrollRappen: number; byCategory: Record<ExpenseCategory, number>; totalRappen: number }

export async function getCostBreakdown(year: number): Promise<FinanzenActionResult<CostBreakdown>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { start, end } = yearBounds(year)

  const [payrollResult, expensesResult] = await Promise.all([
    supabase.from('financial_events').select('amount_rappen').eq('event_type', 'payroll_cost').gte('recognized_at', start).lt('recognized_at', end),
    supabase.from('expense_entries').select('category, amount_rappen').eq('status', 'approved').gte('service_date', start.slice(0, 10)).lt('service_date', end.slice(0, 10)),
  ])

  if (payrollResult.error || expensesResult.error) {
    console.error('Supabase Error:', payrollResult.error, expensesResult.error)
    return { success: false, error: 'Kostenstruktur konnte nicht geladen werden.' }
  }

  const payrollRappen = -(payrollResult.data ?? []).reduce((s, e) => s + e.amount_rappen, 0)
  const byCategory: Record<ExpenseCategory, number> = { room: 0, material: 0, marketing: 0, external_service: 0, overhead: 0 }
  for (const expense of expensesResult.data ?? []) {
    byCategory[expense.category as ExpenseCategory] += expense.amount_rappen
  }
  const totalRappen = payrollRappen + Object.values(byCategory).reduce((s, v) => s + v, 0)

  return { success: true, data: { payrollRappen, byCategory, totalRappen }, message: 'Kostenstruktur geladen' }
}

export async function getOfferProfitability(year: number, basis: RevenueBasis): Promise<FinanzenActionResult<OfferFinancialSummary[]>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { start, end } = yearBounds(year)

  const [offersResult, editionsResult, sessionsResult, eventsResult, payrollResult] = await Promise.all([
    supabase.from('offers').select('id, audience_id, kurstyp'),
    supabase.from('offer_editions').select('id, offer_id, school_year, public_title'),
    supabase.from('course_sessions').select('id, edition_id, kurs:intensivwoche_kurse!course_sessions_id_fkey(max_teilnehmer)'),
    supabase.from('financial_events').select('edition_id, event_type, amount_rappen').gte('recognized_at', start).lt('recognized_at', end).not('edition_id', 'is', null),
    supabase
      .from('payroll_snapshot_lines')
      .select('amount_rappen, duration_minutes, work_entry:work_entries!inner(session_id, work_date)')
      .gte('work_entry.work_date', start.slice(0, 10))
      .lt('work_entry.work_date', end.slice(0, 10)),
  ])

  if (offersResult.error || editionsResult.error || sessionsResult.error || eventsResult.error || payrollResult.error) {
    console.error('Supabase Error:', offersResult.error, editionsResult.error, sessionsResult.error, eventsResult.error, payrollResult.error)
    return { success: false, error: 'Angebotsauswertung konnte nicht geladen werden.' }
  }

  const offerById = new Map((offersResult.data ?? []).map((o) => [o.id, o]))
  type SessionRow = { id: number; edition_id: string; kurs: { max_teilnehmer: number } | null }
  const sessionsByEdition = new Map<string, SessionRow[]>()
  for (const session of (sessionsResult.data ?? []) as unknown as SessionRow[]) {
    const list = sessionsByEdition.get(session.edition_id) ?? []
    list.push(session)
    sessionsByEdition.set(session.edition_id, list)
  }

  // Direkte Lohnkosten je Edition: work_entries.session_id -> course_sessions.edition_id.
  const sessionToEdition = new Map<number, string>()
  for (const [editionId, sessions] of sessionsByEdition) {
    for (const s of sessions) sessionToEdition.set(s.id, editionId)
  }
  type PayrollLineRow = { amount_rappen: number; work_entry: { session_id: number | null } | null }
  const payrollByEdition = new Map<string, number>()
  for (const line of (payrollResult.data ?? []) as unknown as PayrollLineRow[]) {
    const sessionId = line.work_entry?.session_id
    const editionId = sessionId != null ? sessionToEdition.get(sessionId) : undefined
    if (editionId) payrollByEdition.set(editionId, (payrollByEdition.get(editionId) ?? 0) + line.amount_rappen)
  }

  const revenueEventType = BASIS_TO_EVENT_TYPE[basis]
  const revenueByEdition = new Map<string, number>()
  const paidByEdition = new Map<string, number>()
  const refundByEdition = new Map<string, number>()
  for (const event of eventsResult.data ?? []) {
    if (!event.edition_id) continue
    if (event.event_type === revenueEventType) revenueByEdition.set(event.edition_id, (revenueByEdition.get(event.edition_id) ?? 0) + event.amount_rappen)
    if (event.event_type === 'payment') paidByEdition.set(event.edition_id, (paidByEdition.get(event.edition_id) ?? 0) + event.amount_rappen)
    if (event.event_type === 'refund') refundByEdition.set(event.edition_id, (refundByEdition.get(event.edition_id) ?? 0) + event.amount_rappen)
  }

  // Teilnehmer je Edition: nicht stornierte Anmeldungen der zugehoerigen Kurssessions.
  const allSessionIds = Array.from(sessionToEdition.keys())
  const participantsByEdition = new Map<string, number>()
  if (allSessionIds.length > 0) {
    const { data: anmeldungen } = await supabase
      .from('intensivwoche_anmeldungen')
      .select('kurs_id')
      .neq('status', 'storniert')
      .in('kurs_id', allSessionIds)
    for (const a of anmeldungen ?? []) {
      const editionId = sessionToEdition.get(a.kurs_id!)
      if (editionId) participantsByEdition.set(editionId, (participantsByEdition.get(editionId) ?? 0) + 1)
    }
  }

  const summaries: OfferFinancialSummary[] = (editionsResult.data ?? [])
    .map((edition) => {
      const offer = offerById.get(edition.offer_id)
      if (!offer) return null
      const sessions = sessionsByEdition.get(edition.id) ?? []
      const capacity = sessions.length > 0 ? sessions.reduce((s, sess) => s + (sess.kurs?.max_teilnehmer ?? 0), 0) : null
      const occupancyApplicable = offer.kurstyp !== 'pruefungssimulation' && offer.kurstyp !== 'selbststudium'

      const summary: OfferFinancialSummary = {
        editionId: edition.id,
        offerLabel: edition.public_title,
        audienceId: offer.audience_id,
        schoolYear: edition.school_year,
        participantCount: participantsByEdition.get(edition.id) ?? 0,
        sessionCount: sessions.length,
        capacity,
        occupancyApplicable,
        bookedRevenueRappen: basis === 'booked' ? revenueByEdition.get(edition.id) ?? 0 : 0,
        paidRevenueRappen: paidByEdition.get(edition.id) ?? 0,
        recognizedRevenueRappen: revenueByEdition.get(edition.id) ?? 0,
        refundRappen: refundByEdition.get(edition.id) ?? 0,
        approvedWorkMinutes: 0,
        directCostRappen: -(payrollByEdition.get(edition.id) ?? 0),
      }
      return summary
    })
    .filter((s): s is OfferFinancialSummary => s !== null && (s.participantCount > 0 || s.recognizedRevenueRappen !== 0 || s.directCostRappen !== 0))

  return { success: true, data: summaries, message: 'Angebotsauswertung geladen' }
}

export type AudienceProfit = { audienceId: string; audienceLabel: string; contributionRappen: number }

export async function getBruttogewinnByAudience(year: number, basis: RevenueBasis): Promise<FinanzenActionResult<AudienceProfit[]>> {
  const result = await getOfferProfitability(year, basis)
  if (!result.success || !result.data) return result as FinanzenActionResult<AudienceProfit[]>

  const byAudience = new Map<string, number>()
  for (const summary of result.data) {
    const revenue = basis === 'booked' ? summary.bookedRevenueRappen : basis === 'paid' ? summary.paidRevenueRappen : summary.recognizedRevenueRappen
    const contribution = revenue + summary.refundRappen - summary.directCostRappen
    byAudience.set(summary.audienceId, (byAudience.get(summary.audienceId) ?? 0) + contribution)
  }

  const rows: AudienceProfit[] = Array.from(byAudience.entries()).map(([audienceId, contributionRappen]) => ({
    audienceId,
    audienceLabel: getAudienceDisplayLabel(audienceId as never),
    contributionRappen,
  }))

  return { success: true, data: rows, message: 'Bruttogewinn geladen' }
}

export async function getFinancialPeriodStatus(year: number): Promise<FinanzenActionResult<FinancialPeriodDB | null>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase.from('financial_periods').select('*').eq('year', year).maybeSingle()

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Periodenstatus konnte nicht geladen werden.' }
  }
  return { success: true, data: data as FinancialPeriodDB | null, message: 'Status geladen' }
}

export async function advanceFinancialPeriodAction(year: number): Promise<FinanzenActionResult<FinancialPeriodDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: existing } = await supabase.from('financial_periods').select('*').eq('year', year).maybeSingle()

  if (!existing) {
    const { data: created, error } = await supabase.from('financial_periods').insert({ year, status: 'review' }).select().single()
    if (error) {
      console.error('Supabase Error:', error)
      return { success: false, error: 'Periode konnte nicht angelegt werden.' }
    }
    revalidatePath('/dashboard/finanzen')
    return { success: true, data: created as FinancialPeriodDB, message: 'Periodenprüfung gestartet.' }
  }

  if (existing.status === 'locked') {
    return { success: false, error: 'Diese Periode ist bereits abgeschlossen.' }
  }

  const nextStatus = existing.status === 'open' ? 'review' : 'locked'
  const { data: updated, error } = await supabase
    .from('financial_periods')
    .update({ status: nextStatus, ...(nextStatus === 'locked' ? { locked_at: new Date().toISOString(), locked_by: authCheck.userId } : {}) })
    .eq('id', existing.id)
    .eq('version', existing.version)
    .select()
    .single()

  if (error || !updated) {
    return { success: false, error: 'Periode wurde zwischenzeitlich geändert. Bitte lade die Seite neu.' }
  }

  revalidatePath('/dashboard/finanzen')
  return { success: true, data: updated as FinancialPeriodDB, message: nextStatus === 'locked' ? 'Periode abgeschlossen.' : 'Periodenprüfung gestartet.' }
}

export async function reopenFinancialPeriodAction(year: number): Promise<FinanzenActionResult<FinancialPeriodDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: existing } = await supabase.from('financial_periods').select('*').eq('year', year).maybeSingle()

  if (!existing || existing.status !== 'locked') {
    return { success: false, error: 'Nur eine abgeschlossene Periode kann wieder geöffnet werden.' }
  }

  const { data: updated, error } = await supabase
    .from('financial_periods')
    .update({ status: 'review', locked_at: null, locked_by: null })
    .eq('id', existing.id)
    .eq('version', existing.version)
    .select()
    .single()

  if (error || !updated) {
    return { success: false, error: 'Periode wurde zwischenzeitlich geändert. Bitte lade die Seite neu.' }
  }

  revalidatePath('/dashboard/finanzen')
  return { success: true, data: updated as FinancialPeriodDB, message: 'Periode wieder geöffnet · Status: in Prüfung.' }
}

export async function saveExpenseEntryAction(input: ExpenseEntryFormInput): Promise<FinanzenActionResult<ExpenseEntryDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const parsed = expenseEntryFormSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string
      if (!fieldErrors[field]) fieldErrors[field] = []
      fieldErrors[field].push(issue.message)
    })
    return { success: false, error: 'Bitte überprüfe deine Eingaben.', fieldErrors }
  }

  const data = parsed.data
  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: created, error } = await supabase
    .from('expense_entries')
    .insert({
      category: data.category,
      amount_rappen: Math.round(data.amountChf * 100),
      service_date: data.serviceDate,
      receipt_ref: data.receiptRef || null,
      status: 'draft',
      created_by: authCheck.userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Ausgabe konnte nicht erfasst werden.' }
  }
  revalidatePath('/dashboard/finanzen')
  return { success: true, data: created as ExpenseEntryDB, message: 'Ausgabe erfasst.' }
}

export async function approveExpenseEntryAction(entryId: string, expectedVersion: number): Promise<FinanzenActionResult> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { error } = await supabase.from('expense_entries').update({ status: 'approved' }).eq('id', entryId).eq('version', expectedVersion)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Ausgabe konnte nicht genehmigt werden. Bitte lade die Seite neu.' }
  }
  revalidatePath('/dashboard/finanzen')
  return { success: true, message: 'Ausgabe genehmigt · im Ledger verbucht.' }
}

export async function getExpenseEntries(year: number): Promise<FinanzenActionResult<ExpenseEntryDB[]>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { start, end } = yearBounds(year)
  const { data, error } = await supabase
    .from('expense_entries')
    .select('*')
    .gte('service_date', start.slice(0, 10))
    .lt('service_date', end.slice(0, 10))
    .order('service_date', { ascending: false })

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Ausgaben konnten nicht geladen werden.' }
  }
  return { success: true, data: data as ExpenseEntryDB[], message: 'Ausgaben geladen' }
}

export async function saveFinancialAdjustmentAction(year: number, input: FinancialAdjustmentFormInput): Promise<FinanzenActionResult> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const parsed = financialAdjustmentFormSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    parsed.error.issues.forEach((issue) => {
      const field = issue.path[0] as string
      if (!fieldErrors[field]) fieldErrors[field] = []
      fieldErrors[field].push(issue.message)
    })
    return { success: false, error: 'Bitte überprüfe deine Eingaben.', fieldErrors }
  }

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: period, error: periodError } = await supabase.from('financial_periods').select('id').eq('year', year).maybeSingle()
  let periodId = period?.id
  if (periodError) {
    console.error('Supabase Error:', periodError)
    return { success: false, error: 'Periode konnte nicht geladen werden.' }
  }
  if (!periodId) {
    const { data: created, error } = await supabase.from('financial_periods').insert({ year }).select('id').single()
    if (error) {
      console.error('Supabase Error:', error)
      return { success: false, error: 'Periode konnte nicht angelegt werden.' }
    }
    periodId = created.id
  }

  const data = parsed.data
  const { error } = await supabase.from('financial_adjustments').insert({
    period_id: periodId,
    category: data.category || null,
    amount_rappen: Math.round(data.amountChf * 100),
    reason: data.reason,
    created_by: authCheck.userId,
  })

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Korrekturbuchung konnte nicht gespeichert werden.' }
  }
  revalidatePath('/dashboard/finanzen')
  return { success: true, message: 'Korrekturbuchung erfasst · im Ledger verbucht.' }
}
