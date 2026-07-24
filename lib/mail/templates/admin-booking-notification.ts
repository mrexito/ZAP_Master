import { FACH_LABELS, type Fach } from "@/types/kurs"
import { formatChfRappen } from "@/lib/pricing"

export interface AdminBookingNotificationData {
  adminEmails: string[]
  childFirstname: string
  childLastname: string
  childClassLevel: string
  childGender: string
  parentEmail: string
  parentPhone: string
  notes: string | null
  kursName: string
  fach: Fach
  startDatum: string
  endDatum: string
  uhrzeit: string
  ort: string
  bookedPriceRappen: number | null
  currency: string
  createdAt: string
}

export interface RenderedAdminMail {
  to: string[]
  subject: string
  text: string
  html: string
}

const GENDER_LABELS: Record<string, string> = {
  m: "Männlich",
  w: "Weiblich",
  d: "Divers",
}

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatZeitpunkt(datum: string): string {
  return new Date(datum).toLocaleString("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich",
  })
}

export function renderAdminBookingNotification(
  data: AdminBookingNotificationData
): RenderedAdminMail {
  const fachLabel = FACH_LABELS[data.fach] ?? data.fach
  const zeitraum = `${formatDatum(data.startDatum)} – ${formatDatum(data.endDatum)}`
  const preis =
    data.bookedPriceRappen != null && data.currency === "CHF"
      ? formatChfRappen(data.bookedPriceRappen)
      : "Nicht verfügbar"
  const geschlecht = GENDER_LABELS[data.childGender] ?? data.childGender
  const bemerkungen = data.notes?.trim() || "Keine"
  const subject = `Neue Kursanmeldung: ${data.childFirstname} ${data.childLastname} – ${data.kursName}`

  const text = [
    "Eine neue Kursanmeldung ist eingegangen.",
    "",
    `Eingegangen: ${formatZeitpunkt(data.createdAt)}`,
    "",
    "Kind",
    `Name: ${data.childFirstname} ${data.childLastname}`,
    `Klassenstufe: ${data.childClassLevel}`,
    `Geschlecht: ${geschlecht}`,
    "",
    "Kontakt der Eltern",
    `E-Mail: ${data.parentEmail}`,
    `Telefon: ${data.parentPhone}`,
    "",
    "Kurs",
    `Kurs: ${data.kursName}`,
    `Fach: ${fachLabel}`,
    `Zeitraum: ${zeitraum}`,
    `Zeit: ${data.uhrzeit}`,
    `Ort: ${data.ort}`,
    `Preis: ${preis}`,
    "",
    `Bemerkungen: ${bemerkungen}`,
  ].join("\n")

  const rows = [
    ["Eingegangen", formatZeitpunkt(data.createdAt)],
    ["Kind", `${data.childFirstname} ${data.childLastname}`],
    ["Klassenstufe", data.childClassLevel],
    ["Geschlecht", geschlecht],
    ["Eltern-E-Mail", data.parentEmail],
    ["Eltern-Telefon", data.parentPhone],
    ["Kurs", data.kursName],
    ["Fach", fachLabel],
    ["Zeitraum", zeitraum],
    ["Zeit", data.uhrzeit],
    ["Ort", data.ort],
    ["Preis", preis],
    ["Bemerkungen", bemerkungen],
  ]

  const html = `<!doctype html>
<html lang="de">
<body style="font-family: sans-serif; color: #16233F; max-width: 640px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 20px;">Neue Kursanmeldung</h1>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tbody>
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding: 6px 12px 6px 0; color: #3C4A68; vertical-align: top;">${escapeHtml(label)}</td><td style="padding: 6px 0;">${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`

  return { to: data.adminEmails, subject, text, html }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
