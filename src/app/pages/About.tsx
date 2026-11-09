import { ButtonLink, Container, Reveal } from '../components/ui'
import { useCatalogue } from '../lib/catalogue'

export function About() {
  const { products } = useCatalogue()

  return (
    <Container className="pt-10 sm:pt-16">
      <div className="max-w-3xl">
        <p className="text-[14px] text-muted">L’écurie</p>
        <h1 className="font-display mt-3 text-balance text-[48px] leading-[1] sm:text-[72px]">Des fiches complètes, et un avis quand vous le demandez</h1>
      </div>
      <Reveal className="image-frame mt-12 aspect-[16/9] rounded-[32px]">
        <img src="/images/lookbook.jpg" alt="Un cavalier panse son cheval dans une écurie" className="size-full object-cover" />
      </Reveal>
      <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <p className="font-display text-[32px] leading-[1.1]">Le marché du cheval est vaste et bavard. Notre travail, c’est de le rendre lisible.</p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-5 text-[17px] leading-relaxed text-muted">
          <p>
            Chaque fiche réunit ce qui compte pour choisir : race, sexe, âge, taille, discipline, prix et département, avec une photo du cheval. Pas de liste interminable, pas de fiche vide.
          </p>
          <p>
            Ce qui n’est pas écrit, on le demande avant la visite : papiers, vidéos, historique de concours, conditions de transport. Vous arrivez à l’écurie en sachant à quoi vous attendre.
          </p>
          <p>
            Si vous voulez un avis, une visite accompagnée ou simplement comprendre pourquoi deux chevaux au même prix ne se valent pas, laissez-nous vos coordonnées depuis une fiche : on répond sous 24 h ouvrées.
          </p>
          <ButtonLink to="/shop" className="mt-2 self-start">
            Voir le catalogue
          </ButtonLink>
        </Reveal>
      </div>
      <dl className="mt-20 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {[
          ['Annonces en ligne', String(products.length)],
          ['Départements', String(new Set(products.map((p) => p.place).filter(Boolean)).size)],
          ['Réponse', '24 h'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[14px] text-muted">{label}</dt>
            <dd className="font-display mt-2 text-[48px] leading-none">{value}</dd>
          </div>
        ))}
      </dl>
    </Container>
  )
}
