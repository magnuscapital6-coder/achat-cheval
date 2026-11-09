import { AnimatePresence, motion } from 'motion/react'
import { Menu, ShoppingBag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { useCart } from '../lib/cart'
import { cx } from '../lib/cx'

const links = [
  { to: '/shop', label: 'Boutique' },
  { to: '/shop?category=chevaux', label: 'Chevaux' },
  { to: '/shop?category=poneys', label: 'Poneys' },
  { to: '/shop?category=autres', label: 'Ânes' },
  { to: '/about', label: 'L’écurie' },
]

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

export function Nav() {
  const cart = useCart()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div className="flex h-9 items-center justify-center bg-fg px-4 text-center text-[12.5px] text-bg">Chevaux, poneys et ânes à la vente — visite sur rendez-vous</div>
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
          <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-control lg:hidden">
            <Menu className="size-5" />
          </button>

          <Logo />

          <div className="flex items-center justify-end gap-1">
            <Link to="/about" className="hidden h-9 items-center rounded-[11px] px-3 text-[14px] text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex lg:hidden">
              L’écurie
            </Link>
            <button
              type="button"
              aria-label={`Panier, ${cart.count} article${cart.count > 1 ? 's' : ''}`}
              onClick={() => cart.setOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] transition-colors hover:bg-surface-2"
            >
              <ShoppingBag className="size-5" />
              <span className="hidden sm:inline">Panier</span>
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
                <button type="button" aria-label="Fermer" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-control hover:bg-surface-2">
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
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
