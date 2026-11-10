# achat-cheval

[![Vérifications](https://github.com/magnuscapital6-coder/achat-cheval/actions/workflows/verifications.yml/badge.svg?branch=main)](https://github.com/magnuscapital6-coder/achat-cheval/actions/workflows/verifications.yml)

Un catalogue de chevaux, poneys et ânes à la vente : des fiches lisibles —
race, sexe, âge, taille, discipline, prix, département — avec une photo par
cheval. Boutique filtrable par catégorie et prix, fiches détaillées, et un
formulaire de visite qui enregistre la demande en base et prévient le
propriétaire par e-mail.

## Vérifications

`.github/workflows/verifications.yml` lance `npm run typecheck`, `npm test`
puis `npm run build` à chaque poussée, sur Node 24 ; une poussée rouge se voit
dans l'onglet Actions plutôt qu'au moment du déploiement.

`npm test` fait tourner les tests d'intégration de `test/api.spec.ts` dans
**workerd**, le runtime du Worker déployé, avec une base D1 et un bucket R2
émulés par Miniflare : le vrai handler, de vraies requêtes, un vrai SQL. Aucun
réseau, aucun secret de production. La configuration est dans
`vitest.config.ts` (identifiant d'admin de test, pas de clé Resend) et
`wrangler.test.jsonc` (même date de compatibilité que `wrangler.jsonc`, sans
les assets). Couvert : santé et sitemap, inscriptions (normalisation, doublon,
liste réservée), commandes (total recalculé depuis le catalogue, prix du
navigateur ignoré), demandes de visite, connexion admin (403 hors origine,
401 mauvais mot de passe, session listée et refermée), modèles (semis, édition,
validations) et envoi de messages (jetons remplis, journal `admin_messages`,
statut « sans clé »).

L'envoi réel est simulé : le test remplace `globalThis.fetch` le temps d'un cas
et répond à la place de Resend — succès (`200`, statut « envoye », en-tête
`Bearer`, objet et texte réellement transmis) comme refus (`422`, statut
« echec », message conservé). Aucun e-mail ne sort de la CI, et aucun réseau
donc aucun faux négatif si Resend tombe. Le badge en tête de ce
fichier affiche l'état du workflow sur `main` — `passing` ou `failing` — le
résultat du dernier commit poussé sur cette branche, et ouvre le workflow au
clic. GitHub ne sert ce badge que pour un dépôt public : le garder privé
renverrait une image cassée.

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

Ouvrez `/admin` et connectez-vous avec l'e-mail et le mot de passe de
l'administrateur, puis remplissez
la fiche : nom, prix, catégorie, race, sexe, âge, taille, discipline,
département, description, détails (une ligne par point) et photo. L'annonce
apparaît tout de suite dans la boutique avec le bouton « Organiser une
visite » — pas de crédit « annonce d'origine », puisque le cheval est à vous.

- La fiche part dans la table D1 `listings`, la photo dans le bucket R2 lié à
  `FILES` (clé `listings/<id>.<ext>`) et sort par `/api/photo/:id` avec un
  cache d'un an. Supprimer l'annonce supprime la photo.
- La connexion est un **e-mail et un mot de passe**, sans service externe.
  Le mot de passe n'est jamais stocké en clair : le secret `ADMIN_CREDENTIALS`
  contient l'e-mail et un condensat PBKDF2-SHA256 (sel, 60 000 itérations,
  empreinte hexadécimale). `POST /api/admin/login` recalcule l'empreinte et la
  compare en durée constante ; `POST /api/admin/logout` l'oublie. Le nombre
  d'itérations est plafonné par le CPU de l'hébergement : 210 000 dépassaient
  le budget et donnaient un 500, 60 000 tournent (environ 1,4 s par connexion).
- La session est un jeton aléatoire de 32 octets dans un cookie `HttpOnly`,
  `SameSite=Lax`, `Secure` en https, valable sept jours. La table
  `admin_sessions` n'en garde que l'empreinte SHA-256 : supprimer la ligne
  déconnecte l'appareil, y compris si le cookie a fuité. Les sessions périmées
  sont effacées à chaque connexion. L'onglet « Sessions » les liste
  (`GET /api/admin/sessions`) et ferme un appareil à la demande
  (`POST /api/admin/sessions/close`) ; une sixième connexion efface la plus
  ancienne, seules cinq sessions sont conservées ; fermer la sienne déconnecte le poste
  courant. `POST /api/admin/sessions/close-others` ferme tout sauf le poste
  qui demande, en un clic depuis le bouton « Fermer les autres ».
  L'écran ne montre que le début de l'empreinte, jamais le jeton.
  Sous la liste, « Connexions réussies » affiche les dernières connexions
  acceptées (`GET /api/admin/logins`) : date, adresse IP et navigateur
  (`user_agent`, libellé calculé comme pour les sessions), gardées même
  quand la session correspondante est fermée ou évincée (200 dernières).
  Un champ « Filtrer par adresse IP » porte sur les deux journaux : un début
  d'adresse suffit (`?ip=` sur les deux routes, comparé en minuscules sans
  joker SQL). Le filtre est écrit dans l'adresse de la page
  (`/admin?vue=sessions&ip=…`) : un rechargement ou un lien partagé retrouve
  la même vue.
  « Tentatives refusées » affiche ensuite les derniers refus de
  connexion (`GET /api/admin/failures`) : date, adresse IP et motif (mot de
  passe incorrect, ou blocage après huit essais). Le mot de passe tenté n'est
  jamais enregistré ; le journal garde les 200 derniers refus et le bouton
  « Vider le journal » les efface tous (`POST /api/admin/failures/clear`),
  sans toucher au compteur anti-bruteforce de la table `admin_attempts`.
  Chaque ligne retient aussi le navigateur (User-Agent, réduit à
  « Chrome · Windows ») et l'adresse IP de la connexion, pour reconnaître
  l'appareil ; ces champs restent vides pour les sessions ouvertes avant leur
  ajout, et l'écran l'indique au lieu de deviner.
- Huit échecs par adresse IP et par quart d'heure (`admin_attempts`) bloquent
  les tentatives suivantes (429). La route ne révèle pas si l'e-mail existe :
  la même réponse et le même temps de calcul valent dans les deux cas.
- Chaque écriture vérifie aussi l'origine de la requête (`isSameOriginRequest`) :
  un POST venu d'un autre site reçoit 403. Sans session valide, les routes
  réservées répondent 401. Un site à un seul administrateur n'a pas de notion
  de propriétaire par ligne : la session suffit.
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

### Changer le mot de passe

```bash
node scripts/hash-password.mjs 'nouveau mot de passe'
```

Le script affiche le JSON à recopier dans le secret `ADMIN_CREDENTIALS`
(Sites → Secrets, ou `sites_set_secret`). Il n'écrit rien sur le disque et
n'affiche jamais le mot de passe. Le déploiement suivant prend la nouvelle
valeur ; les sessions déjà ouvertes restent valables jusqu'à leur expiration,
car elles ne dépendent pas du mot de passe. Videz `admin_sessions` pour les
fermer tout de suite.

## L’admin

`/admin` s'ouvre sur « Vue d'ensemble » : demandes de visite, commandes (avec le
montant encaissé), inscriptions et visites de fiches, chacun en deux chiffres —
la semaine en cours et le cumul depuis l'ouverture (`GET /api/summary`,
calculé en base, réservé au propriétaire). La semaine va du lundi au dimanche,
en UTC. Les cartes sont suivies d'un petit graphique jour par jour — visites en
gris, demandes en noir, même échelle — dont les totaux tombent exactement sur
ceux des cartes ; les jours à venir y figurent grisés. Les autres écrans sont des onglets :
`?vue=annonces` pour le formulaire d'annonce, puis `?vue=demandes`,
`?vue=commandes`, `?vue=inscriptions`. Sans session valide, la page n'affiche
que le formulaire de connexion.

## Les demandes

Le formulaire d'une fiche envoie le nom, le téléphone, le message, le nom de
l'animal, le marché consulté et la fiche d'origine (`source`, le chemin de la
page au moment de l'envoi) à `POST /api/enquiries`. Le Worker ne garde que les
chemins internes, sans domaine ni paramètres : une valeur envoyée par le
navigateur ne peut pas devenir un lien sortant. Le Worker valide,
écrit la ligne dans la table D1 `enquiries` (binding `DB`, créée au premier
envoi) puis prévient le propriétaire par e-mail via Resend. Sans clé Resend, la
demande est quand même enregistrée : la notification est un bonus, pas une
condition de succès.

Les demandes se lisent dans `/admin`, onglet « Demandes de visite »
(`/admin?vue=demandes`) : de la plus récente à la plus ancienne, avec une vue
« Par marché », « Par fiche », un filtre par marché et un filtre par période
(7, 30 ou 90 jours).

« Par fiche » est le tableau de conversion : chaque annonce avec ses visites et
ses demandes, de la plus visitée à la moins visitée, plus le pourcentage de
visites qui aboutit à une demande. Il porte sur toutes les demandes chargées,
tous marchés et toutes périodes — un taux de conversion n'a de sens qu'entre
deux mesures complètes — et les filtres ci-dessus ne s'y appliquent donc pas.
Il s'affiche aussi tant qu'aucune demande n'est arrivée : les visites seules
montrent déjà quelles annonces attirent l'œil.
Une même annonce consultée depuis plusieurs marchés compte une seule fois : les
chemins sont comparés sans leur préfixe de marché.

Les visites viennent d'un compteur public, `POST /api/views` : la fiche envoie
son chemin à l'ouverture, une seule fois par session et par annonce (un
rechargement ne gonfle pas le compteur), et les robots d'indexation sont
ignorés d'après leur `User-Agent`. Le Worker ramène le chemin à la fiche sans
préfixe de marché, ne retient que les `/product/…` et incrémente la table D1
`fiche_views` (le total par fiche) et `fiche_view_days` (le même compteur par
jour, pour le résumé de la semaine). Le compteur ne démarre qu'à partir de sa
mise en service : une fiche ancienne peut afficher plus de demandes que de
visites, donc un pourcentage supérieur à 100 % au début. Les visites du propriétaire comptent
comme les autres.

Chaque demande rappelle d'où elle vient : le marché, puis un lien « Depuis
/fr-be/product/… » vers la fiche concernée (et « Fiche d'origine non transmise »
pour les demandes antérieures à ce champ).
Demandes et visites sont réservées au propriétaire
(`GET /api/enquiries`, `GET /api/views`). Les onglets « Commandes » et
« Inscriptions » suivent le même principe.
Un marché inconnu — ou une demande reçue avant l'ajout de la colonne — tombe
dans « Marché non identifié » plutôt que d'être perdue.

- En local : copiez `.dev.vars.example` en `.dev.vars` et remplissez
  `RESEND_API_KEY` et `ENQUIRY_NOTIFY_EMAIL` (facultatif :
  `ENQUIRY_FROM_EMAIL`).
- En production : mêmes noms de variables dans Sites → Secrets, après le
  premier déploiement.
- L'expéditeur par défaut (`onboarding@resend.dev`) n'écrit qu'à l'adresse du
  compte Resend. Vérifiez un domaine puis réglez `ENQUIRY_FROM_EMAIL` pour
  recevoir les alertes où vous voulez.

### Commandes et inscriptions

Deux autres formulaires écrivaient sans rien garder ; c'est corrigé.

- `POST /api/orders` enregistre la commande dans la table `orders` (référence,
  e-mail, lignes, total, marché, date). **Les prix ne viennent pas du
  navigateur** : le Worker relit chaque fiche du catalogue, ignore un article
  inconnu et recalcule le total, frais de port compris (`FREE_SHIPPING_AT`).
  Le propriétaire reçoit une alerte, l'acheteur un accusé de réception avec sa
  référence. Le paiement reste une démonstration : branchez Stripe dans le même
  handler quand vous voudrez encaisser.
- `POST /api/newsletter` écrit l'adresse dans la table `subscribers` (adresse
  normalisée en minuscules, unique, avec le marché d'inscription). Réinscrire
  une adresse connue répond `ok` sans rien dire de plus.

Les deux listes se lisent dans `/admin`, sous « Commandes » et « Inscriptions ».
Quand un e-mail d'alerte n'est pas parti, la ligne le dit (« Alerte e-mail non
envoyée ») au lieu de laisser l'échec dans les logs : c'est le repère à
surveiller si Resend est mal configuré.

### Écrire aux clients

L'admin écrit lui-même aux inscrits et aux acheteurs, sans quitter le site.

- « Inscriptions » : le bouton « Écrire » d'une ligne ouvre un message pour
  cette adresse. « Commandes » : « Écrire à l'acheteur » ouvre le même
  composeur avec la commande en contexte (référence, total, articles affichés
  sous le titre).
- Le texte part d'un **modèle éditable** (table `message_templates`, créés au
  premier usage) : bienvenue à l'inscription, nouvelles fiches de la semaine,
  relance de paiement, paiement reçu, commande expédiée. L'onglet « Modèles »
  les réécrit — l'objet et le corps enregistrés valent pour l'envoi suivant,
  sans redéploiement. Changer de modèle dans le composeur recharge l'objet et
  le texte ; les retouches faites ensuite partent telles quelles.
- Jetons remplacés à l'envoi : `{{email}}`, `{{date}}`, `{{boutique}}`,
  `{{lien}}`, et pour une commande `{{reference}}`, `{{total}}`,
  `{{articles}}`. La référence, les lignes et le total sont **relus en base** :
  ce qui part ne dépend pas des valeurs envoyées par le navigateur. Un jeton
  inconnu reste visible plutôt que d'être vidé en silence.
- `GET /api/admin/templates` lit les modèles, `PUT /api/admin/templates/:key`
  en enregistre un (objet ≤ 160 caractères, texte ≤ 5 000),
  `POST /api/admin/messages` envoie — ces trois routes demandent la session
  admin et la même origine que le reste de l'admin.
- Sans `RESEND_API_KEY`, ou si Resend refuse, le message est tout de même
  **journalisé** dans `admin_messages` et l'écran l'affiche : rien ne part
  silencieusement. Les 200 derniers envois gardent l'adresse, le modèle,
  l'objet, le texte réellement parti (jetons remplis) et leur statut.
- Les acheteurs n'ont pas de compte : le composeur écrit à l'adresse de la
  commande. Pour encaisser réellement, branchez Stripe dans le même handler et
  gardez ces modèles pour les relances.

Relire les demandes enregistrées en local :

```sh
npx wrangler d1 execute achat-cheval --local \
  --command "select created_at, market, animal, name, phone, message from enquiries order by created_at desc"
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
- `src/worker/index.ts` gère `/api/me`, `/api/admin/login`,
  `/api/admin/logout`, `/api/admin/sessions`,
  `/api/admin/sessions/close`, `/api/admin/sessions/close-others`,
  `/api/admin/failures`, `/api/admin/failures/clear`, `/api/admin/logins`,
  `/api/admin/templates`, `/api/admin/messages`,
  `/api/listings`,
  `/api/photo/:id`, `/api/enquiries`
  (D1 + Resend), `/api/views`, `/api/summary` et `/api/newsletter`.
- Le panier et la caisse restent en place pour de la sellerie : avec les
  fiches actuelles ils restent vides, l'état vide est géré.

## Langues et référencement

La boutique existe en six langues pour onze marchés. Chaque marché a sa propre
URL, ce qui lui donne ses balises `hreflang` et son contenu de page :

| Marché | Préfixe | Langue | hreflang |
| --- | --- | --- | --- |
| France | `/` | fr | `fr-FR` |
| Belgique | `/fr-be` | fr | `fr-BE` |
| Suisse romande | `/fr-ch` | fr | `fr-CH` |
| Luxembourg | `/fr-lu` | fr | `fr-LU` |
| Allemagne | `/de` | de | `de-DE` |
| Suisse alémanique | `/de-ch` | de | `de-CH` |
| Luxembourg (DE) | `/de-lu` | de | `de-LU` |
| Slovénie | `/sl` | sl | `sl-SI` |
| Australie | `/en-au` | en | `en-AU` |
| Danemark | `/da` | da | `da-DK` |
| Pays-Bas | `/nl` | nl | `nl-NL` |

- `src/data/locales.ts` liste les marchés ; `src/data/seo.ts` porte les titres
  et descriptions par marché, les alternates et les données structurées.
- `src/app/lib/i18n.tsx` contient le dictionnaire (clés `domaine.cle`) et
  expose `t()`. Le marché se déduit de l'URL au chargement, et React Router
  travaille avec un `basename` : les liens restent écrits `/shop`, sans
  préfixe à répéter.
- `src/worker/seo.ts` réécrit l'en-tête d'`index.html` à chaque requête
  (titre, description, canonical, hreflang, Open Graph, JSON-LD) et sert
  `/sitemap.xml` et `/robots.txt`. Sans ce passage, une SPA renverrait le même
  titre sur toutes ses URL. Une URL inconnue y répond **404** avec `noindex`
  et sans canonical : l'app redirige ensuite vers l'accueil, mais le moteur a
  déjà lu le bon statut.
- `src/app/lib/useSeo.ts` refait la même mise à jour quand on navigue sans
  recharger.
- Les **annonces** (nom, description, détails d'un cheval) restent dans la
  langue où le propriétaire les a écrites : ce sont des données, pas de la
  copie. L'interface, les catégories, les formulaires et le pied de page sont
  traduits.
- Prix affichés en euros partout ; seul le formatage suit la langue
  (`12 500 €` en français, `12.500 €` en allemand et en slovène, `EUR 12,500`
  en anglais australien, `12.500 €` en danois, `€ 12.500` en néerlandais).
- Le sélecteur de marché (`Nav.tsx`) regroupe les onze marchés par langue via
  `MARKETS_BY_LANG` ; ajouter un marché dans `locales.ts` suffit à l'y faire
  apparaître.
- `docs/seo-marches.md` détaille la mise en index des onze marchés :
  préalables (prévisualisation à fermer aux robots), soumission dans Search
  Console, maillage inter-marchés et calendrier de suivi.

Pour ajouter une langue : une entrée dans `MARKETS`, un dictionnaire complet
dans `i18n.tsx` (TypeScript signale chaque clé manquante) et un jeu de textes
SEO dans `seo.ts`. Rien à toucher dans les pages.

## Deploy with Freebuff Sites

`deploy.json` points at the build output. After `npm run build`, deploy with
the `sites_deploy` tool from this directory.

Deux stockages doivent exister côté hébergement avant le premier envoi :
une base D1 nommée `DB` et un bucket R2 nommé `FILES` pour l'environnement
visé (Sites → Storage, ou `sites_add_storage`) puis un redéploiement pour
attacher les bindings. Sans `DB`, l'enregistrement d'une demande répond 500 ;
sans `FILES`, la publication d'un cheval échoue. Les pages restent lisibles
dans les deux cas.

La connexion admin demande un seul secret, `ADMIN_CREDENTIALS` : le JSON
`{"email", "salt", "iterations", "hash"}` produit par
`node scripts/hash-password.mjs`. Déployez une première fois, puis déposez-le
dans Sites → Secrets (ou avec `sites_set_secret`, à partir d'un fichier
privé — jamais dans le dépôt). Sans ce secret, `/api/admin/login` répond 503
et le reste du site fonctionne normalement. Le déploiement injecte
`APP_ORIGIN` tout seul ; ne le mettez pas dans les secrets.
