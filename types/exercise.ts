// Types for exercises (Übungen)

export interface ExerciseTask {
  id: number
  question: string
  solution: string
  type: 'numeric' | 'text' | 'bool' | 'multiple_choice'
  hint?: string
  formula?: string
  options?: string[]
  highlight?: string
}

export interface Exercise {
  id: string
  title: string
  subtitle?: string
  table?: boolean
  class_levels: string[]
  tasks: ExerciseTask[]
}

export interface ExerciseData {
  uebungen: {
    mathematik?: {
      title: string
      aufgaben: Exercise[]
    }
    deutsch?: {
      title: string
      aufgaben: Exercise[]
    }
  }
}

export interface MathSolutionStep {
  step_number: number
  explanation: string
  formula?: string
}

export interface UserExerciseAnswer {
  id: string
  user_id: string
  exercise_type: 'mathematik' | 'deutsch'
  question_id: number
  question: string
  user_answer: string
  is_correct: boolean
  created_at?: string
}
