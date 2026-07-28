import { Suspense } from 'react'
import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DashboardData } from './dashboard-data'


export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id || !session.supabaseAccessToken) {
    redirect('/login')
  }

  const firstName = session.user.name?.split(' ')[0] || 'Lernende/r'

  return (
    <div className="p-6 lg:p-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData
          userId={session.user.id}
          token={session.supabaseAccessToken}
          firstName={firstName}
          isStudent={session.user.role === 'user'}
        />
      </Suspense>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      {/* Welcome Header Skeleton */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-2xl" />
        ))}
      </div>

      {/* Subject Overview Skeleton */}
      <Skeleton className="h-[180px] rounded-2xl" />
    </>
  )
}
