import type { CourseOffer } from '@/types/marketing'
import { ResponsiveGrid } from '@/app/components/layout/responsive-grid'
import { CourseCard } from '@/app/components/kurse/course-card'

interface CourseCardGridProps {
  offers: CourseOffer[]
}

function CourseCardGrid({ offers }: CourseCardGridProps) {
  return (
    <ResponsiveGrid columns={{ base: 1, md: 2 }}>
      {offers.map((offer, index) => (
        <CourseCard key={offer.id} offer={offer} index={index} />
      ))}
    </ResponsiveGrid>
  )
}

export { CourseCardGrid }
