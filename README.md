# achat-cheval

Un catalogue de chevaux, poneys et ânes à la vente : des fiches lisibles —
race, sexe, âge, taille, discipline, prix, département — avec une photo par
cheval. Boutique filtrable par catégorie et prix, fiches détaillées, et un
formulaire de visite qui enregistre la demande en base et prévient le
propriétaire par e-mail.

## Run it

```sh
npm install        # ou bun install
npm run dev        # http://localhost:5173
npm run build      # dist/client (assets) + dist/store/index.js (Worker)
```

## Le catalogue

`src/data/products.ts` contient dix fiches (cinq chevaux, trois poneys, deux
ânes). Chacune porte `image: '/images/market/<slug>.jpg'` ; les fichiers
correspondants vivent dans `public/images/market`, une photo par fiche, livrée
avec le site — aucun appel à un service extérieur au chargement.

- Aucune fiche ne porte de lien, de badge ni de mention d'un autre site :
  tout ce qui s'affiche vient de ce dépôt.
- Pour ajouter ou modifier un cheval sans toucher au fichier, passez par
  `/admin` (plus bas). Pour corriger une fiche du fonds, éditez son entrée et
  déposez la photo dans `public/images/market`.
- Sans photo, la carte et la fiche retombent sur une plaque typographique
  (`mark`).

## Ajouter vos chevaux (`/admin`)

Ouvrez `/admin` et connectez-vous avec votre compte Freebuff, puis remplissez
la fiche : nom, prix, catégorie, race, sexe, âge, taille, discipline,
département, description, détails (une ligne par point) et photo. L'annonce
apparaît tout de suite dans la boutique avec le bouton « Organiser une
visite » — pas de crédit « annonce d'origine », puisque le cheval est à vous.

- La fiche part dans la table D1 `listings`, la photo dans le bucket R2 lié à
  `FILES` (clé `listings/<id>.<ext>`) et sort par `/api/photo/:id` avec un
  cache d'un an. Supprimer l'annonce supprime la photo.
- La connexion est **Sign in with Freebuff** : aucun mot de passe, aucun
  secret à stocker. `@freebuff/auth` sert `/auth/freebuff/*` et signe une
  session en cookie httpOnly ; le Worker lit le compte avec `getUser()`.
- La première connexion revendique le catalogue : la table `site_owner`
  retient son identifiant Freebuff. Ensuite, tout autre compte peut se
  connecter mais reçoit 403 sur les écritures. Pour changer de propriétaire,
  videz cette table (une seule ligne).
- Chaque écriture vérifie aussi l'origine de la requête (`isSameOriginRequest`)
  et le propriétaire de la ligne (`owner_id`), jamais un identifiant envoyé
  par le client. Les refus sont 401 (pas connecté) ou 403 (autre compte,
  autre origine).
- Photo : 8 Mo maximum, JPG, PNG ou WebP.

### Modifier ou retirer une annonce

Sous le formulaire, « Vos chevaux en ligne » liste vos fiches. Le crayon
recharge la fiche dans le formulaire : changez ce qui a bougé, déposez une
nouvelle photo (ou cochez « Retirer la photo actuelle ») puis enregistrez.
L'adresse de la fiche ne change pas, un lien déjà partagé continue de marcher.
`PUT /api/listings/:id` fait la mise à jour, `DELETE /api/listings/:id`
supprime la fiche et sa photo.

Chaque modification change le suffixe `?v=` de l'URL de photo : le cache d'un
an des images ne sert donc jamais une ancienne version.

## Les demandes

Le formulaire d'une fiche envoie le nom, le téléphone, le message et la fiche
concernée à `POST /api/enquiries`. Le Worker valide, écrit la ligne dans la
table D1 `enquiries` (binding `DB`, créée au premier envoi) puis prévient le
propriétaire par e-mail via Resend. Sans clé Resend, la demande est quand même
enregistrée : la notification est un bonus, pas une condition de succès.

- En local : copiez `.dev.vars.example` en `.dev.vars` et remplissez
  `RESEND_API_KEY` et `ENQUIRY_NOTIFY_EMAIL` (facultatif :
  `ENQUIRY_FROM_EMAIL`).
- En production : mêmes noms de variables dans Sites → Secrets, après le
  premier déploiement.
- L'expéditeur par défaut (`onboarding@resend.dev`) n'écrit qu'à l'adresse du
  compte Resend. Vérifiez un domaine puis réglez `ENQUIRY_FROM_EMAIL` pour
  recevoir les alertes où vous voulez.

Relire les demandes enregistrées en local :

```sh
npx wrangler d1 execute achat-cheval --local \
  --command "select created_at, animal, name, phone, message from enquiries order by created_at desc"
```

## Make it yours

- `src/data/products.ts` est le catalogue du fonds : catégories (chevaux,
  poneys, autres), fiches, prix en euros et textes. Photos de catalogue dans
  `public/images/market`, images d'ambiance dans `public/images` (`ulysse`,
  `praline`, `selle`, `tapis`, `filet` et `brosse` ne servent plus).
- `src/app/pages/*` sont les écrans ; `src/app/components/*` les pièces
  (nav, panier, carte produit, formulaire, footer, primitives).
- `src/styles.css` contient les tokens : fond crème, encre, un accent
  terracotta, Instrument Serif pour le display et Inter pour le reste.
- `src/worker/index.ts` gère `/api/me`, `/api/listings`, `/api/photo/:id`,
  `/api/enquiries` (D1 + Resend) et `/api/newsletter`, et enveloppe le tout
  dans `auth.wrap(...)` pour `/auth/freebuff/*`.
- Le panier et la caisse restent en place pour de la sellerie : avec les
  fiches actuelles ils restent vides, l'état vide est géré.

## Deploy with Freebuff Sites

`deploy.json` points at the build output. After `npm run build`, deploy with
the `sites_deploy` tool from this directory.

Deux stockages doivent exister côté hébergement avant le premier envoi :
une base D1 nommée `DB` et un bucket R2 nommé `FILES` pour l'environnement
visé (Sites → Storage, ou `sites_add_storage`) puis un redéploiement pour
attacher les bindings. Sans `DB`, l'enregistrement d'une demande répond 500 ;
sans `FILES`, la publication d'un cheval échoue. Les pages restent lisibles
dans les deux cas.

La connexion se prépare avec `sites_enable_auth` sur le site (déjà fait pour
`preview`, avec un client de développement pour `http://localhost:5173`). Le
déploiement injecte `FREEBUFF_CLIENT_ID`, `FREEBUFF_ISSUER` et `APP_ORIGIN` :
ne les mettez pas dans les secrets, et ne réutilisez pas le client de
développement en production. Le retour de connexion est toujours
`/auth/freebuff/callback` sur l'origine exacte du site.
