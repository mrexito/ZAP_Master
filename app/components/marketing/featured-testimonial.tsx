import type { Testimonial } from '@/types/marketing'

interface FeaturedTestimonialProps {
  testimonial: Testimonial
}

// Einzelnes grosses Zitat -- andere Darstellung als die 3er-Grid-Testimonials-Komponente aus
// Schritt 6, kein Wrapper darum.
function FeaturedTestimonial({ testimonial }: FeaturedTestimonialProps) {
  return (
    <figure className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
      <blockquote className="font-serif text-lg leading-snug text-foreground md:text-xl">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="font-mono text-sm text-muted-foreground">
        {testimonial.author}
        {testimonial.role ? ` — ${testimonial.role}` : null}
      </figcaption>
    </figure>
  )
}

export { FeaturedTestimonial }
