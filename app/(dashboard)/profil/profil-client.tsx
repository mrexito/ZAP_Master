'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { toast } from 'sonner'
import { updateProfileSchema } from '@/types/profil'
import {
  User,
  Camera,
  Trash2,
  Save,
  Sun,
  Moon,
  Monitor,
  Loader2,
  School,
  Calendar,
  GraduationCap,
  FileText,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { CLASS_LEVELS } from '@/lib/class-levels'
import {
  updateProfile,
  updateThemePreference,
  uploadAvatar,
  deleteAvatar,
} from './actions'

interface Profile {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  bio: string | null
  school_name: string | null
  class_level: string | null
  birth_date: string | null
  gender: string | null
  role: string | null
  theme_preference: 'light' | 'dark' | 'system' | null
  created_at: string | null
}

interface ProfileStats {
  totalAttempts: number
  completedExams: number
}

interface ProfilClientProps {
  profile: Profile
  stats: ProfileStats
}

const GENDER_OPTIONS = [
  { value: '', label: 'Nicht angegeben' },
  { value: 'male', label: 'Männlich' },
  { value: 'female', label: 'Weiblich' },
  { value: 'other', label: 'Divers' },
]

const PROFILE_CLASS_LEVEL_OPTIONS = [
  { value: '', label: 'Nicht angegeben' },
  ...CLASS_LEVELS.map((level) => ({ value: level, label: level })),
  { value: 'other', label: 'Andere' },
]

export function ProfilClient({ profile, stats }: ProfilClientProps) {
  const { setTheme } = useTheme()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [firstName, setFirstName] = useState(profile.first_name || '')
  const [lastName, setLastName] = useState(profile.last_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [schoolName, setSchoolName] = useState(profile.school_name || '')
  const [classLevel, setClassLevel] = useState(profile.class_level || '')
  const [birthDate, setBirthDate] = useState(profile.birth_date || '')
  const [gender, setGender] = useState(profile.gender || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [themePreference, setThemePreference] = useState<'light' | 'dark' | 'system'>(
    profile.theme_preference || 'light'
  )

  // UI state
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)

    const parsed = updateProfileSchema.safeParse({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      bio: bio.trim() || undefined,
      school_name: schoolName.trim() || undefined,
    })

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Validierungsfehler')
      setSaving(false)
      return
    }

    const result = await updateProfile({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      bio: parsed.data.bio,
      school_name: parsed.data.school_name,
      class_level: classLevel,
      birth_date: birthDate || null,
      gender: gender || null,
    })

    if (result.success) {
      toast.success(result.message)
      router.refresh()
    } else {
      toast.error(result.error)
    }

    setSaving(false)
  }

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setThemePreference(newTheme)
    setTheme(newTheme)

    const result = await updateThemePreference(newTheme)
    if (!result.success) {
      toast.error(result.error)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)

    const formData = new FormData()
    formData.append('avatar', file)

    const result = await uploadAvatar(formData)

    if (result.success && result.data) {
      setAvatarUrl(result.data)
      toast.success(result.message)
    } else if (!result.success) {
      toast.error(result.error)
    }

    setUploadingAvatar(false)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteAvatar = async () => {
    if (!confirm('Profilbild wirklich löschen?')) return

    setUploadingAvatar(true)
    const result = await deleteAvatar()

    if (result.success) {
      setAvatarUrl(null)
      toast.success(result.message)
    } else {
      toast.error(result.error)
    }

    setUploadingAvatar(false)
  }

  const getRoleName = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'Administrator'
      case 'lehrperson':
        return 'Lehrperson'
      default:
        return 'Schüler/in'
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Avatar & Quick Info */}
        <div className="space-y-6">
          {/* Avatar Card */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Profilbild</h3>
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-muted border-4 border-background shadow-lg">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profilbild"
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <User className="w-16 h-16 text-primary/50" />
                    </div>
                  )}
                </div>
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="rounded-lg"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Ändern
                </Button>
                {avatarUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteAvatar}
                    disabled={uploadingAvatar}
                    aria-label="Profilbild löschen"
                    className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                JPG, PNG, WebP oder GIF. Max. 2MB.
              </p>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Statistiken</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Prüfungsversuche</span>
                <span className="text-lg font-bold text-foreground">{stats.totalAttempts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Abgeschlossen</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {stats.completedExams}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Erfolgsquote</span>
                <span className="text-lg font-bold text-primary">
                  {stats.totalAttempts > 0
                    ? Math.round((stats.completedExams / stats.totalAttempts) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Kontoinformationen</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <GraduationCap className="w-4 h-4" />
                <span>{getRoleName(profile.role)}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Mitglied seit{' '}
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString('de-CH')
                    : 'Unbekannt'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Info */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Persönliche Daten</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Vorname
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="Dein Vorname"
                />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Nachname
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="Dein Nachname"
                />
              </div>
              <div>
                <label htmlFor="birth-date" className="block text-sm font-medium text-foreground mb-1.5">
                  Geburtsdatum
                </label>
                <input
                  id="birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-foreground mb-1.5">
                  Geschlecht
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="bio" className="block text-sm font-medium text-foreground mb-1.5">
                Über mich
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                placeholder="Erzähle etwas über dich..."
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {bio.length}/500
              </p>
            </div>
          </div>

          {/* School Info */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <School className="w-5 h-5" />
              Schulinformationen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="school-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Schule
                </label>
                <input
                  id="school-name"
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  placeholder="Name deiner Schule"
                />
              </div>
              <div>
                <label htmlFor="class-level" className="block text-sm font-medium text-foreground mb-1.5">
                  Klassenstufe
                </label>
                <select
                  id="class-level"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  {PROFILE_CLASS_LEVEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Theme Settings */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Darstellung</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Wähle dein bevorzugtes Farbschema. Diese Einstellung wird gespeichert.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  themePreference === 'light'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Sun className="w-6 h-6 text-amber-500" />
                </div>
                <span className="text-sm font-medium text-foreground">Hell</span>
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  themePreference === 'dark'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <Moon className="w-6 h-6 text-slate-300" />
                </div>
                <span className="text-sm font-medium text-foreground">Dunkel</span>
              </button>
              <button
                onClick={() => handleThemeChange('system')}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  themePreference === 'system'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-slate-800 flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground">System</span>
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="rounded-xl px-6"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Änderungen speichern
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
