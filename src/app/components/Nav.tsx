import { AnimatePresence, motion } from 'motion/react'
import { Menu, ShoppingBag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { MARKETS, MARKETS_BY_LANG, langName, type MarketId } from '../../data/locales'
import { useCart } from '../lib/cart'
import { cx } from '../lib/cx'
import { useI18n } from '../lib/i18n'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 21c0-2 1.5-2.5 1.5-4.5V11a5.5 5.5 0 0 1 11 0v5.5c0 2 1.5 2.5 1.5 4.5" />
      </svg>
      <span className="font-display text-[24px] leading-none tracking-tight">achat-cheval</span>
    </Link>
  )
}

/** Les marchés du sélecteur, groupés par langue : dix entrées à plat sont illisibles. */
function MarketOptions() {
  return (
    <>
      {MARKETS_BY_LANG.map((group) => (
        <optgroup key={group.lang} label={langName[group.lang]}>
          {group.markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}

/** Change de marché sans perdre la page en cours (rechargement complet). */
function marketSwitch(marketId: string, pathname: string, search: string) {
  const target = MARKETS.find((market) => market.id === (marketId as MarketId))
  if (!target) return
  window.location.assign(`${target.prefix}${pathname === '/' ? '/' : pathname}${search}`)
}

export function Nav() {
  const cart = useCart()
  const { t, market } = useI18n()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  const links = [
    { to: '/shop', label: t('nav.shop') },
    { to: '/shop?category=chevaux', label: t('nav.horses') },
    { to: '/shop?category=poneys', label: t('nav.ponies') },
    { to: '/shop?category=autres', label: t('nav.donkeys') },
    { to: '/about', label: t('nav.stables') },
  ]

  useEffect(() => setOpen(false), [location])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* Le bandeau grandit au lieu d'être rogné : les traductions allemande et
          néerlandaise tiennent sur deux lignes sur un téléphone étroit. */}
      <div className="flex min-h-9 items-center justify-center bg-fg px-4 py-1.5 text-center text-[12px] leading-snug text-bg sm:py-0 sm:text-[12.5px]">{t('nav.banner')}</div>
      <header className={cx('sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300', scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-xl' : 'bg-bg')}>
        <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-8">
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cx(
                    'inline-flex h-9 items-center rounded-[11px] px-3 text-[14px] transition-colors hover:bg-surface-2',
                    isActive && l.to === location.pathname + location.search ? 'text-fg' : 'text-muted hover:text-fg',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <button type="button" aria-label={t('nav.menu')} onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-control lg:hidden">
            <Menu className="size-5" />
          </button>

          <Logo />

          <div className="flex items-center justify-end gap-1">
            <label className="relative hidden sm:block">
              <span className="sr-only">{t('lang.label')}</span>
              <select
                value={market.id}
                onChange={(e) => marketSwitch(e.target.value, location.pathname, location.search)}
                className="h-9 max-w-[150px] appearance-none truncate rounded-[11px] bg-transparent pl-3 pr-7 text-[13.5px] text-muted transition-colors hover:bg-surface-2 hover:text-fg focus:text-fg focus:outline-none"
              >
                <MarketOptions />
              </select>
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </label>
            <Link to="/about" className="hidden h-9 items-center rounded-[11px] px-3 text-[14px] text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex lg:hidden">
              {t('nav.stables')}
            </Link>
            <button
              type="button"
              aria-label={t('nav.cartAria', { count: cart.count })}
              onClick={() => cart.setOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] transition-colors hover:bg-surface-2"
            >
              <ShoppingBag className="size-5" />
              <span className="hidden sm:inline">{t('nav.cart')}</span>
              <AnimatePresence>
                {cart.count > 0 && (
                  <motion.span
                    key={cart.count}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    className="round grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg"
                  >
                    {cart.count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-fg/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.nav
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-2 left-2 flex w-[300px] flex-col rounded-dialog bg-bg p-5 shadow-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button type="button" aria-label={t('nav.close')} onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-control hover:bg-surface-2">
                  <X className="size-5" />
                </button>
              </div>
              <ul className="mt-8 flex flex-col gap-1">
                {links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="flex h-12 items-center rounded-control px-3 font-display text-[28px] hover:bg-surface-2">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t border-line pt-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] text-faint">{t('lang.label')}</span>
                  <select
                    value={market.id}
                    onChange={(e) => marketSwitch(e.target.value, location.pathname, location.search)}
                    className="h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-[15px]"
                  >
                    <MarketOptions />
                  </select>
                </label>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
