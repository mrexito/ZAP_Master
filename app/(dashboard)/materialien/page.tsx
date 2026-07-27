import { Suspense } from 'react'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { MaterialienListe } from './materialien-liste'


export default async function LernmaterialienPage() {
  const session = await auth()

  if (!session?.user?.id || !session.supabaseAccessToken) {
    redirect('/login')
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Statische Shell */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Lernmaterialien</h1>
        </div>
        <p className="text-muted-foreground">
          Finde Arbeitsblätter, Übungen und Lernhilfen für deine Prüfungsvorbereitung
        </p>
      </div>

      <Suspense fallback={<MaterialienSkeleton />}>
        <MaterialienListe token={session.supabaseAccessToken} />
      </Suspense>
    </div>
  )
}

function MaterialienSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}
