import { Suspense } from 'react'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Calculator } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { MathematikExercises } from './mathematik-exercises'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Exercise } from '@/types/exercise'

export default async function MathematikPage() {
  const session = await auth()

  if (!session?.user?.id || !session.supabaseAccessToken) {
    redirect('/login')
  }

  const supabase = await createServerSupabaseClient()
  const { data: dbExercises } = await supabase
    .from('exercises')
    .select('id, title, subtitle, type, class_levels')
    .eq('subject_id', 1)
    .order('id')
  const exerciseIds = (dbExercises ?? []).map((e) => e.id)
  const { data: dbTasks } = await supabase
    .from('tasks').select('id, exercise_id, question, solution, type, formula, hint, options')
    .in('exercise_id', exerciseIds.length ? exerciseIds : [0]).order('id')

  const aufgaben: Exercise[] = (dbExercises ?? []).map((ex) => ({
    id: String(ex.id),
    title: ex.title ?? '',
    subtitle: ex.subtitle ?? undefined,
    table: ex.type === 'table',
    class_levels: ex.class_levels,
    tasks: (dbTasks ?? [])
      .filter((t) => t.exercise_id === ex.id)
      .map((t) => ({
        id: t.id,
        question: t.question,
        solution: t.solution,
        type: (t.type ?? 'numeric') as Exercise['tasks'][number]['type'],
        formula: t.formula ?? undefined,
        hint: t.hint ?? undefined,
        options: Array.isArray(t.options) ? (t.options as string[]) : undefined,
      })),
  }))

  return (
    <div className="p-6 lg:p-8">
      {/* Statische Shell: Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Mathematik Übungen</h1>
        </div>
        <p className="text-muted-foreground">
          Löse die Aufgaben und überprüfe deine Antworten.
        </p>
      </div>

      <Suspense fallback={<MathematikSkeleton count={aufgaben.length} />}>
        <MathematikExercises
          aufgaben={aufgaben}
          userId={session.user.id}
          token={session.supabaseAccessToken}
        />
      </Suspense>
    </div>
  )
}

function MathematikSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: Math.max(count, 3) }).map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-2xl" />
      ))}
      <Skeleton className="h-12 w-48 rounded-xl" />
    </div>
  )
}
