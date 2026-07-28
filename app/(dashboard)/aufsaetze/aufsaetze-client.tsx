'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatFileSize, formatDateTime as formatDate } from '@/lib/utils/format'
import {
  Upload, FileText, Clock, CheckCircle2, AlertCircle,
  Trash2, Download, Send, Pencil, X, Loader2, FileUp, ChevronDown
} from 'lucide-react'
import dynamic from 'next/dynamic'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  createSignedUploadUrl, saveEssayMetadata, getMyEssays,
  submitEssay, deleteEssay, getEssayDownloadUrl, getReleasedAiCorrections,
  type Essay
} from './actions'

const SUBJECTS = [
  'Deutsch',
  'Mathematik',
  'Französisch',
  'Englisch',
  'NMG',
  'Andere'
]

const STATUS_CONFIG = {
  draft: { label: 'Entwurf', icon: Pencil, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30' },
  submitted: { label: 'Eingereicht', icon: Clock, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  in_korrektur: { label: 'In Korrektur', icon: Pencil, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' },
  reviewed: { label: 'Bewertet', icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  returned: { label: 'Zurückgegeben', icon: AlertCircle, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' }
}

export function AufsaetzeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const openedFromDashboard = searchParams.get('neu') === '1'
  const [essays, setEssays] = useState<Essay[]>([])
  const [aiCorrections, setAiCorrections] = useState<Record<string, string>>({})
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showUploadForm, setShowUploadForm] = useState(openedFromDashboard)
  
  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitImmediately, setSubmitImmediately] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  
  // Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const closeUploadForm = () => {
    setShowUploadForm(false)
    setUploadFile(null)
    setUploadError('')
    if (openedFromDashboard) {
      router.replace('/aufsaetze', { scroll: false })
    }
  }

  const loadEssays = useCallback(async () => {
    const [essayResult, aiResult] = await Promise.all([
      getMyEssays(),
      getReleasedAiCorrections(),
    ])
    if (essayResult.success && essayResult.data) setEssays(essayResult.data)
    if (aiResult.success && aiResult.data) setAiCorrections(aiResult.data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadEssays()
  }, [loadEssays])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setUploadError('')
    
    if (!file) return
    
    // Client-side Validierung
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Nur PDF und Word-Dokumente erlaubt.')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Datei zu gross (max. 10MB).')
      return
    }
    
    setUploadFile(file)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || !title || !subject) return
    
    setIsUploading(true)
    setUploadProgress(0)
    setUploadError('')
    
    try {
      // Schritt 4: Signed URL holen
      setUploadProgress(10)
      const urlResult = await createSignedUploadUrl(
        uploadFile.name,
        uploadFile.type,
        uploadFile.size
      )
      
      if (!urlResult.success) {
        throw new Error('error' in urlResult ? urlResult.error : 'Konnte Upload-URL nicht erstellen.')
      }
      
      if (!urlResult.data) {
        throw new Error('Keine Upload-URL erhalten.')
      }
      
      // Schritt 5: Direkter Upload zum Storage
      setUploadProgress(30)
      const uploadResponse = await fetch(urlResult.data.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': uploadFile.type,
        },
        body: uploadFile
      })
      
      if (!uploadResponse.ok) {
        throw new Error('Upload fehlgeschlagen.')
      }
      
      setUploadProgress(70)
      
      // Schritt 6: Metadaten speichern
      const metaResult = await saveEssayMetadata(
        urlResult.data.path,
        uploadFile.name,
        uploadFile.size,
        uploadFile.type,
        title,
        subject,
        description,
        submitImmediately
      )
      
      if (!metaResult.success) {
        throw new Error(metaResult.error || 'Metadaten konnten nicht gespeichert werden.')
      }
      
      setUploadProgress(100)
      
      // Reset Form
      setUploadFile(null)
      setTitle('')
      setSubject('')
      setDescription('')
      setSubmitImmediately(false)
      closeUploadForm()
      
      // Refresh Liste
      await loadEssays()
      
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (essayId: string) => {
    setActionLoading(essayId)
    const result = await submitEssay(essayId)
    if (result.success) {
      await loadEssays()
    }
    setActionLoading(null)
  }

  const handleDelete = async (essayId: string) => {
    if (!confirm('Möchtest du diesen Entwurf wirklich löschen?')) return
    
    setActionLoading(essayId)
    const result = await deleteEssay(essayId)
    if (result.success) {
      await loadEssays()
    }
    setActionLoading(null)
  }

  const handleDownload = async (essayId: string) => {
    setActionLoading(essayId)
    const result = await getEssayDownloadUrl(essayId)
    if (result.success && result.data) {
      window.open(result.data, '_blank')
    }
    setActionLoading(null)
  }


  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        {/* Cards Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Meine Aufsätze</h1>
          </div>
          <p className="text-muted-foreground">
            Schreibe und verbessere deine Aufsätze mit KI-Unterstützung.
          </p>
        </div>
        {!showUploadForm && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shrink-0"
          >
            <Upload className="w-4 h-4" />
            Neuer Aufsatz
          </button>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Neuen Aufsatz hochladen</h2>
            <button
              onClick={closeUploadForm}
              aria-label="Uploadformular schliessen"
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleUpload} className="space-y-4">
            {/* Datei Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Datei auswählen *
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="file-upload"
                  className={`
                    flex flex-col items-center justify-center w-full h-32 
                    border-2 border-dashed rounded-lg cursor-pointer
                    transition-colors
                    ${uploadFile 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                >
                  {uploadFile ? (
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-primary" />
                      <div>
                        <p className="font-medium">{uploadFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(uploadFile.size)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <FileUp className="w-10 h-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        PDF oder Word-Dokument (max. 10MB)
                      </p>
                    </>
                  )}
                </label>
              </div>
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            {/* Titel */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Erlebniserzählung - Mein Abenteuer"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
                disabled={isUploading}
              />
            </div>

            {/* Fach */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Fach *
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
                disabled={isUploading}
              >
                <option value="">Fach auswählen</option>
                {SUBJECTS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Beschreibung */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Beschreibung (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Notizen oder Anmerkungen..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-20"
                disabled={isUploading}
              />
            </div>

            {/* Sofort einreichen */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="submit-immediately"
                checked={submitImmediately}
                onChange={(e) => setSubmitImmediately(e.target.checked)}
                className="w-4 h-4 rounded border-border"
                disabled={isUploading}
              />
              <label htmlFor="submit-immediately" className="text-sm">
                Direkt einreichen (sonst als Entwurf speichern)
              </label>
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={!uploadFile || !title || !subject || isUploading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird hochgeladen...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {submitImmediately ? 'Hochladen & Einreichen' : 'Als Entwurf speichern'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={closeUploadForm}
                disabled={isUploading}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Essays List */}
      {essays.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Noch keine Aufsätze</h3>
          <p className="text-muted-foreground mb-4">
            Lade deinen ersten Aufsatz hoch, um zu beginnen.
          </p>
          {!showUploadForm && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Aufsatz hochladen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {essays.map(essay => {
            const status = STATUS_CONFIG[essay.status]
            const StatusIcon = status.icon
            const isProcessing = actionLoading === essay.id
            
            return (
              <div
                key={essay.id}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {essay.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span>{essay.subject}</span>
                        <span>•</span>
                        <span>{essay.file_name}</span>
                        <span>•</span>
                        <span>{formatFileSize(essay.file_size)}</span>
                      </div>
                      {essay.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {essay.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Erstellt: {formatDate(essay.created_at)}
                      </p>
                      
                      {/* Feedback Accordion */}
                      {(essay.feedback || aiCorrections[essay.id]) && (
                        <div className="mt-3 border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedFeedback(expandedFeedback === essay.id ? null : essay.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-sm font-medium">Feedback</span>
                              {essay.grade && (
                                <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-semibold shrink-0">
                                  Note: {essay.grade}
                                </span>
                              )}
                              {expandedFeedback !== essay.id && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {(essay.feedback ?? aiCorrections[essay.id]).replace(/[#*_`]/g, '').split('\n').find(l => l.trim()) ?? ''}
                                </span>
                              )}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-2 ${expandedFeedback === essay.id ? 'rotate-180' : ''}`} />
                          </button>
                          {expandedFeedback === essay.id && (
                            <div className="px-4 py-4 border-t border-border">
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{essay.feedback ?? aiCorrections[essay.id]}</ReactMarkdown>
                              </div>
                              {essay.grade && (
                                <p className="text-sm font-semibold mt-4 pt-3 border-t border-border">
                                  Note: {essay.grade}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Status & Actions */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    {/* Status Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Download */}
                      <button
                        onClick={() => handleDownload(essay.id)}
                        disabled={isProcessing}
                        className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                        title="Herunterladen"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      
                      {/* Nur für Entwürfe: Einreichen & Löschen */}
                      {essay.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleSubmit(essay.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            title="Einreichen"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Einreichen
                          </button>
                          <button
                            onClick={() => handleDelete(essay.id)}
                            disabled={isProcessing}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors disabled:opacity-50"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
