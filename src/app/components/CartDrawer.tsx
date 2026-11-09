import { AnimatePresence, motion } from 'motion/react'
import { ShoppingBag, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'

import { FREE_SHIPPING_AT } from '../../data/products'
import { money, useCart } from '../lib/cart'
import { Button } from './ui'

export function CartDrawer() {
  const cart = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (!cart.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cart.setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [cart])

  const remaining = Math.max(0, FREE_SHIPPING_AT - cart.subtotal)
  const progress = Math.min(1, cart.subtotal / FREE_SHIPPING_AT)

  return (
    <AnimatePresence>
      {cart.open && (
        <motion.div
          className="fixed inset-0 z-50 bg-fg/30 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && cart.setOpen(false)}
        >
          <motion.aside
            role="dialog"
            aria-label="Votre panier"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-2 right-2 flex w-[calc(100%-16px)] max-w-[440px] flex-col rounded-dialog bg-bg shadow-drawer"
          >
            <header className="flex h-16 items-center justify-between border-b border-line px-6">
              <h2 className="font-display text-[26px]">
                Votre panier {cart.count > 0 && <span className="ml-1.5 font-sans text-[14px] text-muted">{cart.count}</span>}
              </h2>
              <button type="button" aria-label="Fermer" onClick={() => cart.setOpen(false)} className="grid size-10 place-items-center rounded-control transition-colors hover:bg-surface-2">
                <X className="size-5" />
              </button>
            </header>

            {cart.items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <ShoppingBag className="size-6 text-faint" />
                <p className="mt-4 font-display text-[28px]">Rien ici pour l’instant</p>
                <p className="mt-1 text-[14px] text-muted">Un cheval, ça se choisit doucement.</p>
                <Button
                  variant="secondary"
                  className="mt-6"
                  onClick={() => {
                    cart.setOpen(false)
                    navigate('/shop')
                  }}
                >
                  Voir la boutique
                </Button>
              </div>
            ) : (
              <>
                <div className="px-6 pt-5">
                  <p className="text-[13px] text-muted">{remaining > 0 ? `Encore ${money(remaining)} pour la livraison offerte` : 'Livraison offerte'}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-surface-2">
                    <motion.div className="h-full rounded-[3px] bg-fg" initial={false} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>

                <ul className="flex-1 divide-y divide-line overflow-y-auto px-6 py-2">
                  <AnimatePresence initial={false}>
                    {cart.items.map((item) => (
                      <motion.li
                        key={`${item.slug}-${item.option ?? ''}`}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-4 py-4">
                          <Link to={`/product/${item.slug}`} onClick={() => cart.setOpen(false)} className="image-frame size-[88px] shrink-0 rounded-[16px]">
                            <img src={item.product.image} alt="" className="size-full object-cover" />
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[15px] font-medium">{item.product.name}</p>
                                {item.option && <p className="text-[13px] text-muted">{item.option}</p>}
                              </div>
                              <p className="shrink-0 tabular-nums">{money(item.product.price * item.quantity)}</p>
                            </div>
                            <div className="mt-auto flex items-center justify-between">
                              <div className="grid h-9 grid-cols-[36px_32px_36px] items-center rounded-[11px] border border-line-strong text-[14px]">
                                <button type="button" aria-label="Diminuer" onClick={() => cart.setQuantity(item.slug, item.option, item.quantity - 1)} className="h-full text-muted hover:text-fg">
                                  −
                                </button>
                                <span className="text-center tabular-nums">{item.quantity}</span>
                                <button type="button" aria-label="Augmenter" onClick={() => cart.setQuantity(item.slug, item.option, item.quantity + 1)} className="h-full text-muted hover:text-fg">
                                  +
                                </button>
                              </div>
                              <button type="button" onClick={() => cart.remove(item.slug, item.option)} className="text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline">
                                Retirer
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <footer className="border-t border-line px-6 py-5">
                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-muted">Sous-total</span>
                    <span className="tabular-nums">{money(cart.subtotal)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-faint">Livraison et taxes calculées à la commande.</p>
                  <Button
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => {
                      cart.setOpen(false)
                      navigate('/checkout')
                    }}
                  >
                    Passer commande
                  </Button>
                </footer>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
