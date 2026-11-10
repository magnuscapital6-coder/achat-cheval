import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Container, inputClass } from './ui'
import { Logo } from './Nav'
import { MARKETS, marketPath } from '../../data/locales'
import { useI18n } from '../lib/i18n'

export function Footer() {
  const { t, market } = useI18n()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const columns = [
    {
      title: t('footer.col1'),
      links: [
        [t('footer.allCatalogue'), '/shop'],
        [t('nav.horses'), '/shop?category=chevaux'],
        [t('nav.ponies'), '/shop?category=poneys'],
        [t('nav.donkeys'), '/shop?category=autres'],
      ],
    },
    {
      title: t('footer.col2'),
      links: [
        [t('footer.how'), '/about'],
        [t('footer.visit'), '/shop'],
        [t('footer.transport'), '/about'],
        [t('footer.contact'), '/about'],
      ],
    },
    {
      title: t('footer.col3'),
      links: [
        [t('footer.method'), '/about'],
        [t('footer.selection'), '/about'],
        [t('footer.yourHorses'), '/admin'],
        [t('footer.contact'), '/about'],
      ],
    },
  ]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, market: market.id }),
    })
    setState(response.ok ? 'done' : 'error')
  }

  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="max-w-md">
            <h2 className="font-display text-[36px] leading-[1.05]">{t('footer.newsTitle')}</h2>
            <p className="mt-3 text-[15px] text-muted">{t('footer.newsSub')}</p>
            {state === 'done' ? (
              <p className="mt-6 inline-flex h-12 items-center rounded-control bg-surface-2 px-5 text-[15px]">{t('footer.thanks')}</p>
            ) : (
              <form onSubmit={submit} className="mt-6 flex gap-2">
                <label className="sr-only" htmlFor="newsletter">
                  {t('footer.email')}
                </label>
                <input id="newsletter" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('footer.placeholder')} className={inputClass} />
                <button type="submit" aria-label={t('footer.subscribe')} disabled={state === 'sending'} className="grid size-12 shrink-0 place-items-center rounded-control bg-fg text-bg transition-colors hover:bg-[#33302b]">
                  <ArrowRight className="size-4" />
                </button>
              </form>
            )}
            {state === 'error' && <p className="mt-2 text-[13px] text-accent">{t('footer.error')}</p>}
          </div>
          {/* Deux colonnes sur téléphone : à trois, les libellés se coupent en
              plein mot. */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-[13px] font-medium">{col.title}</p>
                <ul className="mt-3 flex flex-col gap-1">
                  {col.links.map(([label, to]) => (
                    <li key={label}>
                      <Link to={to} className="inline-flex py-1 text-[14px] text-muted transition-colors hover:text-fg">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        {/* Vrais liens `<a>` vers chaque marché : le sélecteur de l'en-tête est
            un `<select>` piloté en JavaScript, invisible pour un moteur. */}
        <nav aria-label={t('footer.markets')} className="mt-16 border-t border-line pt-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {MARKETS.map((entry) => (
              <li key={entry.id}>
                <a
                  href={marketPath('/', entry)}
                  hrefLang={entry.hreflang}
                  aria-current={entry.id === market.id ? 'true' : undefined}
                  className="inline-flex py-1 text-[13px] text-muted transition-colors hover:text-fg aria-[current]:text-fg"
                >
                  {entry.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-6 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="max-w-xl text-[13px] text-faint">{t('footer.copyright', { year: new Date().getFullYear(), note: market.note })}</p>
          <Logo className="text-muted" />
        </div>
      </Container>
    </footer>
  )
}
