'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  X, 
  Loader2,
  BookOpen,
  Check,
  Link as LinkIcon,
  Globe,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { createAuthenticatedBrowserClient } from '@/lib/supabase/client'
import { createMaterial, getSubjects } from '../actions'
import { useClassFilter } from '@/context/ClassFilterContext'
import { CLASS_LEVELS } from '@/lib/class-levels'

const materialTypes = [
  { value: 'document', label: 'Dokument (PDF, Word)' },
  { value: 'worksheet', label: 'Arbeitsblatt' },
  { value: 'exercise', label: 'Übung' },
  { value: 'test', label: 'Test / Prüfung' },
  { value: 'solution', label: 'Lösung' },
  { value: 'summary', label: 'Zusammenfassung' },
  { value: 'video', label: 'Video' },
  { value: 'link', label: 'Link / Lesezeichen' },
  { value: 'other', label: 'Sonstiges' },
]

type UploadMode = 'file' | 'link'

interface Subject {
  id: number
  name: string
}

// Link Preview Component (Notion-style Bookmark)
function LinkPreview({ url, onRemove }: { url: string; onRemove: () => void }) {
  const [loading, setLoading] = useState(true)
  const [metadata, setMetadata] = useState<{
    title?: string
    description?: string
    image?: string
    favicon?: string
    domain?: string
  }>({})

  useEffect(() => {
    async function fetchMetadata() {
      try {
        // Extract domain for display
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace('www.', '')
        
        setMetadata({
          title: domain,
          domain: domain,
          favicon: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
        })
        setLoading(false)
      } catch {
        setLoading(false)
      }
    }
    fetchMetadata()
  }, [url])

  if (loading) {
    return (
      <div className="border border-border rounded-xl p-4 animate-pulse">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-muted rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors bg-card">
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex gap-4 p-4"
      >
        {/* Favicon / Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
          {metadata.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={metadata.favicon} 
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
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-foreground truncate flex items-center gap-2">
            {metadata.title || url}
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </h4>
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {url}
          </p>
          {metadata.domain && (
            <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
              <LinkIcon className="w-3 h-3" />
              {metadata.domain}
            </p>
          )}
        </div>
      </a>
      
      {/* Remove Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onRemove()
        }}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  )
}

export default function NeuMaterialPage() {
  const router = useRouter()
  const { supabaseAccessToken } = useAuthStore()
  const { selectedClass } = useClassFilter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = useMemo(
    () => supabaseAccessToken ? createAuthenticatedBrowserClient(supabaseAccessToken) : null,
    [supabaseAccessToken]
  )
  
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [type, setType] = useState('document')
  const [selectedClassLevels, setSelectedClassLevels] = useState<string[]>([])
  
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // Link mode states
  const [uploadMode, setUploadMode] = useState<UploadMode>('file')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkUrlValid, setLinkUrlValid] = useState(false)

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      setSelectedClassLevels([selectedClass])
    }
  }, [selectedClass])

  async function loadSubjects() {
    const result = await getSubjects()
    if (result.success && result.data) {
      setSubjects(result.data)
    }
  }

  // Validate URL
  function validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  function handleLinkChange(url: string) {
    setLinkUrl(url)
    const isValid = validateUrl(url)
    setLinkUrlValid(isValid)
    
    // Auto-set type to link when adding a URL
    if (isValid && type !== 'link') {
      setType('link')
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Max 50MB
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('Datei zu gross. Maximum ist 50MB.')
        return
      }
      setFile(selectedFile)
      
      // Auto-fill name if empty
      if (!name) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, '')
        setName(fileName)
      }
    }
  }

  async function uploadFile() {
    if (!file || !supabase) return null
    
    setUploading(true)
    setUploadProgress(0)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `materials/${fileName}`
      
      const { error } = await supabase.storage
        .from('lernmaterialien')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })
      
      if (error) throw error
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('lernmaterialien')
        .getPublicUrl(filePath)
      
      setUploadProgress(100)
      return urlData.publicUrl
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Fehler beim Hochladen der Datei')
      return null
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Upload file first
      let uploadedUrl = fileUrl
      if (file && !fileUrl) {
        uploadedUrl = await uploadFile()
        if (!uploadedUrl) {
          setLoading(false)
          return
        }
        setFileUrl(uploadedUrl)
      }
      
      // Create material
      const formData = new FormData()
      formData.append('name', name)
      formData.append('description', description)
      formData.append('subject_id', subjectId)
      formData.append('type', type)
      selectedClassLevels.forEach(level => formData.append('class_levels', level))
      
      // Handle file upload or link
      if (uploadMode === 'link' && linkUrlValid) {
        formData.append('file_url', linkUrl)
        formData.append('is_link', 'true')
      } else if (uploadedUrl) {
        formData.append('file_url', uploadedUrl)
      }
      
      if (file) {
        formData.append('file_size', file.size.toString())
        formData.append('file_type', file.type)
      }
      
      const result = await createMaterial(formData)
      
      if (!result.success) {
        toast.error(result.error || 'Fehler beim Speichern')
        return
      }
      
      router.push('/dashboard/materialien')
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Ein Fehler ist aufgetreten')
    } finally {
      setLoading(false)
    }
  }

  function toggleClassLevel(level: string) {
    setSelectedClassLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/dashboard/materialien"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Neues Lernmaterial</h1>
            <p className="text-muted-foreground">Lade ein neues Lernmaterial hoch</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - File/Link Upload */}
          <div className="space-y-6">
            {/* Upload Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Was möchtest du hinzufügen?
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    uploadMode === 'file'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Datei hochladen
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('link')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    uploadMode === 'link'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  Link hinzufügen
                </button>
              </div>
            </div>

            {/* File Upload */}
            {uploadMode === 'file' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Datei
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    file 
                      ? 'border-primary/50 bg-primary/5' 
                      : 'border-border hover:border-primary/30 hover:bg-muted/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.mp4,.mp3"
                  />
                  
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-foreground">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                          setFileUrl(null)
                        }}
                        className="p-1 hover:bg-muted rounded-lg"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium mb-1">
                        Klicke hier oder ziehe eine Datei hinein
                      </p>
                      <p className="text-sm text-muted-foreground">
                        PDF, Word, Excel, PowerPoint, Bilder oder Videos (max. 50MB)
                      </p>
                    </>
                  )}
                  
                  {uploading && (
                    <div className="mt-4">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Wird hochgeladen... {uploadProgress}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Link Input */}
            {uploadMode === 'link' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => handleLinkChange(e.target.value)}
                      placeholder="https://example.com/resource"
                      className={`w-full pl-11 pr-4 py-3 rounded-xl border bg-background focus:outline-none focus:ring-2 transition-colors ${
                        linkUrl && !linkUrlValid 
                          ? 'border-destructive focus:ring-destructive/20'
                          : linkUrlValid
                          ? 'border-primary/50 focus:ring-primary/20'
                          : 'border-border focus:ring-primary/20'
                      }`}
                    />
                  </div>
                  {linkUrl && !linkUrlValid && (
                    <p className="text-sm text-destructive mt-1">
                      Bitte gib eine gültige URL ein (https://...)
                    </p>
                  )}
                </div>

                {/* Link Preview (Notion-style Bookmark) */}
                {linkUrlValid && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Vorschau
                    </label>
                    <LinkPreview 
                      url={linkUrl} 
                      onRemove={() => {
                        setLinkUrl('')
                        setLinkUrlValid(false)
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Mathematik Übungsblatt Algebra"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Beschreibung
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung des Materials..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            {/* Subject & Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Fach *
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="">Fach wählen</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Materialtyp
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {materialTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Class Levels */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Klassenstufen
              </label>
              <div className="flex flex-wrap gap-2">
                {CLASS_LEVELS.map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleClassLevel(level)}
                    aria-pressed={selectedClassLevels.includes(level)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      selectedClassLevels.includes(level)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30'
                    }`}
                  >
                    {selectedClassLevels.includes(level) && (
                      <Check className="w-4 h-4 inline mr-2" />
                    )}
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Full Width */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button
            type="submit"
            disabled={loading || uploading || !name || !subjectId || selectedClassLevels.length === 0 || (uploadMode === 'link' && !linkUrlValid && !file)}
            className="rounded-xl"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Speichern...
              </>
            ) : (
              'Material speichern'
            )}
          </Button>
          <Link href="/dashboard/materialien">
            <Button type="button" variant="outline" className="rounded-xl">
              Abbrechen
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
