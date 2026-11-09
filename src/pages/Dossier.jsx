import React from "react";
export default function Dossier() {
  const S = ({ t, children }) => <div className="card" style={{ marginBottom: 10 }}><h3 className="serif" style={{ marginBottom: 6 }}>{t}</h3>{children}</div>;
  return (
    <div>
      <h2 className="serif" style={{ marginBottom: 10 }}>Dossier de référence</h2>
      <S t="Principe"><p>Planning annuel des salles par année scolaire (1er septembre → 31 août). Salles, modèles et organisation sont communs à toutes les années ; associations, séries, factures et fermetures dépendent de l'année choisie.</p></S>
      <S t="Statuts"><p><b>Validation</b> : Validée · En attente de validation (bordure rouge pointillée dans le planning) · Refusée (grisée, ignorée des conflits et de la facturation).</p><p><b>Paiement</b> : Non payé (point rouge) · Payé · Gratuit / Exonéré (jamais facturé).</p></S>
      <S t="Tarification"><p>Tarif horaire de la salle → tarif week-end si samedi/dimanche → tarif externe si l'association est externe → coefficient de l'association (en %). Les lignes de facture sont regroupées par salle et par tarif ; seules les séances validées et non exonérées sont facturées.</p></S>
      <S t="Récurrences"><p>Chaque semaine, du lundi au vendredi ou tous les jours, avec séances annulées individuellement, « Déplacer ce jour » et « Arrêter la série ici ».</p></S>
      <S t="Fiche du jour"><p>Planning → « Fiche du jour » : 5 activités par page, avec la manière d'accéder à chaque salle (à saisir dans Réglages → Salles).</p></S>
      <S t="Données"><p>Enregistrées localement dans l'application. Sauvegarde/restauration JSON dans Réglages → Organisation. Les modifications sont signées Katell ou Pierre dans l'Historique.</p></S>
    </div>
  );
}
