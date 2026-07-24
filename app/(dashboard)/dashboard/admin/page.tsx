import Link from 'next/link'
import {
  Users,
  Settings,
  ArrowRight,
  BarChart3,
  Shield,
  BookOpen,
  CalendarCheck2,
} from 'lucide-react'
import { requireAdmin } from '@/lib/auth/guards'

const adminModules = [
  {
    name: 'Kursangebote',
    description: 'Angebote, Preise, Termine und Veröffentlichungen verwalten',
    href: '/dashboard/kurse/angebote',
    icon: BookOpen,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    name: 'Tagesfreigaben',
    description: 'Übungen und Prüfungen pro Kursdurchführung freischalten',
    href: '/dashboard/kurse/tagesfreigaben',
    icon: CalendarCheck2,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    name: 'Finanz-Cockpit',
    description: 'Teilnehmer, Umsatz und Kosten über alle Angebote auswerten',
    href: '/dashboard/finanzen',
    icon: BarChart3,
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    name: 'Benutzerverwaltung',
    description: 'Benutzerkonten und Berechtigungen verwalten',
    href: '/dashboard/admin/benutzer',
    icon: Users,
    color: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    name: 'Statistiken',
    description: 'Nutzungsstatistiken und Analysen einsehen',
    href: '/dashboard/admin/statistiken',
    icon: BarChart3,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
  {
    name: 'Einstellungen',
    description: 'Systemeinstellungen und Konfiguration',
    href: '/dashboard/admin/einstellungen',
    icon: Settings,
    color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  },
]

export default async function AdminPage() {
  // Server-side Rollenprüfung: nur System-Admins
  await requireAdmin()
  
  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Administration</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Verwalte Kursangebote, Tagesfreigaben, Finanzen und das System
        </p>
      </div>

      {/* Admin Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {adminModules.map((module) => (
          <Link
            key={module.name}
            href={module.href}
            className="group rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${module.color}`}>
                  <module.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {module.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {module.description}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
