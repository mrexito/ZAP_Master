'use server'

// Schritt 10a (Abschnitt 2.12 des Architektur-Briefings): Server Actions für die Admin-Maske
// "Kursangebot verwalten". Mutationen sind admin-only (requireAdminAuth()); die lesenden
// Katalog-/Durchführungsabfragen stehen auch Lehrpersonen für die Tagesfreigaben zur Verfügung.
// Das deckt sich mit
// den RLS-Policies aus Migration 20260721074500_offer_editions_admin_writes.sql, die INSERT/UPDATE
// auf offer_editions/course_sessions/audit_log ausschliesslich für is_admin() erlauben.
//
// Verwendet wie die bestehenden /dashboard/kurse/actions.ts durchgehend
// createAuthenticatedSupabaseClient() (RLS mit dem eigenen Token des Admins), nicht den
// Service-Role-Client -- Mutationen bleiben dadurch an dieselbe RLS-Kette gebunden wie jede andere
// Nutzeraktion.

import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@/lib/auth/config'
import { revalidatePath, updateTag } from 'next/cache'
import { zurichLocalToUtcIso } from '@/lib/utils/zurich-time'
import {
  offerEditionFormSchema,
  courseSessionFormSchema,
  type OfferEditionFormInput,
  type CourseSessionFormInput,
  type OfferDB,
  type OfferEditionDB,
  type CourseSessionWithKursDB,
  type EditionActionResult,
} from '@/types/kurs-edition'
import { ADMIN_OFFER_CATALOG, findAdminOfferCatalogEntry, type AdminOfferCatalogEntry } from '@/lib/kurse/offer-admin-catalog'

async function requireAdminAuth(): Promise<
  | { authorized: true; userId: string; supabaseAccessToken: string }
  | { authorized: false; error: EditionActionResult<never> }
> {
  const session = await auth()
  if (!session?.user || !session.supabaseAccessToken) {
    return { authorized: false, error: { success: false, error: 'Du musst angemeldet sein, um diese Aktion auszuführen.' } }
  }
  if (session.user.role !== 'admin') {
    return { authorized: false, error: { success: false, error: 'Nur Administratorinnen und Administratoren dürfen Kursangebote verwalten.' } }
  }
  return { authorized: true, userId: session.user.id, supabaseAccessToken: session.supabaseAccessToken }
}

async function requireContentManagerAuth(): Promise<
  | { authorized: true; userId: string; supabaseAccessToken: string }
  | { authorized: false; error: EditionActionResult<never> }
> {
  const session = await auth()
  if (!session?.user || !session.supabaseAccessToken) {
    return { authorized: false, error: { success: false, error: 'Du musst angemeldet sein, um diese Aktion auszuführen.' } }
  }
  if (session.user.role !== 'admin' && session.user.role !== 'lehrperson') {
    return { authorized: false, error: { success: false, error: 'Nur Lehrpersonen sowie Administratorinnen und Administratoren dürfen Kursdurchführungen lesen.' } }
  }
  return { authorized: true, userId: session.user.id, supabaseAccessToken: session.supabaseAccessToken }
}

async function writeAuditLog(
  supabase: ReturnType<typeof createAuthenticatedSupabaseClient>,
  actorUserId: string,
  entityType: string,
  entityId: string,
  action: string,
  before: unknown,
  after: unknown
) {
  // Gefunden beim Hinzufügen des ersten End-to-End-Tests für diesen Pfad (zuvor rief keinerlei
  // automatisierter Test saveEditionAction auf einer bestehenden Edition auf): audit_log hat
  // ausschliesslich eine einzelne diff-jsonb-Spalte (20260720170000_offer_editions_schema.sql),
  // keine getrennten before-/after-Spalten -- jeder INSERT-Versuch schlug mit "Could not find the
  // 'after' column" fehl. Der RLS-/Grant-Teil war bereits korrekt: audit_log_admin_insert
  // (20260721074500_offer_editions_admin_writes.sql) erlaubt authenticated gezielt INSERT, aber
  // ausdrücklich nur mit actor_user_id = auth.uid() (kein Spoofen fremder Akteure) -- deshalb
  // bewusst weiterhin der authentifizierte Client des Admins selbst, kein service_role, das diese
  // WITH-CHECK-Schranke umgehen würde.
  //
  // Fehler beim Audit-Log dürfen die eigentliche Mutation nicht rückgängig machen -- best effort,
  // aber niemals die Fach-Aktion selbst blockieren.
  // JSON.parse(JSON.stringify(...)) statt eines Type-Casts: erzwingt echte, jsonb-taugliche Werte
  // (z.B. Date/undefined würden sonst den Json-Typ nur vorgetäuscht erfüllen) -- entspricht ohnehin
  // der Serialisierung, die beim HTTP-Request an PostgREST passieren würde.
  const { error } = await supabase
    .from('audit_log')
    .insert({
      actor_user_id: actorUserId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      diff: JSON.parse(JSON.stringify({ before, after })),
    })
  if (error) {
    console.error('audit_log insert failed', error)
  }
}

export type AdminOfferListEntry = AdminOfferCatalogEntry & { offerId: number }

// 1) Katalog: die 20 stabilen Angebote, angereichert um ihre echte DB-ID (für die Route
//    /dashboard/kurse/angebote/[offerId]/durchfuehrungen/[editionId] -- unter dem statischen
//    "angebote"-Präfix, weil Next.js App Router keine unterschiedlich benannten dynamischen
//    Segmente auf derselben Ebene erlaubt und /dashboard/kurse/[id] bereits für den bestehenden
//    Einzelkurs-Editor vergeben ist).
export async function getAdminOfferList(): Promise<EditionActionResult<AdminOfferListEntry[]>> {
  const authCheck = await requireContentManagerAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase.from('offers').select('*')

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Angebotskatalog konnte nicht geladen werden.' }
  }

  const offers = data as OfferDB[]
  const entries: AdminOfferListEntry[] = ADMIN_OFFER_CATALOG.map((entry) => {
    const dbOffer = offers.find(
      (o) => o.audience_id === entry.audienceId && o.kurstyp === entry.kurstyp && o.slug === entry.slug
    )
    return { ...entry, offerId: dbOffer?.id ?? -1 }
  }).filter((entry) => entry.offerId !== -1)

  return { success: true, data: entries, message: 'Katalog geladen' }
}

export type EditionSummary = {
  offerId: number
  latestEditionId: string
  latestSchoolYear: string
  status: OfferEditionDB['status']
  editionCount: number
}

// Für den Angebote-Index: pro Offer die neueste Edition (nach school_year) samt Status, ohne den
// vollen Formular-/Session-Datensatz zu laden.
export async function getAdminEditionSummaries(): Promise<EditionActionResult<EditionSummary[]>> {
  const authCheck = await requireContentManagerAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase
    .from('offer_editions')
    .select('id, offer_id, school_year, status')
    .order('school_year', { ascending: false })

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Durchführungsübersicht konnte nicht geladen werden.' }
  }

  const byOffer = new Map<number, EditionSummary>()
  for (const row of data as { id: string; offer_id: number; school_year: string; status: OfferEditionDB['status'] }[]) {
    const existing = byOffer.get(row.offer_id)
    if (existing) {
      existing.editionCount += 1
    } else {
      byOffer.set(row.offer_id, {
        offerId: row.offer_id,
        latestEditionId: row.id,
        latestSchoolYear: row.school_year,
        status: row.status,
        editionCount: 1,
      })
    }
  }

  return { success: true, data: Array.from(byOffer.values()), message: 'Übersicht geladen' }
}

export async function getOfferWithCatalogEntry(
  offerId: number
): Promise<EditionActionResult<{ offer: OfferDB; catalogEntry: AdminOfferCatalogEntry }>> {
  const authCheck = await requireContentManagerAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase.from('offers').select('*').eq('id', offerId).single()

  if (error || !data) {
    return { success: false, error: 'Kursangebot nicht gefunden.' }
  }

  const offer = data as OfferDB
  const catalogEntry = findAdminOfferCatalogEntry(
    offer.audience_id as AdminOfferCatalogEntry['audienceId'],
    offer.kurstyp as AdminOfferCatalogEntry['kurstyp'],
    offer.slug
  )
  if (!catalogEntry) {
    return { success: false, error: 'Kursangebot ist nicht Teil des bekannten Katalogs.' }
  }

  return { success: true, data: { offer, catalogEntry }, message: 'Angebot geladen' }
}

// 2) Editionen eines Angebots (für "Prüfungsjahr"/"Durchführung"-Selects), neueste zuerst.
export async function getEditionsForOffer(offerId: number): Promise<EditionActionResult<OfferEditionDB[]>> {
  const authCheck = await requireContentManagerAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data, error } = await supabase
    .from('offer_editions')
    .select('*')
    .eq('offer_id', offerId)
    .order('school_year', { ascending: false })

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Durchführungen konnten nicht geladen werden.' }
  }

  return { success: true, data: data as OfferEditionDB[], message: 'Durchführungen geladen' }
}

export async function getEditionDetail(
  editionId: string
): Promise<EditionActionResult<{ edition: OfferEditionDB; sessions: CourseSessionWithKursDB[] }>> {
  const authCheck = await requireContentManagerAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)

  const { data: edition, error: editionError } = await supabase
    .from('offer_editions')
    .select('*')
    .eq('id', editionId)
    .single()

  if (editionError || !edition) {
    return { success: false, error: 'Durchführung nicht gefunden.' }
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('course_sessions')
    .select('*, kurs:intensivwoche_kurse!course_sessions_id_fkey(id, name, fach, beschreibung, start_datum, end_datum, uhrzeit, ort, max_teilnehmer, lehrer)')
    .eq('edition_id', editionId)
    .order('id', { ascending: true })

  if (sessionsError) {
    console.error('Supabase Error:', sessionsError)
    return { success: false, error: 'Termine konnten nicht geladen werden.' }
  }

  return {
    success: true,
    data: { edition: edition as OfferEditionDB, sessions: (sessions ?? []) as unknown as CourseSessionWithKursDB[] },
    message: 'Durchführung geladen',
  }
}

// 3) Speichern (Entwurf) -- legt bei editionId=null eine neue Draft-Edition an, sonst Update mit
//    Optimistic-Concurrency-Check über version.
export async function saveEditionAction(
  offerId: number,
  editionId: string | null,
  expectedVersion: number | null,
  input: OfferEditionFormInput
): Promise<EditionActionResult<OfferEditionDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const parsed = offerEditionFormSchema.safeParse(input)
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

  const payload = {
    school_year: data.schoolYear,
    public_title: data.publicTitle,
    tagline: data.tagline,
    description: data.description,
    regular_price_rappen: Math.round(data.regularPriceChf * 100),
    early_bird_enabled: data.earlyBirdEnabled,
    early_bird_price_rappen: data.earlyBirdEnabled && data.earlyBirdPriceChf != null ? Math.round(data.earlyBirdPriceChf * 100) : null,
    early_bird_deadline: data.earlyBirdEnabled ? data.earlyBirdDeadline || null : null,
    // datetime-local trägt keine Zeitzone -- roh gespeichert würde Postgres den String in der
    // Session-timezone (UTC) statt in Europe/Zurich interpretieren, siehe zurich-time.ts.
    registration_opens_at: data.registrationOpensAt ? zurichLocalToUtcIso(data.registrationOpensAt) : null,
    registration_closes_at: data.registrationClosesAt ? zurichLocalToUtcIso(data.registrationClosesAt) : null,
  }

  if (editionId === null) {
    const { data: created, error } = await supabase
      .from('offer_editions')
      .insert({ ...payload, offer_id: offerId, status: 'draft' })
      .select()
      .single()

    if (error) {
      console.error('Supabase Error:', error)
      return { success: false, error: 'Durchführung konnte nicht erstellt werden. Prüfe Preis und Frühbucher-Angaben.' }
    }

    await writeAuditLog(supabase, authCheck.userId, 'offer_edition', created.id, 'create', null, created)
    revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${created.id}`)
    return { success: true, data: created as OfferEditionDB, message: 'Entwurf erstellt.' }
  }

  const { data: updated, error } = await supabase
    .from('offer_editions')
    .update(payload)
    .eq('id', editionId)
    .eq('version', expectedVersion ?? -1)
    .select()
    .single()

  if (error || !updated) {
    // Kein Treffer bei .eq('version', ...) heisst entweder Konflikt (jemand anders hat
    // zwischenzeitlich gespeichert) oder ein echter Fehler -- beides ist für den Nutzer identisch
    // zu behandeln: neu laden statt blind überschreiben.
    return {
      success: false,
      error: 'Diese Durchführung wurde zwischenzeitlich geändert. Bitte lade die Seite neu, bevor du erneut speicherst.',
      conflict: true,
    }
  }

  await writeAuditLog(supabase, authCheck.userId, 'offer_edition', editionId, 'update', null, updated)
  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}`)
  // Abschnitt 7: falls diese Durchführung bereits published ist, muss eine Preisänderung sofort
  // auf den öffentlichen Kursseiten sichtbar sein (getOfferCatalogForAudience/getOfferBySlug in
  // lib/kurse/catalog.ts lesen unter demselben "offers"-Tag). Für einen noch nicht
  // veröffentlichten Entwurf ist das Invalidieren unnötig, aber ungefährlich.
  updateTag('offers')
  return { success: true, data: updated as OfferEditionDB, message: 'Entwurf gespeichert.' }
}

// 4) Veröffentlichen -- wiederholt die Publication-Checklist serverseitig, damit ein manipulierter
//    Client-Request nicht ohne Pflichtfelder/Termine veröffentlichen kann.
export async function publishEditionAction(
  offerId: number,
  editionId: string,
  expectedVersion: number
): Promise<EditionActionResult<OfferEditionDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)

  const { data: edition, error: editionError } = await supabase
    .from('offer_editions')
    .select('*')
    .eq('id', editionId)
    .single()

  if (editionError || !edition) {
    return { success: false, error: 'Durchführung nicht gefunden.' }
  }
  const typedEdition = edition as OfferEditionDB

  const { data: offer } = await supabase.from('offers').select('*').eq('id', typedEdition.offer_id).single()
  const kurstyp = (offer as OfferDB | null)?.kurstyp

  const { data: sessions } = await supabase
    .from('course_sessions')
    .select('id, registration_status')
    .eq('edition_id', editionId)

  const bookableSessions = (sessions ?? []).filter((s) => s.registration_status === 'bookable')
  const needsSession = kurstyp !== 'selbststudium'

  const issues: string[] = []
  if (!typedEdition.public_title || !typedEdition.tagline || !typedEdition.description) {
    issues.push('Öffentliche Angebotsinformationen fehlen.')
  }
  if (!typedEdition.regular_price_rappen || typedEdition.regular_price_rappen <= 0) {
    issues.push('Regulärer Preis muss gesetzt sein.')
  }
  if (needsSession && bookableSessions.length === 0) {
    issues.push('Mindestens ein buchbarer Termin ist für dieses Angebot erforderlich.')
  }
  if (issues.length > 0) {
    return { success: false, error: issues.join(' ') }
  }

  const { data: updated, error } = await supabase
    .from('offer_editions')
    .update({
      status: 'published',
      published_at: typedEdition.published_at ?? new Date().toISOString(),
    })
    .eq('id', editionId)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return {
      success: false,
      error: 'Diese Durchführung wurde zwischenzeitlich geändert. Bitte lade die Seite neu.',
      conflict: true,
    }
  }

  await writeAuditLog(supabase, authCheck.userId, 'offer_edition', editionId, 'publish', typedEdition, updated)
  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}`)
  revalidatePath('/kurse')
  // Abschnitt 7: macht das Angebot sofort auf den neuen, lokalisierten Marketing-Kursseiten
  // sichtbar (nicht nur auf der alten /kurse-Route via revalidatePath oben).
  updateTag('offers')
  return { success: true, data: updated as OfferEditionDB, message: 'Durchführung veröffentlicht.' }
}

export async function archiveEditionAction(
  offerId: number,
  editionId: string,
  expectedVersion: number
): Promise<EditionActionResult<OfferEditionDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: updated, error } = await supabase
    .from('offer_editions')
    .update({ status: 'archived' })
    .eq('id', editionId)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return { success: false, error: 'Diese Durchführung wurde zwischenzeitlich geändert. Bitte lade die Seite neu.', conflict: true }
  }

  await writeAuditLog(supabase, authCheck.userId, 'offer_edition', editionId, 'archive', null, updated)
  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}`)
  // Abschnitt 7: eine archivierte, vorher published Edition darf nicht bis zum Ablauf von
  // cacheLife('hours') weiter mit ihrem alten Preis auf den öffentlichen Seiten sichtbar bleiben.
  updateTag('offers')
  return { success: true, data: updated as OfferEditionDB, message: 'Durchführung archiviert.' }
}

// 5) "Vorjahr duplizieren" -- neue Draft-Edition mit denselben Texten/Preisen, aber ohne Termine
//    (Abschnitt 2.12: eine veröffentlichte Vorjahresedition wird nie überschrieben).
export async function duplicateEditionAction(
  offerId: number,
  sourceEditionId: string,
  newSchoolYear: string
): Promise<EditionActionResult<OfferEditionDB>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { data: source, error: sourceError } = await supabase
    .from('offer_editions')
    .select('*')
    .eq('id', sourceEditionId)
    .single()

  if (sourceError || !source) {
    return { success: false, error: 'Quell-Durchführung nicht gefunden.' }
  }
  const typedSource = source as OfferEditionDB

  const { data: created, error } = await supabase
    .from('offer_editions')
    .insert({
      offer_id: offerId,
      school_year: newSchoolYear,
      public_title: typedSource.public_title,
      tagline: typedSource.tagline,
      description: typedSource.description,
      regular_price_rappen: typedSource.regular_price_rappen,
      // Frühbucherpreis/-Stichtag werden nie unbesehen übernommen -- ein alter Stichtag wäre in
      // der neuen Durchführung sofort abgelaufen. Aktivierung/Betrag/Datum müssen bewusst neu
      // gesetzt werden.
      early_bird_enabled: false,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Durchführung konnte nicht dupliziert werden. Existiert das Schuljahr bereits für dieses Angebot?' }
  }

  await writeAuditLog(supabase, authCheck.userId, 'offer_edition', created.id, 'duplicate', typedSource, created)
  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${created.id}`)
  return { success: true, data: created as OfferEditionDB, message: 'Vorjahresdaten als neuer Entwurf dupliziert.' }
}

// 6) Termine -- atomar über die admin_upsert_course_session()-RPC (Migration
//    20260721075036_admin_upsert_course_session_rpc.sql), Name/Beschreibung werden serverseitig
//    aus der Edition abgeleitet statt als eigenes Formularfeld dupliziert zu werden.
export async function saveSessionAction(
  offerId: number,
  editionId: string,
  editionTitle: string,
  editionDescription: string,
  input: CourseSessionFormInput
): Promise<EditionActionResult<number>> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const parsed = courseSessionFormSchema.safeParse(input)
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
  const sessionName = `${editionTitle} · ${data.standort}`

  const { data: kursId, error } = await supabase.rpc('admin_upsert_course_session', {
    p_kurs_id: data.kursId ?? undefined,
    p_edition_id: editionId,
    p_name: sessionName,
    p_fach: data.fach,
    p_beschreibung: editionDescription,
    p_start_datum: data.startDatum,
    p_end_datum: data.endDatum,
    p_uhrzeit: data.uhrzeit,
    p_ort: data.standort,
    p_max_teilnehmer: data.maxTeilnehmer,
    p_lehrer: data.lehrer,
    p_registration_status: data.registrationStatus,
    p_delivery_modes: data.deliveryModes,
  })

  if (error) {
    console.error('Supabase RPC Error:', error)
    return { success: false, error: 'Termin konnte nicht gespeichert werden.' }
  }

  await writeAuditLog(
    supabase,
    authCheck.userId,
    'course_session',
    String(kursId),
    data.kursId ? 'update' : 'create',
    null,
    { ...data, edition_id: editionId }
  )
  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}`)
  return { success: true, data: kursId as number, message: 'Termin gespeichert.' }
}

export async function cancelSessionAction(
  offerId: number,
  editionId: string,
  kursId: number
): Promise<EditionActionResult> {
  const authCheck = await requireAdminAuth()
  if (!authCheck.authorized) return authCheck.error

  const supabase = createAuthenticatedSupabaseClient(authCheck.supabaseAccessToken)
  const { error } = await supabase
    .from('course_sessions')
    .update({ registration_status: 'cancelled' })
    .eq('id', kursId)
    .eq('edition_id', editionId)

  if (error) {
    console.error('Supabase Error:', error)
    return { success: false, error: 'Termin konnte nicht abgesagt werden.' }
  }

  await writeAuditLog(supabase, authCheck.userId, 'course_session', String(kursId), 'cancel', null, { edition_id: editionId })
  revalidatePath(`/dashboard/kurse/angebote/${offerId}/durchfuehrungen/${editionId}`)
  return { success: true, message: 'Termin abgesagt.' }
}
