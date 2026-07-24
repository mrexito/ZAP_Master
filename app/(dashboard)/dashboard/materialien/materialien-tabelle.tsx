'use client'

import { useState } from 'react'
import { formatFileSize } from '@/lib/utils/format'
import { 
  FileText, 
  Pencil, 
  Trash2, 
  Download, 
  Eye,
  FileSpreadsheet,
  FileImage,
  Video,
  Music,
  File,
  Search,
  Link as LinkIcon,
  ExternalLink,
  Globe,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { DropdownMenu, DropdownMenuItem } from '@/app/components/ui/dropdown-menu'
import { deleteMaterial } from './actions'
import { useClassFilter } from '@/context/ClassFilterContext'

interface Subject {
  id: number
  name: string
}

interface Material {
  id: number
  name: string
  description: string | null
  type: string
  file_url: string | null
  file_size: number | null
  file_type: string | null
  class_levels: string[]
  download_count: number
  is_public: boolean
  is_link?: boolean
  created_at: string
  subject_id: number | null
  subjects: Subject | null
}

const fileTypeIcons: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="w-5 h-5 text-red-500" />,
  'application/msword': <FileText className="w-5 h-5 text-blue-500" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText className="w-5 h-5 text-blue-500" />,
  'application/vnd.ms-excel': <FileSpreadsheet className="w-5 h-5 text-green-500" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileSpreadsheet className="w-5 h-5 text-green-500" />,
  'image/jpeg': <FileImage className="w-5 h-5 text-purple-500" />,
  'image/png': <FileImage className="w-5 h-5 text-purple-500" />,
  'video/mp4': <Video className="w-5 h-5 text-orange-500" />,
  'audio/mpeg': <Music className="w-5 h-5 text-pink-500" />,
}

function getFileIcon(fileType: string | null, isLink?: boolean) {
  if (isLink) return <Globe className="w-5 h-5 text-primary" />
  if (!fileType) return <File className="w-5 h-5 text-muted-foreground" />
  return fileTypeIcons[fileType] || <File className="w-5 h-5 text-muted-foreground" />
}


// Get favicon URL for a link
function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // Use Google's favicon service for reliable favicons
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
  } catch {
    return ''
  }
}

// Check if URL is YouTube
function isYouTubeUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')
  } catch {
    return false
  }
}

interface Props {
  materials: Material[]
  subjects: Subject[]
}

export function MaterialienTabelle({ materials, subjects }: Props) {
  const { selectedClass } = useClassFilter()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    material: Material | null
    status: 'confirm' | 'loading' | 'success' | 'error'
    errorMessage?: string
  }>({ isOpen: false, material: null, status: 'confirm' })

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = !searchTerm || 
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSubject = !selectedSubject || material.subject_id === selectedSubject
    const matchesClass = !selectedClass || material.class_levels?.includes(selectedClass)
    
    return matchesSearch && matchesSubject && matchesClass
  })

  function openDeleteModal(material: Material) {
    setDeleteModal({ isOpen: true, material, status: 'confirm' })
  }

  function closeDeleteModal() {
    setDeleteModal({ isOpen: false, material: null, status: 'confirm' })
  }

  async function confirmDelete() {
    if (!deleteModal.material) return
    
    setDeleteModal(prev => ({ ...prev, status: 'loading' }))
    
    const result = await deleteMaterial(deleteModal.material.id)
    
    if (result.success) {
      setDeleteModal(prev => ({ ...prev, status: 'success' }))
      setTimeout(() => {
        closeDeleteModal()
      }, 1500)
    } else {
      setDeleteModal(prev => ({ ...prev, status: 'error', errorMessage: result.error }))
    }
  }

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Materialien durchsuchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        
        <select
          value={selectedSubject || ''}
          onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : null)}
          className="px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Alle Fächer</option>
          {subjects.map(subject => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
        <span>{filteredMaterials.length} Materialien</span>
        <span>•</span>
        <span>{filteredMaterials.filter(m => !m.is_link).reduce((acc, m) => acc + m.download_count, 0)} Downloads</span>
        <span>•</span>
        <span>{filteredMaterials.filter(m => m.is_link).reduce((acc, m) => acc + m.download_count, 0)} Link-Aufrufe</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Material</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Fach</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Klassen</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Grösse</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Aktivität</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground text-sm">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Keine Materialien für {selectedClass ?? 'diese Auswahl'} vorhanden.
                  </td>
                </tr>
              ) : filteredMaterials.map((material) => (
                <tr key={material.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${material.is_link ? 'bg-muted/30' : 'bg-muted/50'} flex items-center justify-center w-10 h-10`}>
                        {material.is_link && material.file_url ? (
                          isYouTubeUrl(material.file_url) ? (
                            // YouTube specific icon
                            <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                          ) : (
                            // Generic favicon for other links
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                              src={getFaviconUrl(material.file_url)} 
                              alt="" 
                              className="w-5 h-5 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )
                        ) : (
                          getFileIcon(material.file_type, material.is_link)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{material.name}</p>
                          {material.is_link && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary">
                              <LinkIcon className="w-3 h-3" />
                              Link
                            </span>
                          )}
                        </div>
                        {material.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{material.description}</p>
                        )}
                        {material.is_link && material.file_url && (
                          <p className="text-xs text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                            <ExternalLink className="w-3 h-3" />
                            {new URL(material.file_url).hostname.replace('www.', '')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-foreground">
                      {material.subjects?.name || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-foreground">
                      {material.class_levels?.join(', ') || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-muted-foreground">
                      {material.is_link ? '–' : formatFileSize(material.file_size)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-foreground flex items-center gap-1">
                      {material.is_link ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          {material.download_count} Aufrufe
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          {material.download_count}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      material.is_public 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {material.is_public ? 'Öffentlich' : 'Entwurf'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      {material.file_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => window.open(material.file_url!, '_blank')}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuItem 
                          href={`/dashboard/materialien/${material.id}/bearbeiten`}
                          icon={<Pencil className="w-4 h-4" />}
                        >
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => openDeleteModal(material)}
                          variant="destructive"
                          icon={<Trash2 className="w-4 h-4" />}
                        >
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.material && (
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
                  Material löschen?
                </h2>
                <p className="text-muted-foreground mb-2">
                  Möchtest du dieses Material wirklich löschen?
                </p>
                <div className="bg-muted/50 rounded-xl p-4 mb-6">
                  <p className="font-medium text-foreground">
                    {deleteModal.material.name}
                  </p>
                  {deleteModal.material.subjects?.name && (
                    <p className="text-sm text-muted-foreground">{deleteModal.material.subjects.name}</p>
                  )}
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
                <p className="text-muted-foreground">
                  Das Material wurde entfernt.
                </p>
              </div>
            )}

            {/* Error State */}
            {deleteModal.status === 'error' && (
              <div className="p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Fehler beim Löschen
                </h2>
                <p className="text-muted-foreground mb-6">
                  {deleteModal.errorMessage || 'Ein unbekannter Fehler ist aufgetreten.'}
                </p>
                <Button 
                  variant="outline" 
                  onClick={closeDeleteModal}
                  className="rounded-xl"
                >
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
