'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  Shield, 
  ShieldCheck, 
  User as UserIcon,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronDown,
  Check
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { DropdownMenuComplex, DropdownMenuSeparator, DropdownMenuLabel } from '@/app/components/ui/dropdown-menu'
import { updateUserRole, deleteUser, type UserWithProfile } from './actions'
import type { UserRole } from '@/types/next-auth'
import Image from 'next/image'

const roleConfig: Record<UserRole, { label: string, icon: typeof UserIcon, color: string }> = {
  user: { 
    label: 'Benutzer', 
    icon: UserIcon, 
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' 
  },
  lehrperson: { 
    label: 'Lehrperson', 
    icon: Shield, 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
  },
  admin: { 
    label: 'Admin', 
    icon: ShieldCheck, 
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
  },
}

type DeleteModalState = {
  isOpen: boolean
  user: UserWithProfile | null
  status: 'confirm' | 'loading' | 'success' | 'error'
  errorMessage?: string
}

type SortField = 'name' | 'email' | 'role' | 'created_at'
type SortDirection = 'asc' | 'desc'

type Props = {
  users: UserWithProfile[]
  currentUserId: string
}

export function UserTable({ users, currentUserId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilters, setRoleFilters] = useState<Set<UserRole>>(new Set())
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false)
  const roleFilterRef = useRef<HTMLDivElement>(null)
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    user: null,
    status: 'confirm'
  })

  // Gefilterte und sortierte Benutzer
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users]
    
    // Suche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase()
        const email = (user.email || '').toLowerCase()
        return fullName.includes(query) || email.includes(query)
      })
    }
    
    // Rollenfilter (Multi-Select)
    if (roleFilters.size > 0) {
      result = result.filter(user => roleFilters.has(user.role))
    }
    
    // Sortierung
    result.sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'name':
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
          comparison = nameA.localeCompare(nameB)
          break
        case 'email':
          comparison = (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase())
          break
        case 'role':
          const roleOrder = { admin: 0, lehrperson: 1, user: 2 }
          comparison = roleOrder[a.role] - roleOrder[b.role]
          break
        case 'created_at':
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          comparison = dateA - dateB
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    return result
  }, [users, searchQuery, roleFilters, sortField, sortDirection])

  // Close role filter dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleFilterRef.current && !roleFilterRef.current.contains(event.target as Node)) {
        setIsRoleFilterOpen(false)
      }
    }
    if (isRoleFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isRoleFilterOpen])

  const toggleRoleFilter = (role: UserRole) => {
    setRoleFilters(prev => {
      const newSet = new Set(prev)
      if (newSet.has(role)) {
        newSet.delete(role)
      } else {
        newSet.add(role)
      }
      return newSet
    })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />
  }

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setOpenMenuId(null)

    startTransition(async () => {
      const result = await updateUserRole(userId, newRole)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Rolle erfolgreich geändert')
      }
    })
  }

  const openDeleteModal = (user: UserWithProfile) => {
    setOpenMenuId(null)
    setDeleteModal({
      isOpen: true,
      user,
      status: 'confirm'
    })
  }

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      user: null,
      status: 'confirm'
    })
  }

  const confirmDelete = () => {
    if (!deleteModal.user) return
    
    setDeleteModal(prev => ({ ...prev, status: 'loading' }))
    
    startTransition(async () => {
      const result = await deleteUser(deleteModal.user!.id)
      if (result.error) {
        setDeleteModal(prev => ({ 
          ...prev, 
          status: 'error',
          errorMessage: result.error || 'Unbekannter Fehler'
        }))
      } else {
        setDeleteModal(prev => ({ ...prev, status: 'success' }))
      }
    })
  }

  return (
    <div>
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Nach Name oder E-Mail suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        
        {/* Role Filter - Multi-Select */}
        <div ref={roleFilterRef} className="relative">
          <button
            onClick={() => setIsRoleFilterOpen(!isRoleFilterOpen)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card text-foreground transition-colors min-w-[160px] ${
              isRoleFilterOpen 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-border hover:border-muted-foreground/50'
            }`}
          >
            <span className="flex-1 text-left text-sm">
              {roleFilters.size === 0 
                ? 'Alle Rollen' 
                : roleFilters.size === 1 
                  ? roleConfig[Array.from(roleFilters)[0]].label
                  : `${roleFilters.size} Rollen`}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isRoleFilterOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isRoleFilterOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg z-50 py-1">
              {/* Clear all option */}
              {roleFilters.size > 0 && (
                <>
                  <button
                    onClick={() => setRoleFilters(new Set())}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Filter zurücksetzen
                  </button>
                  <div className="my-1 border-t border-border" />
                </>
              )}
              
              {/* Role options */}
              {(['admin', 'lehrperson', 'user'] as UserRole[]).map((role) => {
                const config = roleConfig[role]
                const Icon = config.icon
                const isSelected = roleFilters.has(role)
                
                return (
                  <button
                    key={role}
                    onClick={() => toggleRoleFilter(role)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'bg-primary border-primary' 
                        : 'border-border'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left text-foreground">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {users.filter(u => u.role === role).length}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || roleFilters.size > 0) && (
        <p className="text-sm text-muted-foreground mb-3">
          {filteredAndSortedUsers.length} von {users.length} Benutzer{users.length !== 1 ? 'n' : ''}
          {searchQuery && <span> für &quot;{searchQuery}&quot;</span>}
          {roleFilters.size > 0 && (
            <span> • {roleFilters.size === 1 ? 'Rolle' : 'Rollen'}: {Array.from(roleFilters).map(r => roleConfig[r].label).join(', ')}</span>
          )}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-6 py-4 text-left">
                  <button 
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Benutzer
                    {getSortIcon('name')}
                  </button>
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('role')}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Rolle
                    {getSortIcon('role')}
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                  Kurs
                </th>
                <th className="px-6 py-4 text-left">
                  <button
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Registriert
                    {getSortIcon('created_at')}
                  </button>
                </th>
                <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery || roleFilters.size > 0 
                        ? 'Keine Benutzer gefunden für diese Filter'
                        : 'Keine Benutzer vorhanden'}
                    </p>
                    {(searchQuery || roleFilters.size > 0) && (
                      <button
                        onClick={() => {
                          setSearchQuery('')
                          setRoleFilters(new Set())
                        }}
                        className="mt-2 text-sm text-primary hover:underline"
                      >
                        Filter zurücksetzen
                      </button>
                    )}
                  </td>
                </tr>
              ) : filteredAndSortedUsers.map((user) => {
                const config = roleConfig[user.role]
                const Icon = config.icon
                const isCurrentUser = user.id === currentUserId
                const hasValidAvatar = user.avatar_url && user.avatar_url.startsWith('http')
                
                return (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                          {hasValidAvatar ? (
                            <Image 
                              src={user.avatar_url!} 
                              alt="" 
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium text-primary">
                              {(user.first_name?.[0] || user.email?.[0] || '?').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}`
                              : user.email}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-muted-foreground">(Du)</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {config.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.enrolledCourses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.enrolledCourses.map((course) => (
                            <span
                              key={course.kursId}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground"
                              title={course.fach}
                            >
                              {course.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString('de-CH', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenuComplex
                        trigger={<MoreHorizontal className="h-4 w-4" />}
                        disabled={isPending}
                        isOpen={openMenuId === user.id}
                        onOpenChange={(open) => setOpenMenuId(open ? user.id : null)}
                      >
                        <div className="p-1">
                          <DropdownMenuLabel>Rolle ändern</DropdownMenuLabel>
                          {(['user', 'lehrperson', 'admin'] as UserRole[]).map((role) => {
                            const rc = roleConfig[role]
                            const RoleIcon = rc.icon
                            return (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(user.id, role)}
                                disabled={user.role === role || isPending}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                  user.role === role 
                                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                                    : 'hover:bg-muted text-foreground'
                                }`}
                              >
                                <RoleIcon className="h-4 w-4" />
                                {rc.label}
                                {user.role === role && (
                                  <span className="ml-auto text-xs text-muted-foreground">Aktuell</span>
                                )}
                              </button>
                            )
                          })}
                          <DropdownMenuSeparator />
                          <button
                            onClick={() => openDeleteModal(user)}
                            disabled={isCurrentUser || isPending}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                              isCurrentUser 
                                ? 'text-muted-foreground cursor-not-allowed' 
                                : 'text-destructive hover:bg-destructive/10'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Löschen
                          </button>
                        </div>
                      </DropdownMenuComplex>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.user && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={deleteModal.status === 'confirm' ? closeDeleteModal : undefined}
        >
          <div 
            className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confirm State */}
            {deleteModal.status === 'confirm' && (
              <div className="p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Benutzer löschen?
                </h2>
                <p className="text-muted-foreground mb-2">
                  Möchtest du diesen Benutzer wirklich löschen?
                </p>
                <div className="bg-muted/50 rounded-xl p-4 mb-6">
                  <p className="font-medium text-foreground">
                    {deleteModal.user.first_name && deleteModal.user.last_name 
                      ? `${deleteModal.user.first_name} ${deleteModal.user.last_name}`
                      : deleteModal.user.email}
                  </p>
                  <p className="text-sm text-muted-foreground">{deleteModal.user.email}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={closeDeleteModal}
                    className="rounded-xl"
                  >
                    Abbrechen
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={confirmDelete}
                    className="rounded-xl gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen
                  </Button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {deleteModal.status === 'loading' && (
              <div className="p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <Trash2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Wird gelöscht...
                </h2>
                <p className="text-muted-foreground">
                  Bitte warten
                </p>
              </div>
            )}

            {/* Success State */}
            {deleteModal.status === 'success' && (
              <div className="p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Erfolgreich gelöscht!
                </h2>
                <p className="text-muted-foreground mb-2">
                  Der Benutzer wurde entfernt.
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  <span className="font-medium text-foreground">{deleteModal.user.email}</span>
                  <br />wurde aus dem System gelöscht.
                </p>
                <Button onClick={closeDeleteModal} className="rounded-xl">
                  Schliessen
                </Button>
              </div>
            )}

            {/* Error State */}
            {deleteModal.status === 'error' && (
              <div className="p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Fehler beim Löschen
                </h2>
                <p className="text-muted-foreground mb-6">
                  {deleteModal.errorMessage}
                </p>
                <Button onClick={closeDeleteModal} className="rounded-xl">
                  Schliessen
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
