'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { createAuthenticatedBrowserClient } from '@/lib/supabase/client'
import {
  CLASS_LEVELS,
  normalizeClassLevel,
  type ClassLevel,
} from '@/lib/class-levels'

export { CLASS_LEVELS }
export type { ClassLevel }

interface ClassFilterContextType {
  selectedClass: ClassLevel | null
  setSelectedClass: (classLevel: ClassLevel | null) => void
  userDefaultClass: ClassLevel | null
  isLoading: boolean
  resetToUserDefault: () => void
}

const ClassFilterContext = createContext<ClassFilterContextType | undefined>(undefined)

export function ClassFilterProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [selectedClass, setSelectedClassState] = useState<ClassLevel | null>(null)
  const [userDefaultClass, setUserDefaultClass] = useState<ClassLevel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedFromProfile, setHasLoadedFromProfile] = useState(false)

  // Authentifizierter Supabase Client
  const supabaseAccessToken = session?.supabaseAccessToken
  const supabase = useMemo(
    () => supabaseAccessToken ? createAuthenticatedBrowserClient(supabaseAccessToken) : null,
    [supabaseAccessToken]
  )

  // Load user's class level from profile - PRIORITÄT
  useEffect(() => {
    async function loadUserClassLevel() {
      if (!session?.user?.id || !supabase) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('class_level')
          .eq('id', session.user.id)
          .single()

        if (error) {
          console.warn('Could not load user class level:', error.message)
        } else {
          const userClass = normalizeClassLevel(data?.class_level)
          if (!userClass) return
          setUserDefaultClass(userClass)
          // Setze die Klasse aus dem Profil (überschreibt localStorage)
          setSelectedClassState(userClass)
        }
      } catch {
        console.warn('Failed to load user class level')
      } finally {
        setHasLoadedFromProfile(true)
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      loadUserClassLevel()
    } else if (status === 'unauthenticated') {
      setHasLoadedFromProfile(true)
      setIsLoading(false)
    }
  }, [session?.user?.id, supabase, status])

  // Persist selection to localStorage (nur wenn manuell geändert)
  useEffect(() => {
    if (hasLoadedFromProfile && selectedClass) {
      localStorage.setItem('zap-selected-class', selectedClass)
    }
  }, [selectedClass, hasLoadedFromProfile])

  // Load from localStorage ONLY if no profile class is set
  // This runs after profile load attempt
  useEffect(() => {
    if (hasLoadedFromProfile && !selectedClass) {
      const saved = localStorage.getItem('zap-selected-class')
      const savedClass = normalizeClassLevel(saved)
      if (savedClass) {
        setSelectedClassState(savedClass)
      }
    }
  }, [hasLoadedFromProfile, selectedClass])

  const setSelectedClass = useCallback((classLevel: ClassLevel | null) => {
    setSelectedClassState(classLevel)
    if (classLevel) {
      localStorage.setItem('zap-selected-class', classLevel)
    } else {
      localStorage.removeItem('zap-selected-class')
    }
  }, [])

  const resetToUserDefault = useCallback(() => {
    setSelectedClass(userDefaultClass)
  }, [userDefaultClass, setSelectedClass])

  const value = useMemo(() => ({
    selectedClass,
    setSelectedClass,
    userDefaultClass,
    isLoading,
    resetToUserDefault,
  }), [selectedClass, setSelectedClass, userDefaultClass, isLoading, resetToUserDefault])

  return (
    <ClassFilterContext.Provider value={value}>
      {children}
    </ClassFilterContext.Provider>
  )
}

export function useClassFilter() {
  const context = useContext(ClassFilterContext)
  if (context === undefined) {
    throw new Error('useClassFilter must be used within a ClassFilterProvider')
  }
  return context
}

// Helper hook to filter items by class level
export function useFilterByClass<T extends { klassenstufen?: string[], class_levels?: string[] }>(
  items: T[]
): T[] {
  const { selectedClass } = useClassFilter()
  
  return useMemo(() => {
    if (!selectedClass) return items
    
    return items.filter(item => {
      // Support both naming conventions
      const levels = item.klassenstufen || item.class_levels || []
      return levels.includes(selectedClass)
    })
  }, [items, selectedClass])
}
