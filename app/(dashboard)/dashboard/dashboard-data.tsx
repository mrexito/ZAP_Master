import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Calculator,
  BookOpen,
} from 'lucide-react'
import { BadgesSection } from './badges-section'

interface Props {
  userId: string
  token: string
  firstName: string
}

export async function DashboardData({ userId, token, firstName }: Props) {
  const supabase = createAuthenticatedSupabaseClient(token)

  const [{ data: progressData }, { data: examsData }] = await Promise.all([
    supabase.from('trainer_progress').select('*').eq('user_id', userId),
    supabase.from('trainer_exams').select('id, subject'),
  ])

  const completedExams = progressData?.filter((p) => p.completed_at).length || 0
  const inProgressExams = progressData?.filter((p) => !p.completed_at).length || 0
  const totalExams = examsData?.length || 0
  const mathExams = examsData?.filter((e) => e.subject === 'Math').length || 0
  const germanExams = examsData?.filter((e) => e.subject === 'German').length || 0
  const progressPercent = totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0

  return (
    <>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Hallo, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Willkommen zurück zu deinem ZAP-Training.
        </p>
      </div>

      {/* Stats Grid — jede Kachel verlinkt auf den Prüfungstrainer, da sich alle vier Werte
          auf trainer_exams/trainer_progress beziehen; ersetzt die vormals separate
          "Prüfungstrainer"-Quick-Action-Karte, statt sie als reinen Sidebar-Duplikat-Link
          danebenzustellen. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link
          href="/trainer"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verfügbare Prüfungen</p>
              <p className="text-2xl font-bold text-foreground">{totalExams}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/trainer"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Abgeschlossen</p>
              <p className="text-2xl font-bold text-foreground">{completedExams}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/trainer"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">In Bearbeitung</p>
              <p className="text-2xl font-bold text-foreground">{inProgressExams}</p>
            </div>
          </div>
        </Link>

        <Link
          href="/trainer"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fortschritt</p>
              <p className="text-2xl font-bold text-foreground">{progressPercent}%</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Subject Overview */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-4">Fächer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/trainer?subject=Math"
            className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <div className="p-3 bg-primary/10 rounded-xl">
              <Calculator className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Mathematik</h3>
              <p className="text-sm text-muted-foreground">{mathExams} Prüfungen</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </Link>

          <Link
            href="/trainer?subject=German"
            className="flex items-center gap-4 p-4 border border-border rounded-xl hover:border-green-500/50 hover:bg-green-500/5 transition-colors"
          >
            <div className="p-3 bg-green-500/10 rounded-xl">
              <BookOpen className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Deutsch</h3>
              <p className="text-sm text-muted-foreground">{germanExams} Prüfungen</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        </div>
      </div>

      {/* Badges */}
      <BadgesSection userId={userId} token={token} />
    </>
  )
}
