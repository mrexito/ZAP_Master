'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { BarChart3, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { createAuthenticatedBrowserClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'

interface Props {
  hasExamAnswers: boolean
}

export function PruefungsButtonsClient({ hasExamAnswers }: Props) {
  const router = useRouter()
  const { userId, supabaseAccessToken } = useAuthStore()
  const supabase = useMemo(
    () => supabaseAccessToken ? createAuthenticatedBrowserClient(supabaseAccessToken) : null,
    [supabaseAccessToken]
  )

  const handleStartExam = async () => {
    if (userId && supabase) {
      const { error } = await supabase
        .from('user_exercises')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_type', 'exam')

      if (error) {
        console.error('Error deleting previous answers:', error)
        return
      }
    }
    router.push('/pruefung/start')
  }

  const handleViewExam = () => {
    router.push('/pruefung/abgabe')
  }

  return (
    <div className={hasExamAnswers ? 'grid gap-3 sm:grid-cols-2' : 'w-full'}>
      {!hasExamAnswers ? (
        <Button
          type="button"
          size="lg"
          onClick={handleStartExam}
          className="w-full"
        >
          <Play />
          Mathematikprüfung starten
        </Button>
      ) : (
        <>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={handleStartExam}
            className="w-full"
          >
            <RotateCcw />
            Neu starten
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleViewExam}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <BarChart3 />
            Ergebnisse anzeigen
          </Button>
        </>
      )}
    </div>
  )
}
