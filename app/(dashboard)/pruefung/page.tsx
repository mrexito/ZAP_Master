import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Calculator,
  CheckCircle2,
  Clock3,
  Sparkles,
} from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { PruefungsButtons } from './pruefungs-buttons'

export default async function PruefungPage() {
  const session = await auth()

  if (!session?.user?.id || !session.supabaseAccessToken) {
    redirect('/login')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-4 sm:p-6 lg:p-8">
      <header className="relative isolate overflow-hidden rounded-3xl border border-border bg-white shadow-sm dark:bg-slate-950">
        <Image
          src="/pruefung.webp"
          alt=""
          fill={true}
          sizes="(max-width: 768px) 100vw, 1152px"
          className="object-cover object-center opacity-[0.02]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/[0.98] to-white/[0.94] dark:from-slate-950 dark:via-slate-950/[0.98] dark:to-slate-950/[0.94]" />

        <div className="relative max-w-4xl px-6 py-12 text-[#16233F] sm:px-10 sm:py-16 lg:py-20 dark:text-white">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-lg font-semibold text-[#16233F] shadow-sm backdrop-blur-sm sm:text-xl dark:border-slate-700 dark:bg-slate-950/90 dark:text-white">
            <Sparkles className="size-4 text-amber-600 dark:text-amber-400" />
            Lernen · Simulationsprüfung
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-[#16233F] sm:text-6xl lg:text-7xl dark:text-white">
            Sicherer werden, bevor es zählt
          </h1>
          <p className="mt-6 max-w-3xl text-xl font-semibold leading-8 text-[#16233F] sm:text-2xl sm:leading-10 dark:text-slate-100">
            Trainiere eine vollständige Prüfung unter realistischen Bedingungen.
            Zeitlimit, Aufgabenfolge und Auswertung helfen dir, deinen aktuellen
            Stand zuverlässig einzuschätzen.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 text-lg font-semibold sm:text-xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2.5 text-[#16233F] shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-white">
              <Clock3 className="size-5 text-primary" />
              60 Minuten
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-4 py-2.5 text-[#16233F] shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/90 dark:text-white">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              Direkte Auswertung
            </span>
          </div>
        </div>
      </header>

      <section aria-labelledby="subject-selection-heading" className="space-y-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Prüfung auswählen
          </p>
          <h2
            id="subject-selection-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Welches Fach möchtest du simulieren?
          </h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            Mathematik ist bereits verfügbar. Die deutsche Simulationsprüfung wird
            als nächster Prüfungsbereich vorbereitet.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden border-primary/30 py-0 shadow-md">
            <div className="h-1.5 bg-primary" />
            <CardHeader className="px-6 pt-6 sm:px-8 sm:pt-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Calculator className="size-6" />
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  Verfügbar
                </span>
              </div>
              <CardTitle className="mt-4 text-2xl">Mathematik</CardTitle>
              <CardDescription className="text-base leading-6">
                Eine vollständige ZAP-Mathematikprüfung mit festem Zeitlimit und
                anschließender Auswertung deiner Antworten.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 sm:px-8">
              <div className="mb-6 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="rounded-lg bg-muted px-3 py-1.5">60 Minuten</span>
                <span className="rounded-lg bg-muted px-3 py-1.5">ZAP-Format</span>
                <span className="rounded-lg bg-muted px-3 py-1.5">Sofortige Resultate</span>
              </div>

              <Suspense fallback={<PruefungsButtonsSkeleton />}>
                <PruefungsButtons
                  userId={session.user.id}
                  token={session.supabaseAccessToken}
                />
              </Suspense>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-dashed py-0">
            <div className="h-1.5 bg-amber-400" />
            <CardHeader className="px-6 pt-6 sm:px-8 sm:pt-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <BookOpen className="size-6" />
                </div>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  In Vorbereitung
                </span>
              </div>
              <CardTitle className="mt-4 text-2xl">Deutsch</CardTitle>
              <CardDescription className="text-base leading-6">
                Eine eigenständige Deutsch-Simulationsprüfung mit Sprachprüfung,
                Textverständnis und einem realistischen Aufsatzteil.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 sm:px-8">
              <div className="mb-6 flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="rounded-lg bg-muted px-3 py-1.5">Sprachprüfung</span>
                <span className="rounded-lg bg-muted px-3 py-1.5">Textverständnis</span>
                <span className="rounded-lg bg-muted px-3 py-1.5">Aufsatz</span>
              </div>

              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full"
                disabled
              >
                <BookOpen />
                Deutsche Simulationsprüfung – bald verfügbar
              </Button>
            </CardContent>
            <CardFooter className="border-t bg-muted/30 px-6 py-4 text-sm text-muted-foreground sm:px-8">
              Der Button wird freigeschaltet, sobald die Prüfung vollständig
              hinterlegt und getestet ist.
            </CardFooter>
          </Card>
        </div>
      </section>

      <aside className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="font-semibold text-foreground">
            Du möchtest heute schon Deutsch-Prüfungen üben?
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Im Prüfungstrainer findest du vorhandene Deutsch-Prüfungen ohne
            Simulationsmodus.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/trainer?subject=German">
            Zum Prüfungstrainer
            <ArrowRight />
          </Link>
        </Button>
      </aside>
    </div>
  )
}

function PruefungsButtonsSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}
