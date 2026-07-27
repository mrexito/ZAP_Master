'use client'

import { useState, useEffect, useMemo } from 'react'
import { createAuthenticatedBrowserClient } from '@/lib/supabase/client'
import { BookOpen, CheckCircle2, XCircle, Lightbulb, RotateCcw } from 'lucide-react'
import type { Exercise } from '@/types/exercise'
import { useClassFilter, useFilterByClass } from '@/context/ClassFilterContext'

interface Props {
  aufgaben: Exercise[]
  userId: string
  token: string
}

export function DeutschExercises({ aufgaben, userId, token }: Props) {
  const { selectedClass } = useClassFilter()
  const filteredAufgaben = useFilterByClass(aufgaben)
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<Record<number, boolean>>({})
  const [showHint, setShowHint] = useState<Record<number, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)

  const supabase = useMemo(
    () => createAuthenticatedBrowserClient(token),
    [token]
  )

  useEffect(() => {
    const fetchUserAnswers = async () => {
      const { data: savedAnswers, error } = await supabase
        .from('user_exercises')
        .select('*')
        .eq('user_id', userId)
        .eq('exercise_type', 'deutsch')

      if (!error && savedAnswers) {
        const answers: Record<number, string> = {}
        savedAnswers.forEach((answer) => {
          if (answer.question_id !== null) answers[answer.question_id] = answer.user_answer || ''
        })
        setUserAnswers(answers)
      }
    }
    fetchUserAnswers()
  }, [userId, supabase])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setChecked(false)
      setResults({})
      setShowHint({})
    })

    return () => cancelAnimationFrame(frame)
  }, [selectedClass])

  const handleInputChange = (id: number, value: string) => {
    setUserAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleCheckAnswers = async () => {
    const currentResults: Record<number, boolean> = {}
    setIsSaving(true)

    for (const aufgabe of filteredAufgaben) {
      for (const task of aufgabe.tasks) {
        const userAnswer = userAnswers[task.id] || ''
        const isCorrect = userAnswer.trim().toLowerCase() === task.solution.toLowerCase()
        currentResults[task.id] = isCorrect

        const { data } = await supabase
          .from('user_exercises')
          .select('id')
          .eq('user_id', userId)
          .eq('question_id', task.id)
          .eq('exercise_type', 'deutsch')
          .maybeSingle()

        if (data) {
          await supabase.from('user_exercises').update({ user_answer: userAnswer, is_correct: isCorrect, question: task.question }).eq('id', data.id)
        } else {
          await supabase.from('user_exercises').insert({ user_id: userId, exercise_type: 'deutsch', question_id: task.id, question: task.question, user_answer: userAnswer, is_correct: isCorrect })
        }
      }
    }

    setResults(currentResults)
    setChecked(true)
    setIsSaving(false)
  }

  const handleClearAll = async () => {
    await supabase.from('user_exercises').delete().eq('user_id', userId).eq('exercise_type', 'deutsch')
    setUserAnswers({})
    setChecked(false)
    setResults({})
    setShowHint({})
  }

  const totalTasks = filteredAufgaben.reduce((sum, a) => sum + a.tasks.length, 0)
  const correctCount = Object.values(results).filter(Boolean).length

  return (
    <>
      {filteredAufgaben.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="mb-2 text-lg font-medium text-foreground">
            Keine Deutsch-Übungen für {selectedClass ?? 'diese Klasse'}
          </h2>
          <p className="text-muted-foreground">
            Wähle oben eine andere Klassenstufe oder schau später wieder vorbei.
          </p>
        </div>
      )}

      {checked && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-foreground">Dein Ergebnis</span>
            <span className="text-lg font-bold text-yellow-600 dark:text-yellow-500">{correctCount} / {totalTasks} richtig</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className="bg-yellow-600 dark:bg-yellow-500 h-3 rounded-full transition-all duration-500" style={{ width: `${(correctCount / totalTasks) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {filteredAufgaben.map((aufgabe) => (
          <div key={aufgabe.id} className="bg-card rounded-2xl shadow-sm border border-border p-6">
            <h2 className="text-xl font-bold text-foreground mb-2">{aufgabe.title}</h2>
            {aufgabe.subtitle && <p className="text-muted-foreground mb-4">{aufgabe.subtitle}</p>}

            <div className="space-y-4">
              {aufgabe.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border ${checked ? (results[task.id] ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30') : 'bg-muted border-border'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-foreground mb-3">{task.question}</p>

                      {task.type === 'multiple_choice' && task.options ? (
                        <div className="space-y-2" role="group" aria-label={task.question}>
                          {task.options.map((option, idx) => (
                            <label key={idx} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${userAnswers[task.id] === option ? 'bg-yellow-500/20 border-yellow-500/40' : 'bg-card border-border hover:bg-muted'} ${checked ? 'pointer-events-none' : ''}`}>
                              <input type="radio" name={`task-${task.id}`} value={option} checked={userAnswers[task.id] === option} onChange={(e) => handleInputChange(task.id, e.target.value)} className="w-4 h-4 accent-yellow-600" disabled={checked} />
                              <span className="text-foreground">{option}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="text"
                          aria-label={task.question}
                          value={userAnswers[task.id] || ''}
                          onChange={(e) => handleInputChange(task.id, e.target.value)}
                          placeholder="Deine Antwort..."
                          className="w-full max-w-md px-3 py-2 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                          disabled={checked}
                        />
                      )}

                      {checked && (
                        <div className="mt-3 flex items-center gap-2">
                          {results[task.id] ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" />Richtig!</span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600 text-sm"><XCircle className="w-4 h-4" />Falsch. Lösung: <strong>{task.solution}</strong></span>
                          )}
                        </div>
                      )}
                    </div>

                    {task.hint && !checked && (
                      <button onClick={() => setShowHint((prev) => ({ ...prev, [task.id]: !prev[task.id] }))} className="p-2 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/10 rounded-xl transition-colors" aria-label="Hinweis anzeigen">
                        <Lightbulb className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {showHint[task.id] && task.hint && (
                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-700 dark:text-yellow-400 text-sm">
                      💡 {task.hint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredAufgaben.length > 0 && <div className="mt-8 flex flex-wrap gap-4">
        {!checked ? (
          <button onClick={handleCheckAnswers} disabled={isSaving} className="px-6 py-3 bg-yellow-600 dark:bg-yellow-500 text-white dark:text-gray-900 rounded-xl font-medium hover:bg-yellow-700 dark:hover:bg-yellow-400 transition-colors disabled:opacity-50">
            {isSaving ? 'Speichern...' : 'Antworten überprüfen'}
          </button>
        ) : (
          <button onClick={handleClearAll} className="flex items-center gap-2 px-6 py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors">
            <RotateCcw className="w-4 h-4" />
            Neu starten
          </button>
        )}
      </div>}
    </>
  )
}
