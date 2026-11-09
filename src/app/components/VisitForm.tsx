import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Button, inputClass } from './ui'

export function VisitForm({ open, onClose, animal }: { open: boolean; onClose: () => void; animal: string }) {
  const [form, setForm] = useState({ name: '', phone: '', message: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) return
    setState('idle')
    setError('')
    setForm({ name: '', phone: '', message: '' })
  }, [open])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, animal }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'Une erreur est survenue.')
      setState('done')
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-fg/30 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-title"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative my-auto w-full max-w-[520px] rounded-dialog bg-bg p-6 shadow-drawer sm:p-8"
          >
            <button type="button" aria-label="Fermer" onClick={onClose} className="absolute right-4 top-4 grid size-10 place-items-center rounded-control transition-colors hover:bg-surface-2">
              <X className="size-5" />
            </button>

            {state === 'done' ? (
              <div className="py-4 pr-8">
                <span className="round grid size-12 place-items-center rounded-full bg-fg text-bg">
                  <Check className="size-5" />
                </span>
                <h2 id="visit-title" className="font-display mt-5 text-[34px] leading-[1.05]">
                  Demande envoyée
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">
                  Merci, on vous répond sous 24 h ouvrées au <span className="font-medium text-fg">{form.phone}</span>
                  {` pour organiser votre visite à l’écurie et parler de « ${animal} ».`}
                </p>
                <Button variant="secondary" className="mt-6" onClick={onClose}>
                  Fermer
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="pr-8">
                <p className="text-[13px] text-muted">Visite sur rendez-vous</p>
                <h2 id="visit-title" className="font-display mt-2 text-[34px] leading-[1.05]">
                  Visiter {animal}
                </h2>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">
                  Laissez-nous vos coordonnées : on vous rappelle pour fixer un créneau à l’écurie.
                </p>

                <div className="mt-6 flex flex-col gap-4">
                  <label>
                    <span className="mb-1.5 block text-[13px] font-medium">Nom</span>
                    <input required autoFocus className={inputClass} value={form.name} onChange={set('name')} autoComplete="name" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[13px] font-medium">Téléphone</span>
                    <input required type="tel" inputMode="tel" className={inputClass} value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="06 12 34 56 78" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-[13px] font-medium">Message</span>
                    <textarea
                      required
                      rows={4}
                      className={`${inputClass} min-h-28 resize-y py-3`}
                      value={form.message}
                      onChange={set('message')}
                      placeholder="Vos disponibilités, votre niveau, ce que vous cherchez…"
                    />
                  </label>
                </div>

                {state === 'error' && <p className="mt-4 text-[14px] text-accent">{error}</p>}

                <Button type="submit" size="lg" loading={state === 'sending'} className="mt-6 w-full">
                  Envoyer la demande
                </Button>
                <p className="mt-3 text-[12.5px] text-faint">
                  Vos coordonnées servent uniquement à organiser la visite.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
