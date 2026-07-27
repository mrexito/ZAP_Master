import { requireAdmin } from '@/lib/auth/guards'
import { CourseTypeOverview } from '@/app/(dashboard)/dashboard/kurse/course-type-overview'

export default async function IntensivkurseAdminOverviewPage() {
  await requireAdmin()

  return (
    <CourseTypeOverview
      courseType="intensivkurs"
      title="Intensivkurse"
      description="Alle Intensivkurs-Angebote und ihre aktuellen Durchführungen im Überblick."
      emptyLabel="Noch keine Intensivkurs-Angebote vorhanden"
    />
  )
}
