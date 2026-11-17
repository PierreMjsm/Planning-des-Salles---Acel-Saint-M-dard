# Semaine type, taux d'occupation et préparation de la rentrée

Conception validée le 15/11/2026 avec Pierre (ACEL Saint Médard).

## Intention

Deux besoins, une même page :

1. **Voir ce qui se passe dans une semaine normale.** Aujourd'hui, pour savoir ce
   qu'il y a « le mardi », il faut ouvrir une semaine réelle, qui contient des
   exceptions (vacances, annulations, stages). Une semaine type donne l'image
   stable de l'année.
2. **Préparer la rentrée.** En septembre, on reconduit les associations de
   l'année précédente et on place les nouvelles. Aujourd'hui, le bouton
   « Copier ces séries vers l'année suivante » (Réglages › Récurrences) copie
   tout, à l'aveugle, sans montrer ce qui reste libre.

S'y ajoutent des repères chiffrés demandés par Pierre : taux d'occupation par
salle et estimation des recettes par salle.

## Objectifs

- Une grille lundi→dimanche, une ligne par salle, construite à partir des séries
  hebdomadaires de l'année choisie, sans ressaisie.
- Les créneaux libres visibles d'un coup d'œil, pour placer une nouvelle
  association.
- Taux d'occupation et recettes estimées par salle, plus un total maison.
- Un assistant de rentrée : cocher les séries à reconduire, voir les conflits,
  puis voir la nouvelle grille.
- Un résumé des chiffres sur le tableau de bord.

## Non-objectifs

- Pas de comptabilité : les montants sont des estimations, jamais des chiffres
  officiels. Les relevés de frais restent la seule source de vérité.
- Pas d'historique ni de comparaison entre années (une page « Statistiques »
  a été écartée en conversation).
- Pas de glisser-déposer depuis la semaine type vers le planning réel.

## Anti-objectifs (ce qui ferait de cette page un échec)

- Un taux d'occupation que Pierre ne comprend pas ou auquel il ne croit pas :
  la règle de calcul doit être écrite à l'écran.
- Une estimation de recettes prise pour un montant comptable.
- Un assistant de rentrée qui crée des doublons ou écrase des séries
  existantes.

## Contraintes

- Logiciel existant : React + Vite + Electron, données en localStorage
  synchronisées par fichier partagé. Pas de nouvelle dépendance.
- Deux utilisateurs seulement (Katell et Pierre), ordinateur de bureau.
- Une quinzaine de salles : la grille doit tenir à l'écran sans défilement
  horizontal.
- Les séries portent déjà `days[]`, `start`, `end`, `roomId`, `schoolYear` :
  la semaine type se déduit sans nouveau modèle de données.
- `DAY_START`/`DAY_END` (08:00–22:00) sont utilisés ailleurs (créneaux libres
  d'une journée) et ne doivent pas changer de sens.

## Approches envisagées

| Approche | Ce qu'elle donne | Pourquoi écartée ou retenue |
|---|---|---|
| **A. 4e vue de la page Planning** (retenue) | À côté de Salles, Mois, Jour. Réutilise la barre d'outils, le sélecteur d'année et les filtres. L'assistant de rentrée s'ouvre depuis cette vue. | Retenue : le menu du haut reste à six onglets (il sature déjà à 1366 px), et Pierre regarde son planning à cet endroit. |
| **B. Nouvel onglet dans le menu du haut** | Page autonome, plus visible. | Écartée : septième onglet, menu serré, et doublon de barre d'outils. |
| **C. Panneau dans Réglages** | Simple à poser. | Écartée : c'est un outil de travail quotidien, pas un réglage. |

## Décisions

### Ce que montre la grille

- **Source : les séries hebdomadaires** (`RecurringBooking`) de l'année
  sélectionnée. Une série qui porte plusieurs jours apparaît dans chaque
  colonne concernée. Les séries marquées « pas de séance pendant les
  vacances » restent affichées : la semaine type décrit une semaine ordinaire.
- **Les stages et les réservations ponctuelles ne sont pas dans la grille**
  (choix de l'auteur) : ce sont des exceptions, elles brouilleraient l'image.
  Une ligne de pied de grille les rappelle : « + 4 stages et 37 réservations
  ponctuelles cette année », et elles comptent dans l'estimation des recettes.
- **Créneaux libres** : calculés par salle et par jour dans l'amplitude de la
  salle, avec la fonction `freeSlots` existante. Affichés en clair, cliquables
  pour créer une série sur ce créneau.

### Taux d'occupation

- Nouvelle amplitude d'ouverture **par salle** : `openStart` / `openEnd`,
  valeurs par défaut **08:00–23:00**, réglables dans Réglages › Salles.
- Dénominateur : amplitude × **lundi au samedi** (6 jours). Le dimanche n'entre
  dans le calcul que si la salle y a au moins une séance.
- Numérateur : heures des séries de la semaine type, bornées à l'amplitude.
  Une séance qui déborde après 23h compte comme pleine ; le taux est plafonné
  à 100 %.
- La règle est écrite sous la grille, en une phrase.

### Estimation des recettes

- Calculée sur les **séances réelles de l'année** (séries développées,
  réservations ponctuelles, stages), pas sur la semaine type multipliée.
- Tarif horaire de la salle (avec le coefficient de l'association) pour les
  séances horaires, prix fixe pour les copropriétés, prix par jour pour les
  stages. Mêmes règles que les relevés de frais, pour éviter deux vérités.
- Les séances annulées et exonérées sont exclues.
- Toujours présentée comme une estimation (« ≈ », et une note sous le total).

### Assistant de rentrée

- Ouvert par un bouton de la semaine type : « Préparer la rentrée 2027-2028 ».
- Liste les séries de l'année en cours, cochées par défaut, avec association,
  salle, jours et horaires. Décocher laisse la série de côté.
- Décale les dates d'une année scolaire (52 semaines, comme la fonction
  actuelle), vide les exceptions et les séances annulées.
- **Conflits** : une série dont le créneau est déjà pris dans l'année cible est
  signalée en rouge et décochée d'office ; Pierre peut forcer.
- **Doublons** : une série identique déjà présente dans l'année cible est
  détectée (même association, salle, jour, horaire) et marquée « déjà
  reconduite ».
- Remplace le bouton « Copier ces séries vers l'année suivante » des réglages.
- L'action est annulable (`undoable`), comme le reste du logiciel.

### Tableau de bord

- Une ligne de résumé : taux d'occupation moyen de la maison et recettes
  estimées de l'année, avec un lien vers la semaine type.

### Associations de l'année suivante (correction d'un défaut existant)

Les associations sont enregistrées par année scolaire. La fonction actuelle
« Copier ces séries vers l'année suivante » décale les dates mais garde
`associationId`, qui pointe vers la fiche de l'**ancienne** année : la série
copiée se retrouve rattachée à une association absente de la liste de la
nouvelle année.

L'assistant de rentrée corrige cela : pour chaque série reconduite, il cherche
dans l'année cible une association de même nom (sans tenir compte de la casse),
la crée si elle n'existe pas en reprenant couleur, coefficient de tarif,
contact, e-mail et fréquence de relevés, puis rattache la série à cette
nouvelle fiche. Les associations recréées sont listées dans le récapitulatif
de l'assistant.

### Points réglés par l'auteur après relecture

- **Filtres** : les filtres de salle et d'association de la barre d'outils
  s'appliquent à la semaine type. Les séries refusées sont exclues ; les séries
  en attente de validation sont affichées en pointillé, comme ailleurs.
- **Clic sur un créneau libre** : ouvre le formulaire de réservation,
  pré-rempli avec la salle, le jour de la semaine, les horaires du trou,
  « Répéter » coché et les dates de l'année scolaire affichée.
- **Recettes d'un stage** : le prix par jour est réparti à parts égales entre
  les salles de l'étage, pour que le total maison reste juste.
- **Année cible de la rentrée** : l'année affichée + 1, nommée en toutes
  lettres sur le bouton et dans l'assistant.
- **Salle sans aucune séance** : la ligne reste affichée, à 0 %, avec la
  mention « libre toute la semaine ».

## Laissé au constructeur

- Disposition exacte des cellules (nom + horaires) et gestion des salles sans
  aucune séance.
- Couleurs : réutiliser la palette par association déjà en place.
- Impression de la semaine type : utile mais non demandée ; à faire seulement
  si elle sort gratuitement de la mise en page existante.
