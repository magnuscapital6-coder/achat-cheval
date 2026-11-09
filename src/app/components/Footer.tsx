import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Container, inputClass } from './ui'
import { Logo } from './Nav'

const columns = [
  { title: 'Annonces', links: [['Tout le catalogue', '/shop'], ['Chevaux', '/shop?category=chevaux'], ['Poneys', '/shop?category=poneys'], ['Ânes', '/shop?category=autres']] },
  { title: 'Aide', links: [['Comment ça marche', '/about'], ['Organiser une visite', '/shop'], ['Transport', '/about'], ['Contact', '/about']] },
  { title: 'Le site', links: [['Notre méthode', '/about'], ['Notre sélection', '/about'], ['Vos chevaux', '/admin'], ['Contact', '/about']] },
]

export function Footer() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    setState(response.ok ? 'done' : 'error')
  }

  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="max-w-md">
            <h2 className="font-display text-[36px] leading-[1.05]">Des nouvelles de l’écurie, une fois par mois</h2>
            <p className="mt-3 text-[15px] text-muted">Les nouvelles annonces repérées, une fois par mois.</p>
            {state === 'done' ? (
              <p className="mt-6 inline-flex h-12 items-center rounded-control bg-surface-2 px-5 text-[15px]">Merci. À très vite dans votre boîte mail.</p>
            ) : (
              <form onSubmit={submit} className="mt-6 flex gap-2">
                <label className="sr-only" htmlFor="newsletter">
                  E-mail
                </label>
                <input id="newsletter" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputClass} />
                <button type="submit" aria-label="S’inscrire" disabled={state === 'sending'} className="grid size-12 shrink-0 place-items-center rounded-control bg-fg text-bg transition-colors hover:bg-[#33302b]">
                  <ArrowRight className="size-4" />
                </button>
              </form>
            )}
            {state === 'error' && <p className="mt-2 text-[13px] text-accent">Entrez une adresse e-mail valide.</p>}
          </div>
          <div className="grid grid-cols-3 gap-6">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-[13px] font-medium">{col.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map(([label, to]) => (
                    <li key={label}>
                      <Link to={to} className="text-[14px] text-muted transition-colors hover:text-fg">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="max-w-xl text-[13px] text-faint">
            © {new Date().getFullYear()} achat-cheval. Chevaux, poneys et ânes à la vente, visite sur rendez-vous.
          </p>
          <Logo className="text-muted" />
        </div>
      </Container>
    </footer>
  )
}
