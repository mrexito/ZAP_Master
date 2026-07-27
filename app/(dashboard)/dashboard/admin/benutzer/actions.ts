'use server'

import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/types/next-auth'
import type { Database } from '@/types/database'
import { updateUserRoleSchema } from '@/types/admin'

// Admin Client direkt erstellen (umgeht RLS)
function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export type UserEnrolledCourse = {
  kursId: number
  name: string
  fach: string
}

export type UserWithProfile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  created_at: string | null
  avatar_url: string | null
  enrolledCourses: UserEnrolledCourse[]
}

/**
 * Alle Benutzer mit Profilen laden
 */
export async function getUsers(): Promise<{ users: UserWithProfile[], error: string | null }> {
  await requireAdmin()

  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, created_at, avatar_url')
    .order('created_at', { ascending: false })

  if (error) {
    return { users: [], error: error.message }
  }

  // Kurseinschreibungen laden: beneficiary_user_id wird bei der Buchung per
  // E-Mail-Abgleich automatisch mit dem Profil verknüpft (siehe
  // link_anmeldung_beneficiary(), Migration 20260721082939). Stornierte
  // Anmeldungen zählen nicht als aktive Einschreibung.
  const { data: anmeldungenData, error: anmeldungenError } = await supabase
    .from('intensivwoche_anmeldungen')
    .select('beneficiary_user_id, kurs_id, status')
    .not('beneficiary_user_id', 'is', null)
    .neq('status', 'storniert')

  if (anmeldungenError) {
    return { users: [], error: anmeldungenError.message }
  }

  const kursIds = Array.from(
    new Set(
      (anmeldungenData || [])
        .map((a) => a.kurs_id)
        .filter((id): id is number => id !== null)
    )
  )

  const { data: kurseData, error: kurseError } = kursIds.length > 0
    ? await supabase.from('intensivwoche_kurse').select('id, name, fach').in('id', kursIds)
    : { data: [] as { id: number; name: string; fach: string }[], error: null }

  if (kurseError) {
    return { users: [], error: kurseError.message }
  }

  const kursById = new Map((kurseData || []).map((k) => [k.id, k]))

  const coursesByUser = new Map<string, UserEnrolledCourse[]>()
  for (const anmeldung of anmeldungenData || []) {
    if (!anmeldung.beneficiary_user_id || anmeldung.kurs_id === null) continue
    const kurs = kursById.get(anmeldung.kurs_id)
    if (!kurs) continue
    const existing = coursesByUser.get(anmeldung.beneficiary_user_id) || []
    existing.push({ kursId: kurs.id, name: kurs.name, fach: kurs.fach })
    coursesByUser.set(anmeldung.beneficiary_user_id, existing)
  }

  const users: UserWithProfile[] = (data || []).map((u) => ({
    id: u.id,
    email: u.email || '',
    first_name: u.first_name,
    last_name: u.last_name,
    role: (u.role as UserRole) || 'user',
    created_at: u.created_at,
    avatar_url: u.avatar_url,
    enrolledCourses: coursesByUser.get(u.id) || [],
  }))

  return { users, error: null }
}

/**
 * Benutzer-Rolle ändern
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error: string | null; fieldErrors?: Record<string, string[]> }> {
  const session = await requireAdmin()

  const parsed = updateUserRoleSchema.safeParse({ userId, newRole })
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validierungsfehler',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  // Verhindere, dass Admin sich selbst degradiert
  if (parsed.data.userId === session.user.id && parsed.data.newRole !== 'admin') {
    return { success: false, error: 'Du kannst deine eigene Admin-Rolle nicht entfernen.' }
  }
  
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.newRole, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.userId)
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  revalidatePath('/dashboard/admin/benutzer')
  return { success: true, error: null }
}

/**
 * Benutzer löschen (nur Admin)
 */
export async function deleteUser(
  userId: string
): Promise<{ success: boolean, error: string | null }> {
  const session = await requireAdmin()
  
  // Verhindere Selbstlöschung
  if (session.user.id === userId) {
    return { success: false, error: 'Du kannst dich nicht selbst löschen.' }
  }
  
  const supabase = getAdminClient()
  
  // Lösche zuerst das Profil (FK constraint)
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  
  if (profileError) {
    return { success: false, error: profileError.message }
  }
  
  // auth.users kann nur via Admin API gelöscht werden
  // Das Profil ist gelöscht, der Auth-Eintrag bleibt (orphaned)
  // In Produktion: Supabase Admin API verwenden
  
  revalidatePath('/dashboard/admin/benutzer')
  return { success: true, error: null }
}
