import { Plus } from 'lucide-react'
import type { ContentSection } from '@/types/marketing'

interface CourseContentProps {
  sections: ContentSection[]
}

// Natives <details>/<summary> statt shadcn Collapsible (Abschnitt 1b: kein gesteuerter Zustand
// nötig, jeder Abschnitt klappt unabhängig auf/zu) -- wie im design-reference-Markup, wo nur der
// erste Fachabschnitt per Default offen ist.
function CourseContent({ sections }: CourseContentProps) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {sections.map((section, index) => (
        <details key={section.id} className="group" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 marker:hidden">
            <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-secondary">
              {section.title}
            </h3>
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 group-open:text-secondary" />
          </summary>
          <div className="flex flex-col gap-4 px-6 pb-6">
            {section.lede ? <p className="text-sm text-muted-foreground">{section.lede}</p> : null}
            <div className="grid gap-6 md:grid-cols-2">
              {section.groups.map((group) => (
                <div key={group.id} className="flex flex-col gap-2">
                  {group.subhead ? (
                    <h4 className="font-serif text-base font-semibold text-foreground">
                      {group.subhead}
                    </h4>
                  ) : null}
                  <ul className="space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground">
                        — {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

export { CourseContent }
