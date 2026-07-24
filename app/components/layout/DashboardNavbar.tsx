'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Menu, X, LogOut, User, ChevronDown } from 'lucide-react'
import { useClassFilter } from '@/context/ClassFilterContext'
import { CLASS_LEVEL_NAV_ITEMS, type ClassLevel } from '@/lib/class-levels'

export default function DashboardNavbar() {
  const router = useRouter()
  const { name, email, isAuthenticated, isContentManager } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { selectedClass, setSelectedClass, userDefaultClass, isLoading } = useClassFilter()

  const selectClass = (classLevel: ClassLevel) => {
    setSelectedClass(classLevel)
    setMobileMenuOpen(false)
    router.push(isContentManager ? '/dashboard/materialien' : '/materialien')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#16233F] text-white">
      <div className="flex justify-between h-16 px-4">
        {/* Logo - gleiche Position wie Sidebar (w-64 = 256px, p-4 = 16px) */}
        <div className="flex items-center w-64 shrink-0">
          <Link
            href="/de"
            aria-label="Lernecke Startseite"
            className="font-serif-marketing text-xl font-semibold"
          >
            <span className="text-[#8CB392]">Lern</span>
            <em className="text-[#C89B3C]">ecke</em>
          </Link>
        </div>

        {/* Center - direkte Klassennavigation wie auf der Startseite */}
        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex">
          <div
            aria-label="Klassenstufen"
            className="flex max-w-full items-center gap-1 overflow-x-auto"
          >
            {CLASS_LEVEL_NAV_ITEMS.map((item) => {
              const isActive = selectedClass === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => selectClass(item.value)}
                  disabled={isLoading}
                  aria-current={isActive ? 'page' : undefined}
                  aria-pressed={isActive}
                  title={item.value === userDefaultClass ? `${item.value} · Profilklasse` : item.value}
                  className={`min-h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                    <span className="text-[#8CB392] font-medium text-sm">
                      {name?.charAt(0)?.toUpperCase() ||
                        email?.charAt(0)?.toUpperCase() ||
                        'U'}
                    </span>
                  </div>
                  <span className="text-sm text-white max-w-[150px] truncate">
                    {name || email}
                  </span>
                  <ChevronDown className="w-4 h-4 text-white/70" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg z-20 py-1">
                      <Link
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        Profil
                      </Link>
                      <hr className="my-1 border-border" />
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 w-full transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Abmelden
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Menü schliessen' : 'Menü öffnen'}
              aria-expanded={mobileMenuOpen}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#16233F]">
          <div className="px-4 py-4 space-y-1">
            {/* Mobile Class Filter */}
            <div className="pb-3 mb-3 border-b border-white/10">
              <p className="text-xs text-white/65 px-2 mb-2">Klasse auswählen</p>
              <div className="flex flex-wrap gap-2">
                {CLASS_LEVEL_NAV_ITEMS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => selectClass(item.value)}
                    aria-pressed={selectedClass === item.value}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      selectedClass === item.value
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/85 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            
            <Link
              href="/profil"
              className="flex items-center gap-3 px-4 py-3 text-base font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              <User className="w-5 h-5" />
              Profil
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-3 px-4 py-3 text-base font-medium text-[#F0BBC1] hover:bg-white/10 w-full rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Abmelden
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
