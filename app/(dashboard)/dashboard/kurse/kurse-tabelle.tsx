'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react'
import { type KursDBMitAnmeldungen } from '@/types/kurs-form'
import { groupKurseNachKlasseUndKurstyp, getSchulKategorie, type SchulKategorie } from '@/lib/kurse/mapper'
import { deleteKurs, toggleKursStatus } from './actions'
import { DropdownMenuComplex, DropdownMenuSeparator } from '@/app/components/ui/dropdown-menu'

const SPALTEN_ANZAHL = 8

const KATEGORIE_FILTER: { value: SchulKategorie | 'alle'; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'primar', label: 'Primarschule' },
  { value: 'sek', label: 'Sekundarschule' },
  { value: 'weiterfuehrend', label: 'BMS und Matura' },
]

interface KurseTabelleProps {
  kurse: KursDBMitAnmeldungen[]
}

export function KurseTabelle({ kurse }: KurseTabelleProps) {
  const [kategorieFilter, setKategorieFilter] = useState<SchulKategorie | 'alle'>('alle')

  const gefilterteKurse =
    kategorieFilter === 'alle'
      ? kurse
      : kurse.filter((kurs) => getSchulKategorie(kurs.klassenstufen) === kategorieFilter)

  const klasseGruppen = groupKurseNachKlasseUndKurstyp(gefilterteKurse)

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap gap-2 p-4 border-b border-border">
        {KATEGORIE_FILTER.map((option) => (
          <button
            key={option.value}
            onClick={() => setKategorieFilter(option.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              kategorieFilter === option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Kurs</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Standort</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Klasse</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Datum</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Teilnehmer</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Preis</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {klasseGruppen.map((klasseGruppe) => (
              <Fragment key={klasseGruppe.label}>
                <tr className="bg-muted/50">
                  <td
                    colSpan={SPALTEN_ANZAHL}
                    className="px-4 py-2 text-sm font-semibold text-foreground"
                  >
                    {klasseGruppe.label}
                  </td>
                </tr>
                {klasseGruppe.kurstypGruppen.map((kurstypGruppe) => (
                  <Fragment key={`${klasseGruppe.label}-${kurstypGruppe.label}`}>
                    <tr>
                      <td
                        colSpan={SPALTEN_ANZAHL}
                        className="px-4 py-1.5 pl-6 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {kurstypGruppe.label}
                      </td>
                    </tr>
                    {kurstypGruppe.kurse.map((kurs) => (
                      <KursZeile key={kurs.id} kurs={kurs} />
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KursZeile({ kurs }: { kurs: KursDBMitAnmeldungen }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const formatDatum = (datum: string) => {
    return new Date(datum).toLocaleDateString('de-CH', {
      day: 'numeric',
      month: 'short',
    })
  }

  const handleDelete = async () => {
    if (!confirm(`Möchtest du den Kurs "${kurs.name}" wirklich löschen?`)) return
    
    setIsDeleting(true)
    const result = await deleteKurs(kurs.id)
    setIsDeleting(false)
    
    if (!result.success) {
      alert(result.error)
    }
    setIsMenuOpen(false)
  }

  const handleToggleStatus = async () => {
    setIsToggling(true)
    const result = await toggleKursStatus(kurs.id, !kurs.ist_aktiv)
    setIsToggling(false)
    
    if (!result.success) {
      alert(result.error)
    }
    setIsMenuOpen(false)
  }

  const statusBadge = () => {
    if (!kurs.ist_aktiv) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          Inaktiv
        </span>
      )
    }
    switch (kurs.status) {
      case 'offen':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Offen
          </span>
        )
      case 'wenige-plaetze':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Wenige Plätze
          </span>
        )
      case 'ausgebucht':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            Ausgebucht
          </span>
        )
    }
  }

  return (
    <tr className={`hover:bg-muted/30 transition-colors ${!kurs.ist_aktiv ? 'opacity-60' : ''}`}>
      {/* Kurs-Name */}
      <td className="px-4 py-3">
        <p className="font-medium text-foreground truncate max-w-62.5">{kurs.name}</p>
      </td>

      {/* Standort */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
          <MapPin className="h-4 w-4" />
          {kurs.ort}
        </div>
      </td>

      {/* Klasse */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {kurs.klassenstufen.length > 0 ? (
            kurs.klassenstufen.map((stufe) => (
              <span
                key={stufe}
                className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground whitespace-nowrap"
              >
                {stufe}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">–</span>
          )}
        </div>
      </td>

      {/* Datum */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {formatDatum(kurs.start_datum)} – {formatDatum(kurs.end_datum)}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
          <Clock className="h-4 w-4" />
          {kurs.uhrzeit}
        </div>
      </td>

      {/* Teilnehmer */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {kurs.aktuelle_teilnehmer}
          </span>
          <span className="text-muted-foreground">
            / {kurs.max_teilnehmer}
          </span>
        </div>
      </td>

      {/* Preis */}
      <td className="px-4 py-3">
        <span className="font-medium text-foreground">
          CHF {kurs.preis}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        {statusBadge()}
      </td>

      {/* Aktionen */}
      <td className="px-4 py-3 text-right">
        <DropdownMenuComplex
          trigger={<MoreVertical className="h-4 w-4 text-muted-foreground" />}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
          <div className="py-1">
            <Link
              href={`/dashboard/kurse/${kurs.id}`}
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              <Pencil className="h-4 w-4" />
              Bearbeiten
            </Link>
            
            <button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              {kurs.ist_aktiv ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Deaktivieren
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Aktivieren
                </>
              )}
            </button>

            <Link
              href="/kurse"
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              <ExternalLink className="h-4 w-4" />
              Vorschau
            </Link>

            <DropdownMenuSeparator />
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Wird gelöscht...' : 'Löschen'}
            </button>
          </div>
        </DropdownMenuComplex>
      </td>
    </tr>
  )
}
