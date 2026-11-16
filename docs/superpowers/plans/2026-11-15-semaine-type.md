# Semaine type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter au logiciel une vue « Semaine type » (4e vue de la page Planning) montrant la semaine ordinaire déduite des séries, les créneaux libres, le taux d'occupation et les recettes estimées par salle, plus un assistant de rentrée qui reconduit les séries vers l'année suivante.

**Architecture:** Un module de calcul pur (`src/lib/planner/typicalweek.js`) ne dépendant que des données déjà en mémoire ; un composant de grille dans `src/components/Views.jsx` branché comme 4e valeur de `view` dans `src/pages/Planning.jsx` ; un assistant de rentrée en fenêtre modale appuyé sur une nouvelle fonction du contexte. Aucune nouvelle dépendance.

**Tech Stack:** React 18, Vite, esbuild pour les bundles de test, Playwright (`/opt/npm-tools/node_modules/playwright`) pour les tests d'interface, Node pour les tests unitaires des fonctions pures.

**Spec:** `docs/superpowers/specs/2026-11-15-semaine-type-design.md`

## Global Constraints

- Amplitude d'ouverture par défaut d'une salle : **08:00–23:00** (`DEFAULT_OPEN_START` / `DEFAULT_OPEN_END`). `DAY_START`/`DAY_END` (08:00–22:00) gardent leur sens actuel ailleurs.
- Dénominateur du taux d'occupation : amplitude × **lundi→samedi** (6 jours) ; le dimanche n'entre dans le dénominateur que si la salle y a au moins une séance.
- Taux plafonné à 100 % ; les heures hors amplitude sont ramenées dans l'amplitude.
- Recettes : calculées sur les séances réelles de l'année, avec les mêmes règles que les relevés (`applicableRate`, prix copro de la salle, prix par jour du stage réparti à parts égales entre les salles de l'étage). Toujours affichées précédées de « ≈ ».
- Séries refusées (`status === "annule"`) exclues de la grille et des chiffres ; séries `a_confirmer` affichées en pointillé.
- Textes en français, vouvoiement interdit dans l'interface (le logiciel tutoie ou reste neutre, comme l'existant).
- Toute action qui modifie les données passe par `P.undoable(...)`.

## Review Focus

1. **Année sans aucune série** : la grille doit s'afficher vide avec 0 % partout, sans division par zéro (Tâche 1, test `occupancy sans séance`).
2. **Série à cheval sur l'amplitude** (7h30–9h00 dans une salle ouverte à 8h) : seules les heures dans l'amplitude comptent (Tâche 1, test `heures bornées à l'amplitude`).
3. **Série du dimanche** : le dimanche entre dans le dénominateur de cette salle seulement (Tâche 1, test `dimanche compté si occupé`).
4. **Stage à cheval sur deux salles** : le prix du jour ne doit pas être compté deux fois dans le total maison (Tâche 1, test `prix de stage réparti`).
5. **Reconduction en conflit** : une série dont le créneau est déjà pris l'année suivante est signalée et non créée tant qu'elle n'est pas forcée (Tâche 4, test Playwright `conflit signalé`).

---

### Task 1 : Module de calcul `typicalweek.js`

**Files:**
- Create: `src/lib/planner/typicalweek.js`
- Test: `scratchpad/t/unit-tw.mjs` (bundle esbuild puis `node`)

**Interfaces:**
- Consumes: `durationHours`, `applicableRate`, `round2`, `activeSessions` de `occurrences.js` ; `freeSlots` de `occurrences.js` ; `isCoproAssoc`, `coproPrice` de `billing.js`.
- Produces :
  - `roomOpen(room) -> { start: "08:00", end: "23:00" }`
  - `weekGrid({ recurring, rooms, associations, filters }) -> [{ room, days: [[{ id, name, start, end, status, colorIdx, seriesId }]×7], free: [["08:00–18:00", …]×7], hours }]`
  - `occupancy(roomRow) -> { pct, busyHours, openHours, sundayCounted }`
  - `revenueByRoom({ sessions, stages, rooms, associations, floors }) -> Map(roomId -> number)`

- [ ] **Step 1 : écrire les tests unitaires**

```js
// unit-tw.mjs — valeurs attendues
roomOpen({}) === { start: "08:00", end: "23:00" }
roomOpen({ openStart: "09:00", openEnd: "22:00" }).start === "09:00"
// heures bornées à l'amplitude : série 07:30–09:00 dans une salle 08:00–23:00 → 1 h
// occupancy sans séance : pct === 0, openHours === 90 (15 h × 6 jours)
// dimanche compté si occupé : une série le dimanche → openHours === 105
// prix de stage réparti : stage 300 €/jour sur 2 salles → 150 € par salle
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue** (`node unit-tw.out.mjs` → erreur d'import)
- [ ] **Step 3 : écrire `src/lib/planner/typicalweek.js`** avec les quatre fonctions ci-dessus. `weekGrid` lit `days[]` (ou `weekday` si `days` est vide) ; `occupancy` applique les contraintes globales ; `revenueByRoom` répartit `stage.dayPrice / stage.roomIds.length`.
- [ ] **Step 4 : relancer, tout doit passer**
- [ ] **Step 5 : commit** `feat: calcul de la semaine type et des taux d'occupation`

---

### Task 2 : Amplitude d'ouverture par salle

**Files:**
- Modify: `src/lib/planner/constants.js` (ajout `DEFAULT_OPEN_START`, `DEFAULT_OPEN_END`)
- Modify: `src/components/SettingsModal.jsx` (ligne de champs de la salle, après « Capacité »)
- Modify: `src/lib/planner/changelog.js` (libellés `openStart`, `openEnd`)

**Interfaces:**
- Consumes: `roomOpen` (Tâche 1) pour la valeur affichée par défaut.
- Produces: champs `Room.openStart` / `Room.openEnd` (chaînes « HH:MM », vides = valeur par défaut).

- [ ] **Step 1 : ajouter les constantes et les deux champs horaires** (`TimeInput`), libellé « Ouverture », avec une aide « sert au taux d'occupation ».
- [ ] **Step 2 : vérifier à l'écran** (Playwright : les deux champs existent dans Réglages › Salles, la saisie est conservée après rechargement)
- [ ] **Step 3 : commit** `feat: amplitude d'ouverture par salle`

---

### Task 3 : La grille « Semaine type »

**Files:**
- Modify: `src/components/Views.jsx` (nouveau composant exporté `TypicalWeekView`)
- Modify: `src/pages/Planning.jsx` (4e bouton de vue, titre, rendu)
- Modify: `src/index.css` (classes `.tw-*`)

**Interfaces:**
- Consumes: `weekGrid`, `occupancy`, `revenueByRoom` (Tâche 1) ; `roomOpen` (Tâche 1).
- Produces: `TypicalWeekView({ filters, onNewSeries })` où `onNewSeries({ roomId, weekday, start, end })` ouvre le formulaire de réservation prérempli.

- [ ] **Step 1 : écrire le test Playwright** `test30.js` : avec trois séries connues, la grille affiche une ligne par salle, les bons noms dans les bonnes colonnes, un taux attendu et un total maison.
- [ ] **Step 2 : lancer, vérifier l'échec** (le bouton « Semaine type » n'existe pas)
- [ ] **Step 3 : écrire `TypicalWeekView`** : en-tête Lun→Dim + colonnes « Occup. » et « ≈ Recettes » ; cellules colorées par association ; créneaux libres en clair et cliquables ; pied de grille avec le total maison, le rappel des stages et réservations ponctuelles, et la phrase de règle de calcul.
- [ ] **Step 4 : brancher la 4e vue** dans `Planning.jsx` : `[["room","Salles"],["month","Mois"],["day","Jour"],["typical","Semaine type"]]`, titre « Semaine type · <année> », barre de navigation de dates masquée dans cette vue.
- [ ] **Step 5 : relancer le test, tout doit passer**
- [ ] **Step 6 : commit** `feat: vue semaine type`

---

### Task 4 : Assistant de rentrée

**Files:**
- Create: `src/components/RentreeModal.jsx`
- Modify: `src/lib/planner/PlannerContext.jsx` (remplace `copyRecurringToNextYear`)
- Modify: `src/components/SettingsModal.jsx` (retrait du bouton « Copier ces séries »)

**Interfaces:**
- Consumes: `weekGrid` (Tâche 1) pour la grille de l'année cible ; `activeSessions`, `timesOverlap` de `occurrences.js`.
- Produces :
  - `P.rentreePreview(targetYear) -> [{ series, name, roomName, dayLabel, timeLabel, conflict: null | "<libellé>", duplicate: boolean }]`
  - `P.carryOverSeries(ids, targetYear) -> { created: n, associations: [noms] }`

- [ ] **Step 1 : écrire le test Playwright** `test31.js` : conflit signalé et décoché ; doublon marqué ; après validation, les séries existent dans l'année cible, en attente de validation, rattachées à une association de l'année cible portant le même nom ; action annulable.
- [ ] **Step 2 : lancer, vérifier l'échec**
- [ ] **Step 3 : écrire `rentreePreview` et `carryOverSeries`** dans le contexte. `carryOverSeries` : décale de 364 jours, vide `exceptions`, met `status: "a_confirmer"`, retrouve ou crée la fiche d'association de l'année cible (même nom, casse ignorée, en reprenant `colorIdx`, `rateCoef`, `isExternal`, `contact`, `email`, `billingFreq`, `skipVacations`), puis rattache la série à cette fiche. Le tout dans un seul `undoable`.
- [ ] **Step 4 : écrire `RentreeModal`** : liste à cocher, conflits en rouge décochés avec une case « forcer », doublons grisés, récapitulatif final avec les associations recréées.
- [ ] **Step 5 : ouvrir l'assistant depuis la semaine type** (bouton « Préparer la rentrée <année+1> ») et retirer l'ancien bouton des réglages.
- [ ] **Step 6 : relancer le test, tout doit passer**
- [ ] **Step 7 : commit** `feat: assistant de rentrée`

---

### Task 5 : Résumé au tableau de bord

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `occupancy`, `revenueByRoom` (Tâche 1).

- [ ] **Step 1 : ajouter deux tuiles** : « Occupation moyenne » (pourcentage maison) et « Recettes estimées » (année), avec un lien « Voir la semaine type ».
- [ ] **Step 2 : vérifier à l'écran** (Playwright : les deux tuiles affichent les mêmes valeurs que la semaine type)
- [ ] **Step 3 : commit** `feat: occupation et recettes au tableau de bord`

---

### Task 6 : Régression et livraison

- [ ] **Step 1 : relancer toute la série de tests** `test7 … test31` ; aucun `FAIL`, aucune erreur de page.
- [ ] **Step 2 : capture d'écran de la semaine type** et relecture visuelle (lisibilité à 1366 px, pas de défilement horizontal).
- [ ] **Step 3 : porter la version à 2.9.0** dans `package.json`, construire le zip, livrer.
