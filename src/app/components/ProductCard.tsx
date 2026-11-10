import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'

import { money, useCart } from '../lib/cart'
import { cx } from '../lib/cx'
import { useI18n } from '../lib/i18n'
import { isAnimal, type Product } from '../../data/products'

export function ProductCard({ product, index = 0, priority }: { product: Product; index?: number; priority?: boolean }) {
  const { t } = useI18n()
  const cart = useCart()
  const [added, setAdded] = useState(false)

  function quickAdd(e: React.MouseEvent) {
    e.preventDefault()
    cart.add(product, product.options?.values[0])
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1400)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -6% 0px' }}
      transition={{ duration: 0.7, delay: (index % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Link to={`/product/${product.slug}`} className="block">
        <div className="image-frame relative aspect-[3/4] rounded-image">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 bg-surface-2 px-4 text-center">
              <span className="font-display text-[52px] leading-none text-faint">{product.mark ?? '—'}</span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{t('card.photoSoon')}</span>
            </div>
          )}
          {product.badge && (
            <span
              className={cx(
                'absolute left-3 top-3 rounded-[10px] px-2.5 py-1 text-[12px] font-medium backdrop-blur',
                product.badge === 'Dernière place' ? 'bg-accent-soft/90 text-accent' : 'bg-surface/90 text-fg',
              )}
            >
              {t(`badge.${product.badge}`)}
            </span>
          )}
          {isAnimal(product) ? (
            <span className="absolute inset-x-3 bottom-3 flex h-11 translate-y-2 items-center justify-center rounded-[12px] bg-surface/90 text-[13px] font-medium opacity-0 backdrop-blur transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              {t('card.visit')}
            </span>
          ) : (
            <button
              type="button"
              onClick={quickAdd}
              className={cx(
                'absolute inset-x-3 bottom-3 h-11 translate-y-2 rounded-[12px] bg-fg text-[14px] font-medium text-bg opacity-0 transition-[opacity,transform,background-color] duration-300 hover:bg-[#33302b] group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100',
                added && 'bg-accent hover:bg-accent',
              )}
            >
              {added ? t('card.added') : t('card.add')}
            </button>
          )}
        </div>
        {/* Le prix passe sous le nom sur téléphone : à deux colonnes, le nom et
            le prix côte à côte se coupaient au bout de trois mots. */}
        <div className="mt-3.5 flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[15px] font-medium">{product.name}</h3>
            <p className="mt-0.5 truncate text-[13px] text-muted">{product.short}</p>
          </div>
          <p className="shrink-0 text-[15px] tabular-nums">{money(product.price)}</p>
        </div>
      </Link>
    </motion.article>
  )
}
