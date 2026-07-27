'use client'

import { useState } from 'react'
import { formatFileSize } from '@/lib/utils/format'
import {
  FileText,
  Download,
  Search,
  Filter,
  BookOpen,
  FileSpreadsheet,
  FileImage,
  Video,
  Music,
  File,
  Eye,
  ChevronDown,
  X,
  Globe,
  ExternalLink,
  Link as LinkIcon
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useClassFilter } from '@/context/ClassFilterContext'
import type { Material } from './materialien-liste'

interface Subject {
  id: number
  name: string
  thumbnail_url: string | null
}

interface Props {
  initialMaterials: Material[]
  subjects: Subject[]
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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function getFaviconUrl(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`
  } catch {
    return ''
  }
}

function isYouTubeUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h.includes('youtube.com') || h.includes('youtu.be')
  } catch {
    return false
  }
}

function isLinkMaterial(material: Material): boolean {
  if (material.is_link) return true
  if (material.type === 'link') return true
  if (material.file_url && !material.file_type && !material.file_size) {
    try {
      return !new URL(material.file_url).hostname.includes('supabase')
    } catch {
      return false
    }
  }
  return false
}


export function MaterialienClient({ initialMaterials, subjects }: Props) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const { selectedClass } = useClassFilter()

  async function handleDownload(material: Material) {
    if (!material.file_url) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('increment_material_view_count', { material_id: material.id })
    window.open(material.file_url, '_blank')
    setMaterials(prev => prev.map(m =>
      m.id === material.id ? { ...m, download_count: m.download_count + 1 } : m
    ))
  }

  async function handleLinkClick(material: Material) {
    if (!material.file_url) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('increment_material_view_count', { material_id: material.id })
    window.open(material.file_url, '_blank')
    setMaterials(prev => prev.map(m =>
      m.id === material.id ? { ...m, download_count: m.download_count + 1 } : m
    ))
  }

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = !searchTerm ||
      material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSubject = !selectedSubject || material.subject_id === selectedSubject
    const matchesClassLevel = !selectedClass || material.class_levels?.includes(selectedClass)
    return matchesSearch && matchesSubject && matchesClassLevel
  })

  const materialsBySubject = filteredMaterials.reduce((acc, material) => {
    const subjectName = material.subjects?.name || 'Sonstige'
    if (!acc[subjectName]) acc[subjectName] = []
    acc[subjectName].push(material)
    return acc
  }, {} as Record<string, Material[]>)

  const activeFilters = [selectedSubject && subjects.find(s => s.id === selectedSubject)?.name].filter(Boolean)

  return (
    <>
      {/* Search & Filter Bar */}
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

        <div className="relative">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
            {activeFilters.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {activeFilters.length}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </Button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card shadow-lg z-20 p-4">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="subject-filter" className="text-sm font-medium text-foreground mb-2 block">Fach</label>
                    <select
                      id="subject-filter"
                      value={selectedSubject || ''}
                      onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="">Alle Fächer</option>
                      {subjects.map(subject => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </div>
                  {activeFilters.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedSubject(null)}>
                      Filter zurücksetzen
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {selectedSubject && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
            {subjects.find(s => s.id === selectedSubject)?.name}
            <button onClick={() => setSelectedSubject(null)} aria-label="Fach-Filter entfernen">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Content */}
      {filteredMaterials.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {selectedClass ? `Keine Materialien für ${selectedClass}` : 'Keine Materialien gefunden'}
          </h3>
          <p className="text-muted-foreground">
            {searchTerm || activeFilters.length > 0
              ? 'Versuche andere Suchbegriffe oder Filter'
              : selectedClass
                ? 'Wähle oben eine andere Klassenstufe oder schau später wieder vorbei.'
                : 'Es wurden noch keine Lernmaterialien hochgeladen'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(materialsBySubject).map(([subjectName, subjectMaterials]) => (
            <div key={subjectName}>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full" />
                {subjectName}
                <span className="text-sm font-normal text-muted-foreground">
                  ({subjectMaterials.length} {subjectMaterials.length === 1 ? 'Material' : 'Materialien'})
                </span>
              </h2>

              <div className="grid gap-3">
                {subjectMaterials.map(material => {
                  const materialIsLink = isLinkMaterial(material)
                  const isYouTube = material.file_url ? isYouTubeUrl(material.file_url) : false

                  return materialIsLink ? (
                    <button
                      key={material.id}
                      onClick={() => handleLinkClick(material)}
                      className="group flex rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all text-left w-full"
                    >
                      <div className="flex-1 p-4 flex gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                          {isYouTube ? (
                            <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                          ) : material.file_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getFaviconUrl(material.file_url)}
                              alt=""
                              className="w-8 h-8 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <Globe className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground truncate">{material.name}</h3>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                          {material.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{material.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" />
                            <span>{material.file_url ? getDomain(material.file_url) : 'Link'}</span>
                          </span>
                          {material.class_levels && material.class_levels.length > 0 && (
                            <span className="text-foreground/70">{material.class_levels.join(', ')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center px-4 border-l border-border bg-muted/30">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          <Globe className="w-3 h-3" />
                          Link
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div
                      key={material.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all group"
                    >
                      <div className="p-3 rounded-lg bg-muted/50 shrink-0">
                        {getFileIcon(material.file_type, materialIsLink)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">{material.name}</h3>
                        {material.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{material.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{formatFileSize(material.file_size)}</span>
                          <span>•</span>
                          <span>{material.class_levels?.join(', ') || 'Alle Klassen'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {material.download_count} Downloads
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {material.file_url && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`${material.name} in neuem Tab öffnen`}
                              className="rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => window.open(material.file_url!, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg"
                              onClick={() => handleDownload(material)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
