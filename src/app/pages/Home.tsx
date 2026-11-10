import { motion } from 'motion/react'
import { ArrowRight, CalendarCheck, Camera, Euro } from 'lucide-react'
import { Link } from 'react-router'

import { categories } from '../../data/products'
import { useCatalogue } from '../lib/catalogue'
import { ProductCard } from '../components/ProductCard'
import { ButtonLink, Container, Reveal, SectionTitle } from '../components/ui'
import { money } from '../lib/cart'
import { categoryBlurbKey, categoryKey, useI18n } from '../lib/i18n'

const ease = [0.22, 1, 0.36, 1] as const

export function Home() {
  const { t } = useI18n()
  const { products } = useCatalogue()
  const featured = products.filter((p) => p.featured)
  const newArrivals = products.slice(0, 4)
  const lead = products[0]

  return (
    <>
      {/* Hero */}
      <section className="pt-10 sm:pt-16">
        <Container>
          <div className="grid items-end gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div className="pb-4">
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="text-[14px] text-muted">
                {t('home.eyebrow')}
              </motion.p>
              <h1 className="font-display mt-4 text-[56px] leading-[0.98] sm:text-[80px] lg:text-[96px]">
                {[t('home.title1'), t('home.titleWho')].map((line, i) => (
                  <span key={line} className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
                    <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease }}>
                      {i === 1 ? (
                        <>
                          {line} <em className="italic text-accent">{t('home.titleAccent')}</em>
                        </>
                      ) : (
                        line
                      )}
                    </motion.span>
                  </span>
                ))}
              </h1>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45, ease }} className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
                {t('home.intro')}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to="/shop?category=chevaux" size="lg" className="w-full sm:w-auto">
                  {t('home.ctaHorses')}
                  <ArrowRight />
                </ButtonLink>
                <ButtonLink to="/about" size="lg" variant="secondary" className="w-full sm:w-auto">
                  {t('home.ctaStables')}
                </ButtonLink>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.2, ease }}
              className="image-frame relative aspect-[4/3] rounded-[32px] lg:aspect-[5/4]"
            >
              <img src="/images/hero.jpg" alt={t('home.heroAlt')} className="size-full object-cover" fetchPriority="high" />
              {lead && (
                <Link
                  to={`/product/${lead.slug}`}
                  className="absolute bottom-4 left-4 flex items-center gap-3 rounded-[16px] bg-surface/90 py-2 pl-2 pr-4 text-[13px] shadow-soft backdrop-blur transition-colors hover:bg-surface"
                >
                  <span className="image-frame grid size-10 place-items-center rounded-[12px] bg-surface-2">
                    <span className="font-display text-[13px] leading-none text-muted">{lead.mark}</span>
                  </span>
                  <span>
                    <span className="block font-medium">{lead.name}</span>
                    <span className="text-muted">{money(lead.price)}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              )}
            </motion.div>
          </div>
        </Container>
      </section>

      {/* New arrivals */}
      <section className="pt-24 sm:pt-32">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow={t('home.newEyebrow')}
              title={t('home.newTitle')}
              action={
                <Link to="/shop" className="hidden items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg sm:inline-flex">
                  {t('home.seeAll')}
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {newArrivals.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} priority={i < 2} />
            ))}
          </div>
        </Container>
      </section>

      {/* Categories */}
      <section className="pt-24 sm:pt-32">
        <Container>
          <div className="grid gap-4 md:grid-cols-3 lg:gap-6">
            {categories.slice(0, 3).map((c, i) => (
              <Reveal key={c.key} delay={i * 0.08}>
                <Link to={`/shop?category=${c.key}`} className="group image-frame relative block aspect-[4/5] rounded-image">
                  <img src={c.image} alt={t(categoryKey(c.key))} className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between rounded-[18px] bg-surface/90 p-4 backdrop-blur">
                    <div>
                      <p className="font-display text-[28px] leading-none">{t(categoryKey(c.key))}</p>
                      <p className="mt-1.5 text-[13px] text-muted">{t(categoryBlurbKey(c.key))}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-[12px] bg-fg text-bg transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Editorial */}
      <section className="pt-24 sm:pt-32">
        <Container>
          <div className="grid items-center gap-10 rounded-[32px] bg-surface-2/60 p-5 sm:p-8 lg:grid-cols-2 lg:gap-16 lg:p-12">
            <Reveal className="image-frame aspect-[4/3] rounded-image">
              <img src="/images/lookbook.jpg" alt={t('home.editorialAlt')} className="size-full object-cover" loading="lazy" />
            </Reveal>
            <Reveal delay={0.1} className="lg:pr-8">
              <p className="text-[14px] text-muted">{t('home.editorialEyebrow')}</p>
              <h2 className="font-display mt-3 text-balance text-[40px] leading-[1.02] sm:text-[52px]">{t('home.editorialTitle')}</h2>
              <p className="mt-5 text-pretty text-[16px] leading-relaxed text-muted">{t('home.editorialBody')}</p>
              <ButtonLink to="/about" variant="secondary" className="mt-8">
                {t('home.editorialCta')}
              </ButtonLink>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Bestsellers */}
      <section className="pt-24 sm:pt-32">
        <Container>
          <Reveal>
            <SectionTitle eyebrow={t('home.favEyebrow')} title={t('home.favTitle')} />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-6">
            {featured.slice(0, 6).map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ButtonLink to="/shop" variant="secondary" size="lg">
              {t('home.allCatalogue')}
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Promises */}
      <section className="pt-24 sm:pt-32">
        <Container>
          <ul className="grid gap-4 border-y border-line py-10 sm:grid-cols-3">
            {[
              { icon: Camera, title: t('home.promise1Title'), body: t('home.promise1Body') },
              { icon: Euro, title: t('home.promise2Title'), body: t('home.promise2Body') },
              { icon: CalendarCheck, title: t('home.promise3Title'), body: t('home.promise3Body') },
            ].map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <li className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-fg">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-medium">{title}</p>
                    <p className="mt-0.5 text-[14px] text-muted">{body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>
    </>
  )
}
