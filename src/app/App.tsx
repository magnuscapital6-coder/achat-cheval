import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'

import { CartDrawer } from './components/CartDrawer'
import { Footer } from './components/Footer'
import { Nav } from './components/Nav'
import { CartProvider } from './lib/cart'
import { CatalogueProvider } from './lib/catalogue'
import { LocaleProvider, currentMarket } from './lib/i18n'
import { useSeo } from './lib/useSeo'
import { About } from './pages/About'
import { Admin } from './pages/Admin'
import { Checkout, OrderConfirmed } from './pages/Checkout'
import { Home } from './pages/Home'
import { Product } from './pages/Product'
import { Shop } from './pages/Shop'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

function Seo() {
  useSeo()
  return null
}

function Pages() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-[70vh]"
      >
        <Routes location={location}>
          <Route index element={<Home />} />
          <Route path="shop" element={<Shop />} />
          <Route path="product/:slug" element={<Product />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:reference" element={<OrderConfirmed />} />
          <Route path="about" element={<About />} />
          <Route path="admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  )
}

export function App() {
  // Le marché vient du préfixe d'URL (/de, /sl, /fr-be…) : tout le reste de
  // l'app reste écrit avec des chemins sans préfixe, et React Router les
  // recompose grâce au basename.
  return (
    <LocaleProvider>
      <BrowserRouter basename={currentMarket.prefix || undefined}>
        <CatalogueProvider>
          <CartProvider>
            <Seo />
            <ScrollToTop />
            <Nav />
            <Pages />
            <Footer />
            <CartDrawer />
          </CartProvider>
        </CatalogueProvider>
      </BrowserRouter>
    </LocaleProvider>
  )
}
