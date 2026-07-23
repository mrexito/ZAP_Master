import type { ReactNode } from 'react'
import type { AudienceHeroContent } from '@/types/marketing'
import { PageIntro } from '@/app/components/layout/page-intro'

interface AudienceHeroProps {
  content: AudienceHeroContent
}

// design-reference (Layout_4_Klasse_Hauptseite.html, .section-head p): der Hero-Text bricht
// bewusst am Gedankenstrich um ("... festigen —<br>im wöchentlichen Rhythmus ..."), nicht am
// natürlichen Zeilenumbruch. Generischer Split statt Fixture-Daten mit eingebettetem <br>, damit
// die Beschreibung als reiner Text (Metadata, SEO) nutzbar bleibt.
function breakAtDash(text: string): ReactNode {
  const parts = text.split(' — ')
  if (parts.length !== 2) return text
  const [before, after] = parts
  return (
    <>
      {before} —<br />
      {after}
    </>
  )
}

function AudienceHero({ content }: AudienceHeroProps) {
  return (
    <PageIntro
      eyebrow={content.eyebrow}
      title={content.title}
      description={breakAtDash(content.description)}
      align="center"
      className="mx-auto"
    />
  )
}

export { AudienceHero }
