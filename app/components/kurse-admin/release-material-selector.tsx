'use client'

// Schritt 10b: "Materialien"-Panel aus Layout_Admin_Tagesfreigaben.html. Fach-Filter bewusst
// weggelassen (siehe Kommentar in tagesfreigaben-actions.ts) -- nur Titelsuche.

import { useMemo, useState } from 'react'
import type { ReleaseContentItem } from '@/types/kurs-tagesfreigabe'

export type SelectedKey = string // `${kind}:${sourceId}`
export const keyOf = (kind: ReleaseContentItem['kind'], sourceId: string): SelectedKey => `${kind}:${sourceId}`

export function ReleaseMaterialSelector({
  items,
  selectedKeys,
  onToggle,
}: {
  items: ReleaseContentItem[]
  selectedKeys: Set<SelectedKey>
  onToggle: (item: ReleaseContentItem) => void
}) {
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('all')

  const availableSubjects = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) {
      if (item.subject) set.add(item.subject)
    }
    return Array.from(set).sort()
  }, [items])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesSearch = !term || item.title.toLowerCase().includes(term) || item.subject.toLowerCase().includes(term)
      const matchesSubject = subject === 'all' || item.subject === subject
      return matchesSearch && matchesSubject
    })
  }, [items, search, subject])

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="editor-head flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Lerneinheiten und Übungen auswählen</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Die Reihenfolge entspricht dem Schüler-Dashboard.</p>
        </div>
        <span className="font-mono text-xs bg-muted px-2.5 py-1.5 rounded-full whitespace-nowrap">
          {selectedKeys.size} ausgewählt
        </span>
      </div>
      <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Material suchen …"
          aria-label="Material suchen"
          className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm"
        />
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="Fach filtern"
          className="h-10 px-3 rounded-lg border border-border bg-background text-sm min-w-[130px]"
        >
          <option value="all">Alle Fächer</option>
          {availableSubjects.map((sub) => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      </div>
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
        {filtered.length === 0 && <p className="p-5 text-sm text-muted-foreground">Keine Treffer.</p>}
        {filtered.map((item) => {
          const key = keyOf(item.kind, item.sourceId)
          const checked = selectedKeys.has(key)
          return (
            <label key={key} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={() => onToggle(item)} className="w-4 h-4" />
              <span
                className={`w-9 h-9 rounded-lg grid place-items-center text-sm font-bold shrink-0 ${
                  item.kind === 'trainer_exam'
                    ? 'bg-accent/20 text-accent-foreground'
                    : item.kind === 'learning_material'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary/20 text-secondary-foreground'
                }`}
              >
                {item.kind === 'trainer_exam' ? 'P' : item.kind === 'learning_material' ? 'L' : 'Ü'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground truncate">{item.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.subject} · {item.typeLabel}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
