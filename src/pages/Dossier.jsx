import React from "react";
export default function Dossier() {
  const S = ({ t, children }) => <div className="card" style={{ marginBottom: 10 }}><h3 className="serif" style={{ marginBottom: 6 }}>{t}</h3>{children}</div>;
  return (
    <div>
      <h2 className="serif" style={{ marginBottom: 10 }}>Dossier de référence</h2>
      <S t="Principe"><p>Planning annuel des salles par année scolaire (1er septembre → 31 août). Salles, modèles et organisation sont communs à toutes les années ; associations, séries, relevés de frais et fermetures dépendent de l'année choisie.</p></S>
      <S t="Statuts"><p><b>Validation</b> : Validée · En attente de validation (bordure rouge pointillée dans le planning) · Refusée (grisée, ignorée des conflits et des relevés de frais).</p><p><b>Paiement</b> : Non payé (point rouge) · Payé · Gratuit / Exonéré (jamais facturé).</p></S>
      <S t="Relevés de frais (pas de TVA)"><p><b>Association</b> : une ligne par séance (date, heures, prix/heure), adhésion en option, RIB en bas. Tarif horaire de la salle → tarif week-end → tarif externe → coefficient de l'association.</p><p><b>Copropriété</b> : prix fixe par réservation (375 €, 480 € ou autre), quelle que soit la salle.</p><p><b>Stage BAFA</b> : nombre de jours × prix par étage (3ème et 2ème étage 300 €, Bords de Bièvre et Carré Censier 200 € par défaut), regroupés par prix. Seules les séances validées et non gratuites sont comptées.</p></S>
      <S t="Récurrences"><p>Chaque semaine, du lundi au vendredi ou tous les jours, avec séances annulées individuellement, « Déplacer ce jour » et « Arrêter la série ici ».</p></S>
      <S t="Fiche du jour"><p>Planning → « Fiche du jour » : 5 activités par page, avec la manière d'accéder à chaque salle (à saisir dans Réglages → Salles).</p></S>
      <S t="Annuler (Ctrl+Z)"><p>Le bouton ↶ en haut à droite, ou <b>Ctrl+Z</b>, revient sur les <b>20 dernières actions annulables</b> : suppressions, import d'un planning, nettoyage, archivage, reconduction de rentrée, création de plusieurs dates en une fois. Répéter Ctrl+Z remonte le fil ; l'infobulle du bouton indique ce qui sera annulé et combien d'actions restent en mémoire.</p><p>Trois limites : une simple création ou modification de réservation n'est pas annulable (il faut la rouvrir et la corriger) ; la mémoire est effacée dès que l'autre poste envoie ses données ; et une saisie faite à la main après coup met fin à l'annulation des actions portant sur les mêmes données, pour ne jamais effacer ce nouveau travail.</p></S>
      <S t="Données"><p>Enregistrées localement dans l'application. Sauvegarde/restauration JSON dans Réglages → Organisation. Les modifications sont signées Katell ou Pierre dans l'Historique.</p></S>
    </div>
  );
}
