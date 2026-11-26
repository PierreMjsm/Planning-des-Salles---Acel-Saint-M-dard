// Ce que le logiciel publie sur le réseau local pour l'écran du hall : l'horaire
// du jour et rien d'autre. Pas de note interne, pas de contact, pas de montant,
// pas d'historique — une page affichée dans un hall est lue par tout le monde.
const minsOf = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
// Fenêtre de nuit, qui enjambe minuit : de 23h00 à 08h00, l'écran du hall reste noir.
export function isNight(mins, from, to) {
  const a = minsOf(from), b = minsOf(to);
  if (a === null || b === null || a === b) return false;
  return a < b ? mins >= a && mins < b : mins >= a || mins < b;
}

export function publicSnapshot(db, today) {
  const d = db || {};
  const keep = (x) => x.status !== "annule";
  return {
    today,
    Room: (d.Room || []).map((r) => ({ id: r.id, name: r.name, accessInfo: r.accessInfo || "", colorIdx: r.colorIdx || 0 })),
    Association: (d.Association || []).map((a) => ({ id: a.id, name: a.name, colorIdx: a.colorIdx || 0, schoolYear: a.schoolYear })),
    Booking: (d.Booking || []).filter((b) => keep(b) && b.startDate <= today && b.endDate >= today).map((b) => ({
      id: b.id, associationId: b.associationId || "", customName: b.customName || "", roomId: b.roomId, roomIds: b.roomIds || null,
      startDate: b.startDate, endDate: b.endDate, start: b.start, end: b.end, status: b.status, stageId: b.stageId || "",
    })),
    RecurringBooking: (d.RecurringBooking || []).filter((r) => keep(r) && r.startDate <= today && r.endDate >= today).map((r) => ({
      id: r.id, associationId: r.associationId || "", customName: r.customName || "", roomId: r.roomId, roomIds: r.roomIds || null,
      startDate: r.startDate, endDate: r.endDate, start: r.start, end: r.end, status: r.status,
      frequency: r.frequency, days: r.days || [], weekday: r.weekday, exceptions: r.exceptions || [], skipVacations: !!r.skipVacations,
    })),
    Vacation: (d.Vacation || []).map((v) => ({ id: v.id, name: v.name, from: v.from, to: v.to, start: v.start, end: v.end })),
    DayNote: (d.DayNote || []).filter((n) => n.date === today).map((n) => ({ id: n.id, date: n.date, closed: !!n.closed })),
    OrganisationSettings: [(() => { const o = (d.OrganisationSettings || [])[0] || {}; return { name: o.name || "", displayTitle: o.displayTitle || "", displayTheme: o.displayTheme || "", displayNightFrom: o.displayNightFrom || "", displayNightTo: o.displayNightTo || "" }; })()],
  };
}
