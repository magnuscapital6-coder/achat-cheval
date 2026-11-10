import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import { isAnimal } from '../../data/products'
import { useCatalogue } from '../lib/catalogue'
import { ProductCard } from '../components/ProductCard'
import { Button, Container, Stepper } from '../components/ui'
import { VisitForm } from '../components/VisitForm'
import { money, useCart } from '../lib/cart'
import { cx } from '../lib/cx'
import { categoryKey, useI18n } from '../lib/i18n'

export function Product() {
  const { slug } = useParams()
  const { t } = useI18n()
  const { products, loading } = useCatalogue()
  const product = slug ? products.find((p) => p.slug === slug) : undefined
  const cart = useCart()
  const [option, setOption] = useState<string | undefined>(product?.options?.values[0])
  const [quantity, setQuantity] = useState(1)
  const [view, setView] = useState(0)
  const [added, setAdded] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const [visitOpen, setVisitOpen] = useState(false)

  useEffect(() => {
    setOption(product?.options?.values[0])
    setQuantity(1)
    setView(0)
    window.scrollTo({ top: 0 })
  }, [product])

  // Une visite par fiche et par session : un rechargement ou un retour depuis
  // la boutique ne gonfle pas le compteur. L'envoi est facultatif, un échec
  // ne change rien pour le visiteur.
  const countedSlug = product?.slug
  useEffect(() => {
    if (!countedSlug) return
    const seen = `fiche-vue:${countedSlug}`
    try {
      if (sessionStorage.getItem(seen)) return
      sessionStorage.setItem(seen, '1')
    } catch {
      // Navigation privée sans stockage : on compte quand même.
    }
    void fetch('/api/views', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => undefined)
  }, [countedSlug])

  if (!product) {
    if (loading) {
      return (
        <Container className="pt-24">
          <p className="text-[14px] text-muted">{t('product.loading')}</p>
        </Container>
      )
    }
    return <Navigate to="/shop" replace />
  }

  const animal = isAnimal(product)

  // Une photo, trois cadrages : une vue entière et deux plans serrés qui
  // tiennent lieu de galerie tant qu'il n'y a pas de vraies photos de détail.
  const views = [
    { label: t('product.viewWhole'), style: {} },
    { label: t('product.viewDetail'), style: { transform: 'scale(1.8)', transformOrigin: '50% 35%' } },
    { label: t('product.viewTexture'), style: { transform: 'scale(2.4)', transformOrigin: '50% 70%' } },
  ]
  const related = products.filter((p) => p.slug !== product.slug && (p.category === product.category || p.featured)).slice(0, 4)
  const sections = animal
    ? [
        { title: t('product.details'), body: product.details },
        ...(product.materials ? [{ title: t('product.health'), body: [product.materials] }] : []),
        { title: t('product.visitTransport'), body: [t('product.visitLine1'), t('product.visitLine2')] },
      ]
    : [
        { title: t('product.details'), body: product.details },
        { title: t('product.materials'), body: [product.materials] },
        { title: t('product.shipping'), body: [t('product.shippingLine1'), t('product.shippingLine2')] },
      ]

  function add() {
    cart.add(product!, option, quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <Container className="pt-6 sm:pt-10">
      <Link to="/shop" className="inline-flex h-9 items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" />
        {t('product.breadcrumb')}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {product.image ? (
          <div className="grid grid-cols-[64px_1fr] gap-3 sm:gap-4">
            <div className="flex flex-col gap-3">
              {views.map((v, i) => (
                <button
                  key={v.label}
                  type="button"
                  aria-label={v.label}
                  onClick={() => setView(i)}
                  className={cx('image-frame aspect-[3/4] rounded-[14px] border-2 transition-colors', view === i ? 'border-fg' : 'border-transparent')}
                >
                  <img src={product.image} alt="" className="size-full object-cover" style={v.style} />
                </button>
              ))}
            </div>
            <div className="image-frame relative aspect-[3/4] rounded-image">
              <AnimatePresence mode="wait" initial={false}>
                <motion.img
                  key={view}
                  src={product.image}
                  alt={product.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 size-full object-cover"
                  style={views[view].style}
                />
              </AnimatePresence>
              {product.badge && <span className="absolute left-4 top-4 rounded-[10px] bg-surface/90 px-2.5 py-1 text-[12px] font-medium backdrop-blur">{t(`badge.${product.badge}`)}</span>}
            </div>
          </div>
        ) : (
          <div className="image-frame relative aspect-[3/4] rounded-image">
            <div className="flex size-full flex-col items-center justify-center gap-4 bg-surface-2 px-8 text-center">
              <span className="font-display text-[88px] leading-none text-faint">{product.mark ?? '—'}</span>
              <span className="text-[12px] uppercase tracking-[0.16em] text-faint">{t('product.photoSoon')}</span>
            </div>
          </div>
        )}

        <div className="lg:pt-4">
          <p className="text-[14px] text-muted">{t(categoryKey(product.category))}</p>
          <h1 className="font-display mt-2 text-[38px] leading-[1.02] sm:text-[56px]">{product.name}</h1>
          <p className="mt-4 text-[22px] tabular-nums">{money(product.price)}</p>
          {animal && <p className="mt-2 text-[13px] text-faint">{t('product.priceNote')}</p>}
          <p className="mt-6 text-pretty text-[16px] leading-relaxed text-muted">{product.description}</p>

          {product.options && (
            <div className="mt-8">
              <p className="text-[14px] font-medium">
                {product.options.name} <span className="ml-1 font-normal text-muted">{option}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.options.values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOption(v)}
                    aria-pressed={option === v}
                    className={cx(
                      'h-10 rounded-[12px] border px-4 text-[14px] transition-colors',
                      option === v ? 'border-fg bg-fg text-bg' : 'border-line-strong text-fg hover:border-fg',
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {animal ? (
            <div className="mt-8">
              <Button size="lg" className="w-full sm:w-auto" onClick={() => setVisitOpen(true)}>
                {t('product.visit')}
              </Button>
              <p className="mt-3 text-[13px] text-faint">{t('product.visitNote')}</p>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-[144px_1fr] gap-3">
                <Stepper value={quantity} onChange={setQuantity} />
                <Button size="md" onClick={add} className={cx('h-12 w-full', added && 'bg-accent hover:bg-accent')}>
                  {added ? (
                    <>
                      <Check />
                      {t('product.added')}
                    </>
                  ) : (
                    t('product.addWithPrice', { price: money(product.price * quantity) })
                  )}
                </Button>
              </div>
              <p className="mt-3 text-[13px] text-faint">{t('product.freeShipping')}</p>
            </>
          )}

          <ul className="mt-10 divide-y divide-line border-y border-line">
            {sections.map((s, i) => {
              const isOpen = open === i
              return (
                <li key={s.title}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)} className="flex h-14 w-full items-center justify-between text-left text-[15px] font-medium">
                    {s.title}
                    {isOpen ? <Minus className="size-4 text-muted" /> : <Plus className="size-4 text-muted" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <ul className="flex flex-col gap-1.5 pb-5 text-[14.5px] leading-relaxed text-muted">
                          {s.body.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {animal && <VisitForm open={visitOpen} onClose={() => setVisitOpen(false)} animal={product.name} />}

      <section className="pt-24 sm:pt-32">
        <h2 className="font-display text-[36px] sm:text-[44px]">{t('product.alsoLike')}</h2>
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {related.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} />
          ))}
        </div>
      </section>
    </Container>
  )
}
