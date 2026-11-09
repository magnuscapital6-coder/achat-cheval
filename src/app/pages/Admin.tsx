import { Check, ImagePlus, LogIn, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'

import { categories, type Category } from '../../data/products'
import { Button, Container, inputClass } from '../components/ui'
import { money } from '../lib/cart'
import { useCatalogue, type OwnListing } from '../lib/catalogue'

type Session = {
  user: { sub: string; name?: string; email?: string } | null
  owner: boolean
}

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

  const signedIn = Boolean(session?.user)
  const allowed = Boolean(session?.owner)
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
        {editing ? 'Modifier cette annonce' : 'Ajouter un cheval'}
      </h1>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
        {editing
          ? 'Changez ce qui a bougé — prix, âge, photo — puis enregistrez. L’adresse de la fiche ne change pas.'
          : 'Renseignez la fiche et déposez une photo : elle apparaît dans la boutique dès l’enregistrement, avec le formulaire de visite.'}
      </p>

      <div className="mt-8 rounded-dialog border border-line bg-surface p-5 sm:p-6">
        {signedIn ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">
                {session.user?.name || session.user?.email || 'Compte connecté'}
              </p>
              <p className="mt-0.5 text-[12.5px] text-faint">
                {session.user?.email && session.user?.name ? session.user.email : 'Sign in with Freebuff'}
              </p>
            </div>
            <form method="post" action="/auth/freebuff/signout">
              <button type="submit" className="text-[13.5px] text-muted transition-colors hover:text-fg">
                Se déconnecter
              </button>
            </form>
          </div>
        ) : (
          <>
            <p className="text-[14px] font-medium">Connexion requise</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Publier et modifier le catalogue demande un compte. Vous vous connectez avec votre compte Freebuff (Google,
              GitHub ou Apple) ; il n’y a pas de mot de passe à retenir.
            </p>
            <ButtonAnchorSignIn />
          </>
        )}
      </div>

      {signedIn && !allowed && (
        <p className="mt-6 rounded-control border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-relaxed text-muted">
          Ce catalogue est géré par un autre compte. Si c’est une erreur, déconnectez-vous et reconnectez-vous avec le
          compte qui l’a créé.
        </p>
      )}

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
    </Container>
  )
}

function ButtonAnchorSignIn() {
  return (
    <a
      href="/auth/freebuff/signin?returnTo=%2Fadmin"
      className="mt-5 inline-flex h-12 items-center gap-2 rounded-control bg-fg px-5 text-[15px] font-medium text-bg transition-colors hover:bg-[#33302b]"
    >
      <LogIn className="size-4" />
      Se connecter avec Freebuff
    </a>
  )
}
