import { requireAdmin } from '@/lib/auth/guards'
import { CourseTypeOverview } from '@/app/(dashboard)/dashboard/kurse/course-type-overview'

export default async function VorkurseAdminOverviewPage() {
  await requireAdmin()

  return (
    <CourseTypeOverview
      courseType="halbjahreskurs"
      title="Vorkurse"
      description="Alle Vorkurs-Angebote und ihre aktuellen Durchführungen im Überblick."
      emptyLabel="Noch keine Vorkurs-Angebote vorhanden"
    />
  )
}
