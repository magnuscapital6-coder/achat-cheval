import { Check, ImagePlus, LogIn, LogOut, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'

import { MARKETS, marketFromPath, stripMarket } from '../../data/locales'
import { categories, type Category } from '../../data/products'
import { Button, Container, inputClass } from '../components/ui'
import { money } from '../lib/cart'
import { useCatalogue, type OwnListing } from '../lib/catalogue'

type Session = {
  user: { name?: string; email?: string } | null
  owner: boolean
}

type Enquiry = {
  id: string
  createdAt: string
  animal: string
  name: string
  phone: string
  message: string
  market: string
  source: string
  notified: boolean
}

type OrderRow = {
  reference: string
  createdAt: string
  email: string
  items: { id: string; name: string; price: number; quantity: number; option?: string }[]
  total: number
  market: string
  notified: boolean
}

type Subscriber = { email: string; createdAt: string; market: string }

/** Un appareil connecté à l'admin, vu depuis `/api/admin/sessions`. */
type AdminSession = { id: string; createdAt: string; expiresAt: string; device: string; ip: string; current: boolean }

/** Une tentative de connexion refusée, telle que la journalise le Worker. */
type AdminFailure = { at: string; ip: string; reason: string }

/** Une connexion acceptée, gardée même quand sa session est fermée. */
type AdminLogin = { at: string; ip: string; device: string }

/** Le résumé de la semaine en cours, calculé en base et renvoyé par `/api/summary`. */
type Summary = {
  since: string
  demands: { week: number; total: number }
  orders: { week: number; total: number; revenue: number; weekRevenue: number }
  subscribers: { week: number; total: number }
  views: { week: number; total: number }
  days: { day: string; demands: number; views: number }[]
}

/** Visites comptées pour une fiche, déjà ramenées à un chemin sans marché. */
type ViewRow = { path: string; market: string; views: number }

const emptyForm = {
  name: '',
  price: '',
  category: 'chevaux' as Category,
  breed: '',
  sex: '',
  age: '',
  height: '',
  discipline: '',
  place: '',
  description: '',
  details: '',
}

const label = 'mb-1.5 block text-[13px] font-medium'
const hint = 'mt-1.5 text-[12.5px] text-faint'

// Chaque liste est un écran à part : une seule page empilée devenait illisible.
const TABS = [
  { key: 'ensemble', label: 'Vue d’ensemble', title: 'Vue d’ensemble' },
  { key: 'annonces', label: 'Annonces', title: 'Vos annonces' },
  { key: 'demandes', label: 'Demandes de visite', title: 'Demandes de visite' },
  { key: 'commandes', label: 'Commandes', title: 'Commandes' },
  { key: 'inscriptions', label: 'Inscriptions', title: 'Inscriptions' },
  { key: 'sessions', label: 'Sessions', title: 'Sessions ouvertes' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function Admin() {
  const { own, refresh } = useCatalogue()
  const [session, setSession] = useState<Session | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const [params, setParams] = useSearchParams()

  const requested = params.get('vue')
  const signedIn = Boolean(session?.user)
  const allowed = Boolean(session?.owner)
  // Un compte sans droit ne voit que les annonces : les listes sont réservées.
  // Sans `vue`, le propriétaire arrive sur le résumé ; `/admin?vue=annonces`
  // ouvre le formulaire d'annonce.
  const tab: TabKey = allowed ? (TABS.some((entry) => entry.key === requested) ? (requested as TabKey) : 'ensemble') : 'annonces'
  const editing = editingId ? own.find((listing) => listing.id === editingId) ?? null : null
  const currentImage = editing?.image && !removePhoto ? editing.image : null

  const loadSession = async () => {
    try {
      const response = await fetch('/api/me')
      const body = (await response.json()) as Session
      setSession({ user: body.user ?? null, owner: Boolean(body.owner) })
    } catch {
      setSession({ user: null, owner: false })
    }
  }

  // La déconnexion supprime la session en base : le jeton du cookie ne
  // resservira plus, même si le navigateur le gardait.
  const signOut = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined)
    setSession({ user: null, owner: false })
    void refresh()
  }

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    if (!photo) return setPreview(null)
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const set = (key: keyof typeof emptyForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: event.target.value })

  function resetForm() {
    setForm(emptyForm)
    setPhoto(null)
    setRemovePhoto(false)
    setEditingId(null)
  }

  function startEdit(listing: OwnListing) {
    setForm({
      name: listing.name,
      price: String(listing.price),
      category: listing.category,
      breed: listing.breed ?? '',
      sex: listing.sex ?? '',
      age: listing.age ?? '',
      height: listing.height ?? '',
      discipline: listing.discipline ?? '',
      place: listing.place ?? '',
      description: listing.description,
      details: listing.details.join('\n'),
    })
    setEditingId(listing.id)
    setPhoto(null)
    setRemovePhoto(false)
    setMessage('')
    setState('idle')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setState('saving')
    setMessage('')

    const data = new FormData()
    for (const [key, value] of Object.entries(form)) data.append(key, value)
    if (photo) data.append('photo', photo)
    if (editingId && removePhoto) data.append('removePhoto', '1')

    try {
      const response = await fetch(editingId ? `/api/listings/${editingId}` : '/api/listings', {
        method: editingId ? 'PUT' : 'POST',
        body: data,
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (response.status === 401) {
        await loadSession()
        throw new Error('Votre session a expiré. Reconnectez-vous pour publier.')
      }
      if (!response.ok) throw new Error(body.error ?? 'Enregistrement impossible.')
      setMessage(editingId ? `« ${form.name} » a été mis à jour.` : `« ${form.name} » est en ligne.`)
      resetForm()
      setState('idle')
      await refresh()
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.')
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Supprimer « ${name} » ? La photo part avec.`)) return
    const response = await fetch(`/api/listings/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      setState('error')
      setMessage(body.error ?? 'Suppression impossible.')
      return
    }
    if (id === editingId) resetForm()
    setMessage('Annonce supprimée.')
    await refresh()
  }

  if (!session) {
    return (
      <Container className="max-w-3xl pt-10 sm:pt-14">
        <p className="text-[14px] text-muted">Espace propriétaire</p>
        <p className="mt-4 text-[15px] text-muted">Vérification de la connexion…</p>
      </Container>
    )
  }

  return (
    <Container className="max-w-3xl pt-10 sm:pt-14">
      <p className="text-[14px] text-muted">Espace propriétaire</p>
      <h1 className="font-display mt-2 text-[44px] leading-[1.02] sm:text-[56px]">
        {tab === 'annonces' ? (editing ? 'Modifier cette annonce' : 'Ajouter un cheval') : TABS.find((entry) => entry.key === tab)?.title}
      </h1>
      {tab === 'annonces' ? (
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          {editing
            ? 'Changez ce qui a bougé — prix, âge, photo — puis enregistrez. L’adresse de la fiche ne change pas.'
            : 'Renseignez la fiche et déposez une photo : elle apparaît dans la boutique dès l’enregistrement, avec le formulaire de visite.'}
        </p>
      ) : (
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          {tab === 'ensemble'
            ? 'La semaine en cours, du lundi au dimanche : demandes, commandes, inscriptions et visites, avec le cumul depuis l’ouverture.'
            : tab === 'demandes'
              ? 'Les demandes reçues depuis le formulaire des fiches, de la plus récente à la plus ancienne, regroupées par marché.'
              : tab === 'commandes'
                ? 'Les commandes passées en caisse, de la plus récente à la plus ancienne.'
                : tab === 'inscriptions'
                  ? 'Les adresses inscrites en pied de page, de la plus récente à la plus ancienne.'
                  : 'Les appareils connectés avec le mot de passe, de la plus récente à la plus ancienne. Fermer une session la coupe sur-le-champ, même si le navigateur garde son cookie ; l’empreinte du jeton disparaît aussi de la base. Seules les cinq connexions les plus récentes sont gardées : la plus ancienne s’efface quand une sixième arrive.'}
        </p>
      )}

      <div className="mt-8 rounded-dialog border border-line bg-surface p-5 sm:p-6">
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">Administrateur</p>
              <p className="mt-0.5 break-all text-[12.5px] text-faint">{session.user?.email || session.user?.name}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="py-2 text-[13.5px] text-muted transition-colors hover:text-fg"
            >
              Se déconnecter
            </button>
          </div>
        ) : (
          <AdminLogin onSignedIn={loadSession} />
        )}
      </div>

      {allowed && (
        <nav aria-label="Écrans de l’admin" className="mt-8 flex flex-wrap gap-1.5 border-b border-line pb-4 sm:gap-2">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              aria-current={entry.key === tab ? 'page' : undefined}
              onClick={() => setParams(entry.key === 'ensemble' ? {} : { vue: entry.key })}
              className={`inline-flex h-8 items-center rounded-full px-3 text-[12.5px] transition-colors sm:h-9 sm:px-4 sm:text-[13.5px] ${
                entry.key === tab ? 'bg-fg text-bg' : 'border border-line text-muted hover:border-fg hover:text-fg'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      )}

      {tab === 'annonces' && (
        <>
      <form ref={formRef} onSubmit={submit} className="mt-8 scroll-mt-8 flex flex-col gap-5">
        {editing && (
          <div className="flex items-center gap-3 rounded-control border border-line bg-surface px-4 py-3 text-[13.5px]">
            <Pencil className="size-4 shrink-0 text-muted" />
            <p className="min-w-0 flex-1 truncate">
              Vous modifiez <span className="font-medium">{editing.name}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                resetForm()
                setMessage('')
                setState('idle')
              }}
              className="flex shrink-0 items-center gap-1 text-muted transition-colors hover:text-fg"
            >
              <X className="size-3.5" />
              Annuler
            </button>
          </div>
        )}

        <fieldset disabled={!allowed} className="flex flex-col gap-5 disabled:opacity-55">
          <div className="grid gap-5 sm:grid-cols-2">
            <label>
              <span className={label}>Nom de l’annonce</span>
              <input required value={form.name} onChange={set('name')} placeholder="Ulysse, Selle Français" className={inputClass} />
            </label>
            <label>
              <span className={label}>Prix (€)</span>
              <input required inputMode="numeric" value={form.price} onChange={set('price')} placeholder="12500" className={inputClass} />
            </label>
            <label>
              <span className={label}>Catégorie</span>
              <select value={form.category} onChange={set('category')} className={inputClass}>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Race</span>
              <input value={form.breed} onChange={set('breed')} placeholder="Selle Français" className={inputClass} />
            </label>
            <label>
              <span className={label}>Sexe</span>
              <input value={form.sex} onChange={set('sex')} placeholder="Hongre" className={inputClass} />
            </label>
            <label>
              <span className={label}>Âge</span>
              <input value={form.age} onChange={set('age')} placeholder="9 ans" className={inputClass} />
            </label>
            <label>
              <span className={label}>Taille</span>
              <input value={form.height} onChange={set('height')} placeholder="1,68 m" className={inputClass} />
            </label>
            <label>
              <span className={label}>Discipline</span>
              <input value={form.discipline} onChange={set('discipline')} placeholder="CSO 1,10 m" className={inputClass} />
            </label>
            <label className="sm:col-span-2">
              <span className={label}>Département</span>
              <input value={form.place} onChange={set('place')} placeholder="Calvados" className={inputClass} />
            </label>
          </div>

          <label>
            <span className={label}>Description</span>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={set('description')}
              placeholder="Comment il travaille, ce qu’il aime, ce qu’il faut savoir avant de venir."
              className={`${inputClass} min-h-28 resize-y py-3`}
            />
          </label>

          <label>
            <span className={label}>Détails (une ligne par point)</span>
            <textarea
              rows={4}
              value={form.details}
              onChange={set('details')}
              placeholder={'Hongre Selle Français, 9 ans\n1,68 m au garrot\nVaccins et vermifuge à jour'}
              className={`${inputClass} min-h-28 resize-y py-3`}
            />
          </label>

          <div>
            <span className={label}>Photo</span>
            <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-5 text-[15px] transition-colors hover:border-fg">
              <ImagePlus className="size-4" />
              {photo ? photo.name : currentImage ? 'Remplacer la photo' : 'Choisir une photo'}
              <input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="sr-only" />
            </label>
            <p className={hint}>
              JPG, PNG ou WebP, 8 Mo maximum.{editing ? ' Sans nouveau fichier, la photo actuelle reste en place.' : ''}
            </p>
            {(preview || currentImage) && (
              <img src={preview ?? currentImage ?? ''} alt="" className="mt-3 aspect-[4/3] w-full max-w-sm rounded-[16px] object-cover" />
            )}
            {editing?.image && (
              <label className="mt-3 flex w-fit items-center gap-2 text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={removePhoto}
                  onChange={(event) => setRemovePhoto(event.target.checked)}
                  className="size-4 accent-current"
                />
                Retirer la photo actuelle
              </label>
            )}
          </div>
        </fieldset>

        {message && (
          <p className={state === 'error' ? 'text-[14px] text-accent' : 'flex items-center gap-2 text-[14px] text-muted'}>
            {state !== 'error' && <Check className="size-4" />}
            {message}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={state === 'saving'} disabled={!allowed} className="self-start">
            {editing ? 'Enregistrer les modifications' : 'Publier l’annonce'}
          </Button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                resetForm()
                setMessage('')
                setState('idle')
              }}
              className="text-[14px] text-muted transition-colors hover:text-fg"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <section className="mt-16 border-t border-line pt-8">
        <h2 className="font-display text-[30px]">Vos chevaux en ligne</h2>
        {own.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">Aucun cheval à vous pour l’instant. Le reste du catalogue est déjà dans la boutique.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line">
            {own.map((listing) => (
              <li key={listing.id} className="flex items-center gap-4 py-4">
                {listing.image ? (
                  <img src={listing.image} alt="" className="size-14 shrink-0 rounded-[12px] object-cover" />
                ) : (
                  <span className="grid size-14 shrink-0 place-items-center rounded-[12px] bg-surface-2 text-[12px] text-faint">—</span>
                )}
                <div className="min-w-0 flex-1">
                  <Link to={`/product/${listing.slug}`} className="block truncate text-[15px] font-medium hover:underline">
                    {listing.name}
                  </Link>
                  <p className="truncate text-[13px] text-muted">
                    {money(listing.price)} · {listing.place || listing.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(listing)}
                  disabled={!allowed}
                  aria-label={`Modifier ${listing.name}`}
                  className={`grid size-10 shrink-0 place-items-center rounded-control transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40 ${
                    listing.id === editingId ? 'text-fg' : 'text-muted'
                  }`}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(listing.id, listing.name)}
                  disabled={!allowed}
                  aria-label={`Supprimer ${listing.name}`}
                  className="grid size-10 shrink-0 place-items-center rounded-control text-muted transition-colors hover:bg-surface-2 hover:text-accent disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
        </>
      )}

      {tab === 'ensemble' && <Overview allowed={allowed} />}
      {tab === 'demandes' && <Enquiries allowed={allowed} />}
      {tab === 'commandes' && <Orders allowed={allowed} />}
      {tab === 'inscriptions' && <Subscribers allowed={allowed} />}
      {tab === 'sessions' && (
        <Sessions
          allowed={allowed}
          onSignedOut={() => {
            setSession({ user: null, owner: false })
            void refresh()
          }}
        />
      )}
    </Container>
  )
}

const shortDate = (value: string) =>
  new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const marketName = (id: string) => MARKETS.find((market) => market.id === id)?.label ?? 'Marché non identifié'

/** Charge une liste réservée au propriétaire ; rien n'est demandé sans droit. */
function useOwnerList<T>(path: string, key: string, allowed: boolean) {
  const [data, setData] = useState<T[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!allowed) {
      setData(null)
      setError('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(path)
        const body = (await response.json()) as Record<string, unknown> & { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Chargement impossible.')
        if (!cancelled) setData((body[key] as T[] | undefined) ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed, path, key])

  return { data, error }
}

/** Charge le résumé de la semaine ; rien n'est demandé sans droit. */
function useOwnerSummary(allowed: boolean) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!allowed) {
      setData(null)
      setError('')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/summary')
        const body = (await response.json()) as Summary & { error?: string }
        if (!response.ok) throw new Error(body.error ?? 'Chargement impossible.')
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed])

  return { data, error }
}

/** Sept jours, deux séries, même échelle : les hauteurs se comparent. */
function WeekChart({ days }: { days: Summary['days'] }) {
  const AREA = 112
  const peak = Math.max(1, ...days.flatMap((day) => [day.views, day.demands]))
  const todayKey = new Date().toISOString().slice(0, 10)
  // Échelle commune aux deux séries ; un jour à une seule demande garde un
  // bâton visible (6 px) au lieu d'un point à peine perceptible.
  const height = (value: number) => (value === 0 ? '0px' : `${Math.max(6, Math.round((value / peak) * AREA))}px`)
  const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })
  const long = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  return (
    <div className="mt-3 rounded-dialog border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-[14px] font-medium">Cette semaine</h2>
        <p className="flex items-center gap-3 text-[12px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-line-strong" aria-hidden /> Visites
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-fg" aria-hidden /> Demandes
          </span>
        </p>
      </div>
      {/* Les bâtons sont décoratifs : les chiffres du jour sont lus plus bas
          par les lecteurs d'écran. */}
      <div className="mt-4 flex items-end gap-1 border-b border-line sm:gap-2" aria-hidden>
        {days.map((day) => (
          <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex h-28 w-full items-end justify-center gap-1">
              <span
                title={`${day.views} visite${day.views > 1 ? 's' : ''}`}
                style={{ height: height(day.views) }}
                className="w-2.5 rounded-t-[3px] bg-line-strong sm:w-3"
              />
              <span
                title={`${day.demands} demande${day.demands > 1 ? 's' : ''}`}
                style={{ height: height(day.demands) }}
                className="w-2.5 rounded-t-[3px] bg-fg sm:w-3"
              />
            </div>
            <span
              className={`text-[11px] ${day.day === todayKey ? 'font-medium text-fg' : day.day > todayKey ? 'text-faint/60' : 'text-faint'}`}
            >
              {short(day.day)}
            </span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.day}>
            {long(day.day)} :{' '}
            {day.day > todayKey
              ? 'à venir'
              : `${day.demands} demande${day.demands > 1 ? 's' : ''}, ${day.views} visite${day.views > 1 ? 's' : ''}`}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Les sept derniers jours, et le cumul depuis l'ouverture. */
function Overview({ allowed }: { allowed: boolean }) {
  const { data, error } = useOwnerSummary(allowed)
  if (!allowed) return null

  if (error) return <p className="mt-8 text-[14px] text-accent">{error}</p>
  if (!data) return <p className="mt-8 text-[14px] text-muted">Chargement du résumé…</p>

  const weekStart = new Date(data.since)
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
  const dayMonth = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const dayOnly = (date: Date) => date.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'UTC' })
  // « du 9 au 15 novembre » plutôt que « du 9 novembre au 15 novembre ».
  const sameMonth = weekStart.getUTCMonth() === weekEnd.getUTCMonth() && weekStart.getUTCFullYear() === weekEnd.getUTCFullYear()
  const cards = [
    { key: 'demandes', label: 'Demandes de visite', week: data.demands.week, total: data.demands.total, extra: [] as string[] },
    {
      key: 'commandes',
      label: 'Commandes',
      week: data.orders.week,
      total: data.orders.total,
      extra: [`${money(data.orders.weekRevenue)} cette semaine`, `${money(data.orders.revenue)} au total`],
    },
    { key: 'inscriptions', label: 'Inscriptions', week: data.subscribers.week, total: data.subscribers.total, extra: [] as string[] },
    { key: 'visites', label: 'Visites de fiches', week: data.views.week, total: data.views.total, extra: [] as string[] },
  ]

  return (
    <section className="mt-8">
      <p className="text-[13px] text-muted">
        Semaine du {sameMonth ? dayOnly(weekStart) : dayMonth(weekStart)} au {dayMonth(weekEnd)}.
      </p>
      {/* Deux colonnes dès le téléphone : quatre cartes pleine largeur
          demandaient trois écrans de défilement. */}
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
        {cards.map((card) => (
          <li key={card.key} className="rounded-dialog border border-line bg-surface p-4 sm:p-5">
            <p className="text-[12.5px] text-muted sm:text-[13px]">{card.label}</p>
            <p className="font-display mt-2 text-[32px] leading-none tabular-nums sm:text-[40px]">{card.week}</p>
            <p className="mt-2 text-[12px] leading-snug text-faint sm:text-[12.5px]">cette semaine · {card.total} depuis le début</p>
            {card.extra.length > 0 && (
              <p className="mt-1 text-[12px] leading-snug text-faint sm:text-[12.5px]">
                {card.extra.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
      {data.days && data.days.length > 0 && <WeekChart days={data.days} />}
    </section>
  )
}

/** Un e-mail d'alerte qui n'est pas parti doit se voir, pas finir dans un log. */
function NotifyMissed() {
  return <p className="mt-1 text-[12.5px] text-faint">Alerte e-mail non envoyée — vérifiez la clé Resend.</p>
}

/** Une demande, à l'identique dans les deux vues. */
function EnquiryRow({ enquiry, showMarket }: { enquiry: Enquiry; showMarket: boolean }) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[15px] font-medium">
          {enquiry.name} · <span className="font-normal text-muted">{enquiry.animal}</span>
        </p>
        <p className="text-[12.5px] text-faint">{shortDate(enquiry.createdAt)}</p>
      </div>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-muted">
        {showMarket && <span>{marketName(enquiry.market)}</span>}
        {enquiry.source ? (
          // Lien natif : le chemin contient le préfixe de marché, que le routeur
          // ajouterait une seconde fois (basename).
          <a href={enquiry.source} className="underline decoration-line-strong underline-offset-2 hover:text-fg">
            Depuis {enquiry.source}
          </a>
        ) : (
          <span className="text-faint">Fiche d’origine non transmise</span>
        )}
      </p>
      <a
        href={`tel:${enquiry.phone.replace(/\s/g, '')}`}
        className="mt-1 inline-block text-[13.5px] text-muted underline-offset-2 hover:text-fg hover:underline"
      >
        {enquiry.phone}
      </a>
      <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed">{enquiry.message}</p>
      {!enquiry.notified && <NotifyMissed />}
    </li>
  )
}

/** Les demandes de visite : par date, ou regroupées par marché. Propriétaire uniquement. */
function Enquiries({ allowed }: { allowed: boolean }) {
  const { data: rows, error } = useOwnerList<Enquiry>('/api/enquiries', 'enquiries', allowed)
  const { data: views, error: viewsError } = useOwnerList<ViewRow>('/api/views', 'views', allowed)
  const [view, setView] = useState<'date' | 'marche' | 'fiche'>('date')
  // '' = tous les marchés ; 'inconnu' = lignes antérieures à la colonne market.
  const [marketFilter, setMarketFilter] = useState('')
  const [period, setPeriod] = useState<'all' | '7' | '30' | '90'>('all')

  if (!allowed) return null

  const unknownRows = rows?.filter((row) => !MARKETS.some((market) => market.id === row.market)) ?? []
  const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000
  const visible = (rows ?? []).filter((row) => {
    const matchesMarket = marketFilter === '' || (marketFilter === 'inconnu' ? !MARKETS.some((market) => market.id === row.market) : row.market === marketFilter)
    return matchesMarket && (cutoff === 0 || new Date(row.createdAt).getTime() >= cutoff)
  })
  const filtered = visible.length !== (rows?.length ?? 0)

  // L'ordre des marchés suit celui du site ; les demandes sans marché (reçues
  // avant l'ajout de la colonne) finissent en bas, jamais perdues.
  const groups = [
    ...MARKETS.map((market) => ({ key: market.id, label: market.label, items: visible.filter((row) => row.market === market.id) })),
    { key: 'inconnu', label: 'Marché non identifié', items: visible.filter((row) => !MARKETS.some((market) => market.id === row.market)) },
  ].filter((group) => group.items.length > 0)

  // Comparaison visites / demandes : toutes les demandes chargées, tous marchés
  // et toutes périodes, parce qu'un taux de conversion n'a de sens qu'entre
  // deux mesures complètes. Les filtres ci-dessus ne s'y appliquent donc pas.
  // Une annonce est la même fiche sur les onze marchés : les chemins sont
  // comparés sans préfixe de marché, sinon une fiche lue depuis deux pays
  // compterait deux fois.
  const stats = new Map<string, { path: string; href: string; demands: number; views: number }>()
  const stat = (path: string, href: string) => {
    const entry = stats.get(path) ?? { path, href, demands: 0, views: 0 }
    stats.set(path, entry)
    return entry
  }
  for (const row of rows ?? []) {
    if (!row.source) continue
    stat(stripMarket(row.source, marketFromPath(row.source)), row.source).demands += 1
  }
  for (const row of views ?? []) {
    // Les visites n'ont pas de filtre : on garde le préfixe de marché de la
    // dernière visite pour ouvrir la fiche dans une langue qui existe.
    stat(row.path, `${MARKETS.find((market) => market.id === row.market)?.prefix ?? ''}${row.path}`).views = row.views
  }
  const fiches = [...stats.values()].sort((a, b) => b.views - a.views || b.demands - a.demands || a.path.localeCompare(b.path))
  const withoutSource = (rows ?? []).filter((row) => !row.source).length

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {rows && (
          <p className="text-[13px] text-muted">
            {filtered ? `${visible.length} sur ${rows.length} demandes` : `${rows.length} demande${rows.length > 1 ? 's' : ''} reçue${rows.length > 1 ? 's' : ''}`}
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="flex items-center gap-1 text-[12.5px]">
            {([['date', 'Par date'], ['marche', 'Par marché'], ['fiche', 'Par fiche']] as const).map(([key, text]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={`h-8 rounded-full px-3 transition-colors ${view === key ? 'bg-fg text-bg' : 'text-muted hover:text-fg'}`}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      {rows && rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrer par marché"
            value={marketFilter}
            onChange={(event) => setMarketFilter(event.target.value)}
            className="h-10 rounded-control border border-line-strong bg-surface px-3 text-[13.5px] text-fg transition-colors focus:border-fg focus:outline-none"
          >
            <option value="">Tous les marchés</option>
            {MARKETS.map((market) => (
              <option key={market.id} value={market.id}>
                {market.label}
              </option>
            ))}
            {unknownRows.length > 0 && <option value="inconnu">Marché non identifié</option>}
          </select>
          <select
            aria-label="Filtrer par période"
            value={period}
            onChange={(event) => setPeriod(event.target.value as typeof period)}
            className="h-10 rounded-control border border-line-strong bg-surface px-3 text-[13.5px] text-fg transition-colors focus:border-fg focus:outline-none"
          >
            <option value="all">Toute la période</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setMarketFilter('')
                setPeriod('all')
              }}
              className="h-10 rounded-full px-3 text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Tout afficher
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-[14px] text-accent">{error}</p>}
      {!rows && !error && <p className="mt-4 text-[14px] text-muted">Chargement des demandes…</p>}
      {rows && rows.length === 0 && (
        <p className="mt-3 text-[14px] text-muted">Aucune demande pour l’instant. Les visiteurs qui remplissent le formulaire d’une fiche arrivent ici.</p>
      )}
      {view !== 'fiche' && rows && rows.length > 0 && visible.length === 0 && (
        <p className="mt-6 text-[14px] text-muted">Aucune demande ne correspond à ces filtres.</p>
      )}

      {view === 'date' && visible.length > 0 && (
        <ul className="mt-6 divide-y divide-line">
          {visible.map((enquiry) => (
            <EnquiryRow key={enquiry.id} enquiry={enquiry} showMarket />
          ))}
        </ul>
      )}

      {/* La vue « Par fiche » a aussi du sens avant la première demande : des
          visites sans conversion disent déjà quelles annonces attirent l'œil. */}
      {(view === 'fiche' || (rows?.length ?? 0) === 0) && fiches.length > 0 && (
        <div className="mt-8">
          <p className="text-[12.5px] text-faint">
            Visites et demandes par fiche, de la plus visitée à la moins visitée, tous marchés et toutes périodes : les filtres
            ci-dessus ne s’appliquent pas à cette vue. Le pourcentage est la part des visites qui aboutit à une demande.
          </p>
          {viewsError && <p className="mt-2 text-[13px] text-accent">Visites indisponibles : {viewsError}</p>}
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {fiches.map(({ path, href, demands, views: visits }) => (
              <li key={path} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <a href={href} className="text-[14px] underline decoration-line-strong underline-offset-2 hover:text-muted">
                  {path}
                </a>
                <span className="text-[13px] tabular-nums text-muted">
                  {demands} {demands > 1 ? 'demandes' : 'demande'} · {visits} {visits > 1 ? 'visites' : 'visite'}
                  {visits > 0 && ` · ${Math.round((demands / visits) * 100)} %`}
                </span>
              </li>
            ))}
            {withoutSource > 0 && (
              <li className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="text-[14px] text-faint">Fiche d’origine non transmise</span>
                <span className="text-[13px] tabular-nums text-muted">
                  {withoutSource} {withoutSource > 1 ? 'demandes' : 'demande'}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      {view === 'marche' && (
        <div className="mt-8 flex flex-col gap-10">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <h3 className="text-[15px] font-medium">{group.label}</h3>
                <span className="text-[13px] text-muted">{group.items.length}</span>
              </div>
              <ul className="divide-y divide-line">
                {group.items.map((enquiry) => (
                  <EnquiryRow key={enquiry.id} enquiry={enquiry} showMarket={false} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Les commandes passées en caisse. Réservé au propriétaire. */
function Orders({ allowed }: { allowed: boolean }) {
  const { data: orders, error } = useOwnerList<OrderRow>('/api/orders', 'orders', allowed)
  if (!allowed) return null

  return (
    <section className="mt-8">
      {orders && <p className="text-[13px] text-muted">{orders.length} commande{orders.length > 1 ? 's' : ''}</p>}

      {error && <p className="mt-4 text-[14px] text-accent">{error}</p>}
      {!orders && !error && <p className="mt-4 text-[14px] text-muted">Chargement des commandes…</p>}
      {orders && orders.length === 0 && (
        <p className="mt-3 text-[14px] text-muted">Aucune commande pour l’instant. Chaque passage en caisse est enregistré ici.</p>
      )}

      <ul className="mt-6 divide-y divide-line">
        {orders?.map((order) => (
          <li key={order.reference} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[15px] font-medium">{order.reference}</p>
              <p className="text-[15px] tabular-nums">{money(order.total)}</p>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {shortDate(order.createdAt)} · {order.email} · {marketName(order.market)}
            </p>
            <p className="mt-1 text-[13.5px] text-muted">
              {order.items.map((line) => `${line.quantity} × ${line.name}${line.option ? ` (${line.option})` : ''}`).join(' · ')}
            </p>
            {!order.notified && <NotifyMissed />}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Les inscrits au pied de page, jusqu'ici validés puis jetés. */
function Subscribers({ allowed }: { allowed: boolean }) {
  const { data: subscribers, error } = useOwnerList<Subscriber>('/api/subscribers', 'subscribers', allowed)
  if (!allowed) return null

  return (
    <section className="mt-8">
      {subscribers && <p className="text-[13px] text-muted">{subscribers.length} adresse{subscribers.length > 1 ? 's' : ''}</p>}

      {error && <p className="mt-4 text-[14px] text-accent">{error}</p>}
      {!subscribers && !error && <p className="mt-4 text-[14px] text-muted">Chargement des inscriptions…</p>}
      {subscribers && subscribers.length === 0 && (
        <p className="mt-3 text-[14px] text-muted">Aucune inscription pour l’instant. Les adresses du pied de page arrivent ici.</p>
      )}

      <ul className="mt-6 divide-y divide-line">
        {subscribers?.map((subscriber) => (
          <li key={subscriber.email} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <a href={`mailto:${subscriber.email}`} className="text-[14.5px] hover:underline">
              {subscriber.email}
            </a>
            <p className="text-[12.5px] text-faint">
              {shortDate(subscriber.createdAt)} · {marketName(subscriber.market)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Les sessions ouvertes : les appareils connectés avec le mot de passe.
 * Fermer une session supprime son empreinte en base, donc le cookie de cet
 * appareil ne vaut plus rien même s'il reste dans le navigateur.
 */
function Sessions({ allowed, onSignedOut }: { allowed: boolean; onSignedOut: () => void }) {
  const [rows, setRows] = useState<AdminSession[] | null>(null)
  const [failures, setFailures] = useState<{ total: number; attempts: AdminFailure[] } | null>(null)
  const [logins, setLogins] = useState<{ total: number; rows: AdminLogin[] } | null>(null)
  // Le filtre vit dans l'adresse (`?ip=`) : un rechargement ou un lien partagé
  // retrouve la même vue, et la navigation ne perd pas la saisie.
  const [params, setParams] = useSearchParams()
  const [ipFilter, setIpFilter] = useState(() => params.get('ip') ?? '')
  const savedFilter = useRef(params.get('ip') ?? '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    try {
      const response = await fetch('/api/admin/sessions')
      const body = (await response.json()) as { sessions?: AdminSession[]; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'Chargement impossible.')
      setRows(body.sessions ?? [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.')
    }
  }

  const loadFailures = async (query: string) => {
    try {
      const response = await fetch(`/api/admin/failures${query ? `?ip=${encodeURIComponent(query)}` : ''}`)
      const body = (await response.json()) as { total?: number; attempts?: AdminFailure[]; error?: string }
      if (!response.ok) return
      setFailures({ total: body.total ?? 0, attempts: body.attempts ?? [] })
    } catch {
      // Les refus sont un complément : leur absence ne casse pas les sessions.
    }
  }

  const loadLogins = async (query: string) => {
    try {
      const response = await fetch(`/api/admin/logins${query ? `?ip=${encodeURIComponent(query)}` : ''}`)
      const body = (await response.json()) as { total?: number; logins?: AdminLogin[]; error?: string }
      if (!response.ok) return
      setLogins({ total: body.total ?? 0, rows: body.logins ?? [] })
    } catch {
      // Même principe que les refus : un journal absent ne casse pas l'écran.
    }
  }

  useEffect(() => {
    if (allowed) void load()
    // `allowed` suffit : les sessions se chargent à l'ouverture de l'écran.
  }, [allowed])

  useEffect(() => {
    if (!allowed) return
    // Le même filtre s'applique aux deux journaux, après un court temps de
    // frappe : inutile d'interroger le Worker ni de réécrire l'adresse à
    // chaque caractère.
    const timer = setTimeout(() => {
      const query = ipFilter.trim()
      if (savedFilter.current !== query) {
        savedFilter.current = query
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous)
            if (query) next.set('ip', query)
            else next.delete('ip')
            return next
          },
          { replace: true },
        )
      }
      void loadFailures(query)
      void loadLogins(query)
    }, 250)
    return () => clearTimeout(timer)
    // `params` est volontairement absent : l'écriture passe par une mise à jour
    // fonctionnelle, donc l'effet n'a pas besoin de relancer à chaque rendu.
  }, [allowed, ipFilter])

  if (!allowed) return null

  async function close(row: AdminSession) {
    if (busy) return
    const question = row.current ? 'Fermer cet appareil ? Vous serez déconnecté ici.' : 'Fermer cette session ? Cet appareil devra se reconnecter.'
    if (!window.confirm(question)) return
    setBusy(row.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/sessions/close', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string; current?: boolean }
      if (!response.ok) throw new Error(body.error ?? 'Fermeture impossible.')
      if (body.current) {
        onSignedOut()
        return
      }
      setNotice('Session fermée.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fermeture impossible.')
    } finally {
      setBusy('')
    }
  }

  /** Vide le journal : les refus ne servent qu'à constater, pas à être gardés.
   *  Le compteur anti-bruteforce vit dans une autre table et reste intact. */
  async function clearJournal() {
    if (busy) return
    if (!window.confirm('Vider le journal des tentatives refusées ? Cette action est définitive.')) return
    setBusy('failures')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/failures/clear', { method: 'POST' })
      const body = (await response.json().catch(() => ({}))) as { error?: string; cleared?: number }
      if (!response.ok) throw new Error(body.error ?? 'Suppression impossible.')
      const cleared = body.cleared ?? 0
      setNotice(
        cleared ? `Journal vidé : ${cleared} refus ${cleared > 1 ? 'supprimés' : 'supprimé'}.` : 'Le journal était déjà vide.',
      )
      await loadFailures(ipFilter.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.')
    } finally {
      setBusy('')
    }
  }

  const others = rows?.filter((row) => !row.current).length ?? 0

  async function closeOthers() {
    if (busy) return
    const question =
      others > 1
        ? `Fermer les ${others} autres sessions ? Ces appareils devront se reconnecter.`
        : "Fermer l'autre session ? Cet appareil devra se reconnecter."
    if (!window.confirm(question)) return
    setBusy('others')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/sessions/close-others', { method: 'POST' })
      const body = (await response.json().catch(() => ({}))) as { error?: string; closed?: number }
      if (!response.ok) throw new Error(body.error ?? 'Fermeture impossible.')
      const closed = body.closed ?? 0
      setNotice(closed > 1 ? `${closed} sessions fermées.` : '1 session fermée.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fermeture impossible.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="mt-8">
      {rows && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[13px] text-muted">
            {rows.length} session{rows.length > 1 ? 's' : ''} ouverte{rows.length > 1 ? 's' : ''}
          </p>
          {others > 0 && (
            <button
              type="button"
              onClick={() => void closeOthers()}
              disabled={Boolean(busy)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] text-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-50"
            >
              <LogOut className="size-3.5" />
              {busy === 'others' ? 'Fermeture…' : 'Fermer les autres'}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-4 text-[14px] text-accent">{error}</p>}
      {notice && (
        <p role="status" className="mt-4 text-[14px] text-muted">
          {notice}
        </p>
      )}
      {!rows && !error && <p className="mt-4 text-[14px] text-muted">Chargement des sessions…</p>}
      {rows && rows.length === 0 && (
        <p className="mt-3 text-[14px] text-muted">Aucune session ouverte. Une connexion en crée une pour sept jours.</p>
      )}

      <ul className="mt-6 divide-y divide-line">
        {rows?.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[14.5px]">
                {row.current ? 'Cet appareil' : 'Autre appareil'}
                {row.current && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-muted">session en cours</span>
                )}
              </p>
              <p className="mt-0.5 break-words text-[12.5px] text-muted">
                {row.device || 'Navigateur non reconnu'}
                {row.ip ? ` · ${row.ip}` : ''}
              </p>
              <p className="mt-0.5 text-[12.5px] text-faint">
                Ouverte le {shortDate(row.createdAt)} · expire le {shortDate(row.expiresAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void close(row)}
              disabled={busy === row.id}
              aria-label={row.current ? 'Fermer cet appareil' : 'Fermer cette session'}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] text-muted transition-colors hover:border-fg hover:text-fg disabled:opacity-50"
            >
              <LogOut className="size-3.5" />
              {busy === row.id ? 'Fermeture…' : 'Fermer'}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-line pt-6">
        <label htmlFor="ip-filter" className="block text-[13px] text-muted">
          Filtrer par adresse IP
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            id="ip-filter"
            type="search"
            value={ipFilter}
            onChange={(event) => setIpFilter(event.target.value)}
            placeholder="203.0.113.7 ou 2c0f:53c0"
            className="h-9 w-full max-w-xs rounded-full border border-line bg-transparent px-3.5 text-[14px] outline-none focus:border-fg"
          />
          {ipFilter.trim() && (
            <button
              type="button"
              onClick={() => setIpFilter('')}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] text-muted transition-colors hover:border-fg hover:text-fg"
            >
              <X className="size-3.5" />
              Effacer
            </button>
          )}
        </div>
        <p className="mt-2 text-[12.5px] text-faint">
          Un début d’adresse suffit. Le filtre s’applique aux connexions réussies et aux tentatives refusées.
        </p>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <h2 className="font-display text-[20px]">Connexions réussies</h2>
        <p className="mt-1 text-[13px] text-muted">
          Chaque connexion acceptée, la plus récente en haut, avec l’adresse et le navigateur d’où elle vient. L’historique reste
          après la fermeture des sessions ; il garde les 200 dernières connexions.
        </p>
        {!logins && <p className="mt-4 text-[14px] text-muted">Chargement de l’historique…</p>}
        {logins && logins.rows.length === 0 && (
          <p className="mt-4 text-[14px] text-muted">
            {ipFilter.trim()
              ? `Aucune connexion depuis une adresse contenant « ${ipFilter.trim()} ».`
              : 'Aucune connexion enregistrée pour l’instant.'}
          </p>
        )}
        {logins && logins.rows.length > 0 && (
          <>
            <p className="mt-4 text-[13px] text-muted">
              {logins.total} connexion{logins.total > 1 ? 's' : ''} au total, {logins.rows.length} plus récente
              {logins.rows.length > 1 ? 's' : ''} ci-dessous.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {logins.rows.map((login, index) => (
                <li key={`${login.at}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="break-words text-[14px]">
                    {login.ip || 'adresse inconnue'}
                    {login.device ? ` · ${login.device}` : ''}
                  </span>
                  <span className="text-[12.5px] text-faint">{shortDate(login.at)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-10 border-t border-line pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[20px]">Tentatives refusées</h2>
          {/* La purge vide tout le journal : sous filtre, elle tromperait sur ce
              qu'elle efface, donc elle reste hors filtre. */}
          {failures && failures.total > 0 && !ipFilter.trim() && (
            <button
              type="button"
              onClick={() => void clearJournal()}
              disabled={Boolean(busy)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              {busy === 'failures' ? 'Suppression…' : 'Vider le journal'}
            </button>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted">
          Les connexions refusées, la plus récente en haut. Aucun mot de passe tenté n’est enregistré ; le journal garde les
          200 derniers refus.
        </p>
        {!failures && <p className="mt-4 text-[14px] text-muted">Chargement du journal…</p>}
        {failures && failures.attempts.length === 0 && (
          <p className="mt-4 text-[14px] text-muted">
            {ipFilter.trim()
              ? `Aucun refus depuis une adresse contenant « ${ipFilter.trim()} ».`
              : 'Aucune tentative refusée pour l’instant.'}
          </p>
        )}
        {failures && failures.attempts.length > 0 && (
          <>
            <p className="mt-4 text-[13px] text-muted">
              {failures.total} refus au total, {failures.attempts.length} plus récent{failures.attempts.length > 1 ? 's' : ''} ci-dessous.
            </p>
            <ul className="mt-3 divide-y divide-line">
              {failures.attempts.map((attempt, index) => (
                <li key={`${attempt.at}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="break-words text-[14px]">{attempt.ip || 'adresse inconnue'}</span>
                  <span className="text-[12.5px] text-faint">
                    {shortDate(attempt.at)} ·{' '}
                    {attempt.reason === 'bloque' ? 'bloqué après huit essais' : 'mot de passe incorrect'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

/**
 * Connexion de l'admin : e-mail et mot de passe. Le formulaire remplace le
 * bouton Sign in with Freebuff ; la session est un cookie posé par le Worker.
 */
function AdminLogin({ onSignedIn }: { onSignedIn: () => Promise<void> | void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        setError(body.error || 'Connexion impossible pour le moment.')
        return
      }
      setPassword('')
      await onSignedIn()
    } catch {
      setError('Le serveur ne répond pas. Réessayez.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <p className="text-[14px] font-medium">Connexion requise</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Publier et modifier le catalogue demande le compte administrateur du site.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="admin-email" className={label}>
            E-mail
          </label>
          <input
            id="admin-email"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="admin-password" className={label}>
            Mot de passe
          </label>
          <input
            id="admin-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-[#a8452f]">
          {error}
        </p>
      )}

      <Button type="submit" loading={sending} className="self-start">
        <LogIn />
        Se connecter
      </Button>
    </form>
  )
}
