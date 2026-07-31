'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  FileText,
  User,
  ChevronRight,
  ChevronDown,
  Settings,
  Calendar,
  Users,
  Shield,
  BookOpen,
  PenLine,
  Handshake,
  Inbox,
  UserCheck,
  PanelLeft,
  PanelLeftClose,
  Mail,
  BarChart3,
  CalendarCheck2,
  Clock,
  Timer,
} from 'lucide-react'

// Haupt-Navigation (immer sichtbar)
const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Profil', href: '/profil', icon: User },
]

// Lerninhalte-Gruppe (zusammenklappbar)
const lernenNavigation = [
  { name: 'Prüfungstrainer', href: '/trainer', icon: GraduationCap },
  { name: 'Übungen', href: '/uebungen', icon: ClipboardList },
  { name: 'Lernmaterialien', href: '/materialien', icon: BookOpen },
  { name: 'Simulationsprüfung', href: '/pruefung', icon: FileText },
  { name: 'Aufsätze', href: '/aufsaetze', icon: PenLine },
]

// Admin-Kursübersichten auf Basis des zentralen Angebotskatalogs
const adminKurseNavigation = [
  { name: 'Kursüberblick', href: '/dashboard/kurse', icon: Calendar, exact: true },
  { name: 'Intensivkurse', href: '/dashboard/kurse/intensivkurse', icon: Calendar },
  { name: 'Vorkurse', href: '/dashboard/kurse/vorkurse', icon: GraduationCap },
]

// Lehrpersonen erhalten nur den Kursüberblick. Die Angebotsübersichten für
// Intensivkurse und Vorkurse sind ausschließlich für Administratoren sichtbar.
const lehrpersonKurseNavigation = [
  { name: 'Kursüberblick', href: '/dashboard/kurse', icon: Calendar, exact: true },
]

// Mentoring-System (Mentorship)
const mentoringNavigation = [
  { name: 'Marktplatz', href: '/dashboard/mentorship', icon: Handshake, exact: true },
  { name: 'Meine Anfragen', href: '/dashboard/mentorship/requests', icon: Inbox },
  { name: 'Meine Mentoren', href: '/dashboard/mentorship/relations', icon: UserCheck },
]

// Navigation für Lehrpersonen (Content-Management)
const lehrpersonNavigation = [
  { name: 'Tagesfreigaben', href: '/dashboard/kurse/tagesfreigaben', icon: CalendarCheck2 },
  { name: 'Übungen verwalten', href: '/dashboard/uebungen', icon: ClipboardList },
  { name: 'Lernmaterialien', href: '/dashboard/materialien', icon: BookOpen },
  { name: 'Aufsätze bewerten', href: '/dashboard/aufsaetze', icon: PenLine },
]

// Navigation nur für System-Admins
const adminNavigation = [
  { name: 'Kursangebote', href: '/dashboard/kurse/angebote', icon: BookOpen },
  { name: 'Arbeitszeiten', href: '/dashboard/arbeitszeiten', icon: Clock },
  { name: 'Eigene Arbeitszeiten', href: '/arbeitszeiten', icon: Timer },
  { name: 'Finanz-Cockpit', href: '/dashboard/finanzen', icon: BarChart3 },
  { name: 'Benutzer', href: '/dashboard/admin/benutzer', icon: Users },
  { name: 'Mail-Warteschlange', href: '/dashboard/mail-outbox', icon: Mail },
  { name: 'Einstellungen', href: '/dashboard/admin/einstellungen', icon: Settings },
]

// Navigation Item Typ mit optionalem exact
type NavItem = {
  name: string
  href: string
  icon: React.ElementType
  exact?: boolean
}

// Kollabierbare Gruppe Komponente
function NavGroup({ 
  title, 
  icon: Icon, 
  items, 
  defaultOpen = false,
  variant = 'default',
  isCollapsed = false,
  onExpandSidebar
}: { 
  title: string
  icon: React.ElementType
  items: NavItem[]
  defaultOpen?: boolean
  variant?: 'default' | 'destructive'
  isCollapsed?: boolean
  onExpandSidebar?: () => void
}) {
  const pathname = usePathname()
  
  // Hilfsfunktion für isActive Check
  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }
  
  // Automatisch öffnen wenn ein Item aktiv ist
  const hasActiveItem = items.some(item => isItemActive(item))
  
  // Initial State basierend auf defaultOpen oder aktivem Item
  const [isOpen, setIsOpen] = useState(defaultOpen || hasActiveItem)

  const variantStyles = {
    default: {
      header: 'text-muted-foreground hover:text-foreground',
      badge: 'text-muted-foreground',
      active: 'bg-primary/10 text-primary',
      chevron: 'text-primary'
    },
    destructive: {
      header: 'text-muted-foreground hover:text-destructive',
      badge: 'text-destructive',
      active: 'bg-destructive/10 text-destructive',
      chevron: 'text-destructive'
    }
  }
  
  const styles = variantStyles[variant]
  
  // Collapsed: nur Gruppen-Icon anzeigen
  if (isCollapsed) {
    const handleCollapsedClick = () => {
      // Sidebar öffnen und Gruppe aufklappen
      if (onExpandSidebar) {
        onExpandSidebar()
      }
      setIsOpen(true)
    }
    
    return (
      <button
        onClick={handleCollapsedClick}
        aria-label={title}
        className={`w-full flex items-center justify-center p-3 rounded-xl transition-colors ${
          hasActiveItem
            ? `${styles.active}`
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <div className="flex items-center">
          <Icon className="w-5 h-5" />
        </div>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-colors ${styles.header}`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      
      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <nav className="ml-4 pl-4 border-l border-border/50 space-y-0.5 py-1">
          {items.map((item) => {
            const isActive = isItemActive(item)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? `${styles.active} font-medium`
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight className={`w-3.5 h-3.5 ${styles.chevron}`} />}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { isContentManager, isAdmin, isStudent } = useAuthStore()

  // Start mit false, dann aus localStorage laden nach Hydration
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  useEffect(() => {
    // localStorage erst nach Hydration lesen um SSR-Mismatch zu vermeiden
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') {
      // Defer state update to avoid cascading render warning
      requestAnimationFrame(() => {
        setIsCollapsed(true)
      })
    }
  }, [])
  
  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', String(newState))
  }
  
  const expandSidebar = () => {
    setIsCollapsed(false)
    localStorage.setItem('sidebar-collapsed', 'false')
  }
  
  return (
    <aside className={`${isCollapsed ? 'w-16 p-2' : 'w-64 p-4'} border-r border-border bg-card min-h-[calc(100vh-4rem)] hidden md:block transition-all duration-200`}>
      {/* Toggle Button */}
      <button
        onClick={toggleCollapsed}
        aria-label={isCollapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
        className={`w-full flex items-center justify-center ${isCollapsed ? 'p-3' : 'px-4 py-3'} mb-4 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors`}
      >
        {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
      </button>
      
      {/* Haupt-Navigation */}
      <nav className="space-y-1">
        {mainNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between px-4 py-3'} rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
                <item.icon className="w-5 h-5" />
                {!isCollapsed && <span>{item.name}</span>}
              </div>
              {isActive && !isCollapsed && <ChevronRight className="w-4 h-4" />}
            </Link>
          )
        })}
      </nav>

      {/* Lernen Gruppe */}
      <div className="mt-4 space-y-1">
        <NavGroup 
          title="Lernen" 
          icon={GraduationCap} 
          items={isStudent ? lernenNavigation : lernenNavigation.filter(i => i.href !== '/aufsaetze')}
          defaultOpen={true}
          isCollapsed={isCollapsed}
          onExpandSidebar={expandSidebar}
        />
        {/* Mentoring temporär ausgeblendet
        <NavGroup
          title="Mentoring"
          icon={Handshake}
          items={mentoringNavigation}
          isCollapsed={isCollapsed}
          onExpandSidebar={expandSidebar}
        />
        */}
      </div>

      {/* Lehrperson Section */}
      {isContentManager && (
        <div className="mt-6 pt-4 border-t border-border">
          <NavGroup 
            title="Lehrperson"
            icon={Settings} 
            items={lehrpersonNavigation}
            isCollapsed={isCollapsed}
            onExpandSidebar={expandSidebar}
          />
        </div>
      )}

      {/* Admin Section */}
      {isAdmin && (
        <div className="mt-6 pt-4 border-t border-border">
          <NavGroup 
            title="Administration" 
            icon={Shield} 
            items={adminNavigation}
            variant="destructive"
            isCollapsed={isCollapsed}
            onExpandSidebar={expandSidebar}
          />
        </div>
      )}

      {/* Der Kursabschnitt ist nur für Mitarbeitende sichtbar. Admins sehen
          zusätzlich die administrativen Angebotsübersichten. */}
      {(isAdmin || isContentManager) && (
        <div className="mt-6 pt-4 border-t border-border">
          <NavGroup
            title="Kurse"
            icon={Calendar}
            items={isAdmin ? adminKurseNavigation : lehrpersonKurseNavigation}
            isCollapsed={isCollapsed}
            onExpandSidebar={expandSidebar}
          />
        </div>
      )}
    </aside>
  )
}
