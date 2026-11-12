export const FIELD_LABELS = {
  name: "Nom", rate: "Tarif horaire", rateWeekend: "Tarif week-end", rateExternal: "Tarif externe", capacity: "Capacité",
  equipmentList: "Matériel", accessInfo: "Accès", colorIdx: "Couleur", isExternal: "Externe", rateCoef: "Coefficient",
  roomId: "Salle", associationId: "Association", customName: "Nom libre", startDate: "Premier jour", endDate: "Dernier jour",
  start: "Début", end: "Fin", status: "Statut", paymentStatus: "Paiement", participants: "Participants", contact: "Contact",
  equipment: "Matériel demandé", note: "Remarque", internalNote: "Note interne", frequency: "Fréquence", weekday: "Jour",
  label: "Motif", presence: "Présence", address: "Adresse", legal: "Mentions légales", invoicePrefix: "Préfixe",
  nextInvoiceNumber: "Prochain numéro", amountPaid: "Réglé", total: "Total", exceptions: "Exceptions", days: "Jours", floors: "Étages des stages", subtitle: "Sous-titre", phone: "Téléphone", website: "Site", siret: "SIRET", signatory: "Signataire", adhesionLabel: "Libellé adhésion", adhesionAmount: "Adhésion", fixedPrices: "Prix fixes", ribImage: "RIB", signImage: "Signature", billingMode: "Modèle de relevé", fixedPrice: "Prix fixe", billAdhesion: "Adhésion par défaut", opening: "Ouverture", closing: "Fermeture", absence: "Absence", closed: "Maison fermée", skipVacations: "Pas de séance pendant les vacances", billingFreq: "Fréquence des relevés", copropPrice: "Prix copropriété", staff: "Équipe", email: "E-mail", archiveDir: "Dossier d'archivage",
};
const IGNORED = new Set(["id", "created_date", "schoolYear", "sortOrder", "floorsFixed"]);
// Jamais d'image (signature, RIB) ni de texte interminable dans l'historique
const short = (t) => { const s = String(t); return /^data:/.test(s) ? "(image)" : s.length > 90 ? s.slice(0, 88) + "…" : s; };

export function diffDetail(before, after, resolve) {
  const changes = [];
  for (const k of Object.keys(after || {})) {
    if (IGNORED.has(k)) continue;
    const a = before ? before[k] : undefined;
    const b = after[k];
    if (JSON.stringify(a === undefined || a === null ? "" : a) === JSON.stringify(b === undefined || b === null ? "" : b)) continue;
    changes.push(`${FIELD_LABELS[k] || k} : ${short(resolve(k, a))} → ${short(resolve(k, b))}`);
  }
  return changes.slice(0, 4).join(" ; ");
}
