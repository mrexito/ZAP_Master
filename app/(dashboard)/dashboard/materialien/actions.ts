'use server'

import { createAuthenticatedSupabaseClient, createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@/lib/auth/config'
import { revalidatePath } from 'next/cache'
import { createMaterialSchema } from '@/types/material'
import { CLASS_LEVELS } from '@/lib/class-levels'
import { createBucketSignedUploadUrl, type SignedUploadResult } from '@/lib/storage/signed-upload'

function validateClassLevels(classLevels: string[]) {
  return (
    classLevels.length > 0 &&
    classLevels.every((level) => CLASS_LEVELS.includes(level as (typeof CLASS_LEVELS)[number]))
  )
}

/**
 * Löst einen Materialbereichs-Key (`langzeitgymi`/`kurzgymi`/`bms`/`matura`) auf die numerische
 * `material_areas.id` auf. Kein Bereich (undefined) ist der bestehende, wirklich öffentliche
 * Katalog -- kein Fehlerfall.
 */
async function resolveMaterialAreaDbId(
  supabase: ReturnType<typeof createAuthenticatedSupabaseClient>,
  areaId: string | undefined
): Promise<{ ok: true; areaDbId: number | null } | { ok: false; error: string }> {
  if (!areaId) return { ok: true, areaDbId: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: area, error } = await (supabase as any)
    .from('material_areas')
    .select('id')
    .eq('key', areaId)
    .maybeSingle()

  if (error || !area) {
    return { ok: false, error: 'Unbekannter Materialbereich.' }
  }
  return { ok: true, areaDbId: area.id }
}

/**
 * Schritt vor createMaterial(): erstellt eine Signed-Upload-URL für den privaten
 * `lernmaterialien`-Bucket (Abschnitt 2.11 -- der Bucket ist nicht public, ein direkter
 * Browser-Upload mit dem authentifizierten Client hätte keine INSERT-Policy). Gleiches Muster
 * wie `createSignedUploadUrl` für Aufsätze/Rubriken.
 */
export async function createMaterialUploadUrl(fileName: string): Promise<SignedUploadResult> {
  const session = await auth()

  if (!session?.user?.id || !['lehrperson', 'admin'].includes(session.user.role || '')) {
    return { success: false, error: 'Nicht autorisiert' }
  }

  return createBucketSignedUploadUrl({
    bucket: 'lernmaterialien',
    pathPrefix: 'materials',
    userId: session.user.id,
    fileName,
    errorLogLabel: 'Lernmaterial Signed-URL-Fehler',
    errorMessage: 'Konnte Upload-URL nicht erstellen.',
  })
}

// Öffentliche Funktion - braucht kein Auth
export async function getSubjects() {
  const supabase = await createServerSupabaseClient()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('subjects')
    .select('*')
    .order('name')
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}

export async function getMaterialien() {
  const session = await auth()
  
  if (!session?.user?.id || !session.supabaseAccessToken) {
    return { success: false, error: 'Nicht authentifiziert' }
  }

  const supabase = createAuthenticatedSupabaseClient(session.supabaseAccessToken)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('learning_materials')
    .select(`
      *,
      subjects (id, name, thumbnail_url)
    `)
    .order('created_at', { ascending: false })
  
  // Lehrpersonen sehen nur ihre eigenen Materialien, Admins sehen alle
  if (session.user.role === 'lehrperson') {
    query = query.eq('created_by', session.user.id)
  }
  
  const { data, error } = await query
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true, data }
}

export async function createMaterial(formData: FormData) {
  const session = await auth()

  if (!session?.user || !session.supabaseAccessToken || !['lehrperson', 'admin'].includes(session.user.role || '')) {
    return { success: false, error: 'Nicht autorisiert' }
  }

  const rawName = formData.get('name') as string
  const rawDescription = formData.get('description') as string
  const rawSubjectId = formData.get('subject_id') as string
  const materialCategory = formData.get('type') as string // 'document' | 'worksheet' | etc.
  const classLevels = formData.getAll('class_levels') as string[]
  const fileUrl = formData.get('file_url') as string
  const downloadPath = formData.get('download_path') as string
  const rawFileSize = formData.get('file_size') as string
  const fileType = formData.get('file_type') as string
  const isLink = formData.get('is_link') === 'true'
  const rawAreaId = (formData.get('area_id') as string) || undefined

  if (!validateClassLevels(classLevels)) {
    return { success: false, error: 'Bitte wähle mindestens eine gültige Klassenstufe aus.' }
  }

  const parsed = createMaterialSchema.safeParse({
    name: rawName,
    description: rawDescription || undefined,
    subject_id: rawSubjectId ? parseInt(rawSubjectId) : NaN,
    type: isLink ? 'link' : 'file',
    url: isLink ? fileUrl || undefined : undefined,
    download_path: !isLink ? downloadPath || undefined : undefined,
    file_size: rawFileSize ? parseInt(rawFileSize) : undefined,
    area_id: rawAreaId,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: 'Validierungsfehler',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = createAuthenticatedSupabaseClient(session.supabaseAccessToken)

  // Ein geschütztes Material darf nie zusätzlich global öffentlich sein (Abschnitt 2.11).
  // Ohne Bereich bleibt das Material Teil des bestehenden, wirklich öffentlichen Katalogs.
  let areaDbId: number | null = null
  if (parsed.data.area_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: area, error: areaError } = await (supabase as any)
      .from('material_areas')
      .select('id')
      .eq('key', parsed.data.area_id)
      .maybeSingle()

    if (areaError || !area) {
      return { success: false, error: 'Unbekannter Materialbereich.' }
    }
    areaDbId = area.id
  }

  // Verteidigung in der Tiefe, analog zum Aufsatz-Upload: der signierte Pfad muss tatsächlich
  // unter dem eigenen Ordner dieses Nutzers liegen, bevor er als DB-Referenz übernommen wird.
  if (parsed.data.download_path && !parsed.data.download_path.startsWith(`materials/${session.user.id}/`)) {
    return { success: false, error: 'Ungültiger Dateipfad.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('learning_materials')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      subject_id: parsed.data.subject_id,
      type: materialCategory || 'document',
      class_levels: classLevels,
      file_url: parsed.data.type === 'link' ? parsed.data.url ?? null : null,
      download_path: parsed.data.type === 'file' ? parsed.data.download_path ?? null : null,
      file_size: parsed.data.file_size ?? null,
      file_type: fileType || null,
      is_link: parsed.data.type === 'link',
      created_by: session.user.id,
      area_id: areaDbId,
      is_public: areaDbId === null,
    })
    .select()
    .single()

  if (error) {
    console.error('Create material error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/materialien')
  revalidatePath('/materialien')

  return { success: true, data }
}

export async function updateMaterial(id: number, formData: FormData) {
  const session = await auth()
  
  if (!session?.user || !session.supabaseAccessToken || !['lehrperson', 'admin'].includes(session.user.role || '')) {
    return { success: false, error: 'Nicht autorisiert' }
  }
  
  const supabase = createAuthenticatedSupabaseClient(session.supabaseAccessToken)
  
  // Prüfe ob der User der Ersteller ist (außer Admin)
  if (session.user.role !== 'admin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('learning_materials')
      .select('created_by')
      .eq('id', id)
      .single()
    
    if (existing?.created_by !== session.user.id) {
      return { success: false, error: 'Nicht autorisiert - nur eigene Materialien bearbeiten' }
    }
  }
  
  const rawName = formData.get('name') as string
  const rawDescription = formData.get('description') as string
  const rawSubjectId = formData.get('subject_id') as string
  const materialCategory = formData.get('type') as string
  const classLevels = formData.getAll('class_levels') as string[]
  const isPublicInput = formData.get('is_public') === 'true'
  const fileUrl = formData.get('file_url') as string
  const downloadPath = formData.get('download_path') as string
  const rawFileSize = formData.get('file_size') as string
  const fileType = formData.get('file_type') as string
  const isLink = formData.get('is_link') === 'true'
  const rawAreaId = (formData.get('area_id') as string) || undefined

  if (!validateClassLevels(classLevels)) {
    return { success: false, error: 'Bitte wähle mindestens eine gültige Klassenstufe aus.' }
  }

  const parsed = createMaterialSchema.safeParse({
    name: rawName,
    description: rawDescription || undefined,
    subject_id: rawSubjectId ? parseInt(rawSubjectId) : NaN,
    type: isLink ? 'link' : 'file',
    url: isLink ? fileUrl || undefined : undefined,
    download_path: !isLink ? downloadPath || undefined : undefined,
    file_size: rawFileSize ? parseInt(rawFileSize) : undefined,
    area_id: rawAreaId,
  })

  if (!parsed.success) {
    return {
      success: false,
      error: 'Validierungsfehler',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const areaResult = await resolveMaterialAreaDbId(supabase, parsed.data.area_id)
  if (!areaResult.ok) {
    return { success: false, error: areaResult.error }
  }
  const areaDbId = areaResult.areaDbId

  if (parsed.data.download_path && !parsed.data.download_path.startsWith(`materials/${session.user.id}/`)) {
    return { success: false, error: 'Ungültiger Dateipfad.' }
  }

  const updateData: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    subject_id: parsed.data.subject_id,
    type: materialCategory || 'document',
    class_levels: classLevels,
    area_id: areaDbId,
    // Geschützte Materialien dürfen nie zusätzlich global öffentlich sein (Abschnitt 2.11) --
    // nur ohne Bereich zählt der manuelle Öffentlich/Entwurf-Schalter des bestehenden Katalogs.
    is_public: areaDbId === null ? isPublicInput : false,
  }

  if (isLink && fileUrl) {
    updateData.file_url = parsed.data.url ?? null
    updateData.download_path = null
    updateData.file_size = parsed.data.file_size ?? null
    updateData.file_type = fileType || null
  } else if (!isLink && downloadPath) {
    updateData.download_path = parsed.data.download_path ?? null
    updateData.file_url = null
    updateData.file_size = parsed.data.file_size ?? null
    updateData.file_type = fileType || null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('learning_materials')
    .update(updateData)
    .eq('id', id)
  
  if (error) {
    console.error('Update material error:', error)
    return { success: false, error: error.message }
  }
  
  revalidatePath('/dashboard/materialien')
  revalidatePath('/materialien')
  
  return { success: true }
}

export async function deleteMaterial(id: number) {
  const session = await auth()
  
  if (!session?.user || !session.supabaseAccessToken || !['lehrperson', 'admin'].includes(session.user.role || '')) {
    return { success: false, error: 'Nicht autorisiert' }
  }
  
  const supabase = createAuthenticatedSupabaseClient(session.supabaseAccessToken)
  // Admin-Client für Storage-Operationen
  const adminSupabase = createAdminSupabaseClient()
  
  // Hole Datei-Referenz zum Löschen aus Storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: material } = await (supabase as any)
    .from('learning_materials')
    .select('file_url, download_path, is_link, created_by')
    .eq('id', id)
    .single()
  
  // Prüfe Berechtigung
  if (session.user.role !== 'admin' && material?.created_by !== session.user.id) {
    return { success: false, error: 'Nicht autorisiert - nur eigene Materialien löschen' }
  }
  
  // Lösche aus DB (mit auth client)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('learning_materials')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Delete material error:', error)
    return { success: false, error: error.message }
  }
  
  // Lösche Datei aus Storage falls vorhanden (mit admin client)
  if (material?.download_path) {
    try {
      await adminSupabase.storage.from('lernmaterialien').remove([material.download_path])
    } catch (e) {
      console.error('Error deleting file from storage:', e)
    }
  } else if (material?.file_url && !material?.is_link) {
    // Legacy-Zeilen von vor der Signed-Upload-Umstellung: der frühere "Public-URL"-Wert
    // enthält den Storage-Pfad trotzdem als Teilstring.
    try {
      const urlParts = material.file_url.split('/lernmaterialien/')
      if (urlParts[1]) {
        await adminSupabase.storage
          .from('lernmaterialien')
          .remove([urlParts[1]])
      }
    } catch (e) {
      console.error('Error deleting file from storage:', e)
    }
  }
  
  revalidatePath('/dashboard/materialien')
  revalidatePath('/materialien')
  
  return { success: true }
}
