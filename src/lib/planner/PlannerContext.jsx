import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect } from "react";
import { loadAll, saveEntity, newId, exportJson, parseBackup, ENTITIES } from "./store.js";
import { download } from "./exports.js";
import { parseKey, todayKey, schoolYearOf, yearBounds, addDays, yearLabel } from "./dates.js";
import { sessionsInRange, round2 } from "./occurrences.js";
import { getSyncState, subscribeSync, onRemoteReload, reloadRemote, overwriteRemote, chooseFolder, adoptFolder, revertFolder, useLocalFolder, openFolder } from "./sync.js";
import { diffDetail } from "./changelog.js";
import { getActor, setActor as persistActor } from "./actor.js";
import { DEFAULT_ORG as ORG_DEFAULTS, STAGE_FLOORS, STAGE_KINDS, SCHOOL_HOLIDAYS_C, SEED_ROOMS, SEED_ASSOCIATIONS, DEFAULT_ORG, STATUS_LABELS, PAYMENT_LABELS, FREQUENCY_LABELS, WEEKDAYS } from "./constants.js";

const Ctx = createContext(null);
export const usePlanner = () => useContext(Ctx);

function seedIfEmpty(db) {
  const empty = ENTITIES.filter((e) => e !== "ActivityLog").every((e) => db[e].length === 0);
  if (!empty) return db;
  const year = schoolYearOf(todayKey());
  const rooms = SEED_ROOMS.map((r, i) => ({
    id: newId(), name: r.name, rate: 0, rateWeekend: null, rateExternal: null, capacity: null,
    equipmentList: [], accessInfo: r.accessInfo || "", colorIdx: i % 8, sortOrder: i,
  }));
  const associations = SEED_ASSOCIATIONS.map((name, i) => ({ id: newId(), name, schoolYear: year, colorIdx: i % 8, isExternal: false, rateCoef: 100, contact: "", email: "" }));
  try {
    saveEntity("Room", rooms);
    saveEntity("Association", associations);
  } catch (e) { /* ignoré */ }
  return { ...db, Room: rooms, Association: associations };
}

export function PlannerProvider({ children }) {
  const [db, setDb] = useState(() => seedIfEmpty(loadAll()));
  const dbRef = useRef(db);
  const [nav, setNav] = useState(() => { const t = todayKey(); return { date: t, year: schoolYearOf(t) }; });
  const [actor, setActorState] = useState(() => getActor());
  const actorRef = useRef(actor);
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [openReq, setOpenReq] = useState(null);
  const ask = useCallback((message, onYes, onNo) => setDialog({ message, onYes, onNo }), []);

  const date = nav.date;
  const year = nav.year;

  const setDate = useCallback((d) => setNav({ date: d, year: schoolYearOf(d) }), []);
  const setYear = useCallback((y) => setNav((n) => (schoolYearOf(n.date) === y ? { date: n.date, year: y } : { date: `${y}-09-01`, year: y })), []);
  const setActor = useCallback((name) => { persistActor(name); actorRef.current = name; setActorState(name); }, []);

  const notify = useCallback((message, kind = "ok", action = null) => {
    const id = newId();
    setToast({ id, message, kind, action });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), action ? 9000 : 2800);
  }, []);
  const [sync, setSync] = useState(getSyncState());
  useEffect(() => subscribeSync(setSync), []);
  useEffect(() => onRemoteReload((by) => { dbRef.current = loadAll(); setDb(dbRef.current); if (by) setTimeout(() => notify(`Données mises à jour par ${by}`), 0); }), []);
  const undoRef = useRef(null);

  const update = useCallback((name, fn) => {
    const next = fn(dbRef.current[name]);
    dbRef.current = { ...dbRef.current, [name]: next };
    setDb(dbRef.current);
    try { saveEntity(name, next); } catch (e) { setTimeout(() => notify("Enregistrement impossible", "error"), 0); }
  }, [notify]);

  const log = useCallback((action, entityType, targetLabel, detail = "") => {
    try {
      const entry = { id: newId(), actor: actorRef.current || "—", action, entityType, targetLabel, detail, schoolYear: schoolYearOf(todayKey()), at: new Date().toISOString() };
      const next = [...dbRef.current.ActivityLog, entry];
      dbRef.current = { ...dbRef.current, ActivityLog: next };
      setDb(dbRef.current);
      saveEntity("ActivityLog", next);
    } catch (e) { /* le journal ne bloque jamais l'action */ }
  }, []);

  const rooms = useMemo(() => [...db.Room].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [db.Room]);
  const associations = useMemo(() => db.Association.filter((a) => a.schoolYear === year).sort((a, b) => a.name.localeCompare(b.name, "fr")), [db.Association, year]);
  const b = yearBounds(year);
  const bookings = useMemo(() => db.Booking.filter((x) => x.startDate <= b.end && x.endDate >= b.start), [db.Booking, b.start, b.end]);
  const recurring = useMemo(() => db.RecurringBooking.filter((x) => (x.schoolYear ?? schoolYearOf(x.startDate)) === year), [db.RecurringBooking, year]);
  const invoices = useMemo(() => db.Invoice.filter((x) => x.schoolYear === year).sort((a, c) => (a.number < c.number ? 1 : -1)), [db.Invoice, year]);
  const closures = useMemo(() => db.Closure.filter((x) => x.schoolYear === year), [db.Closure, year]);
  const templates = db.BookingTemplate;
  const vacations = useMemo(() => db.Vacation.filter((x) => x.schoolYear === year).sort((a, c) => (a.startDate < c.startDate ? -1 : 1)), [db.Vacation, year]);
  const stages = useMemo(() => db.Stage.filter((x) => x.schoolYear === year).sort((a, c) => (a.dates[0] < c.dates[0] ? -1 : 1)), [db.Stage, year]);
  const floors = (db.OrganisationSettings[0] && db.OrganisationSettings[0].floors) || STAGE_FLOORS;
  const floorRoomIds = (floor) => {
    if (floor.roomIds && floor.roomIds.length) return floor.roomIds.filter((id) => db.Room.some((r) => r.id === id));
    const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return (floor.roomNames || []).map((n) => db.Room.find((r) => norm(r.name) === norm(n))).filter(Boolean).map((r) => r.id);
  };
  const org = useMemo(() => {
    const stored = db.OrganisationSettings[0] || {};
    const out = { ...ORG_DEFAULTS };
    for (const k of Object.keys(stored)) if (stored[k] !== undefined && stored[k] !== "" && stored[k] !== null) out[k] = stored[k];
    return out;
  }, [db.OrganisationSettings]);
  const dayNotes = db.DayNote;
  const noteMap = useMemo(() => { const m = new Map(); db.DayNote.forEach((n) => m.set(n.date, n)); return m; }, [db.DayNote]);
  const dayNoteFor = useCallback((d) => noteMap.get(d) || null, [noteMap]);

  const sessions = useMemo(() => sessionsInRange(bookings, recurring, b.start, b.end), [bookings, recurring, b.start, b.end]);
  const sessionIndex = useMemo(() => {
    const m = new Map();
    for (const s of sessions) { const k = `${s.date}|${s.roomId}`; if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return m;
  }, [sessions]);
  const sessionsFor = useCallback((roomId, d) => sessionIndex.get(`${d}|${roomId}`) || [], [sessionIndex]);
  const allSessions = useCallback((from, to) => sessionsInRange(db.Booking, db.RecurringBooking, from, to), [db.Booking, db.RecurringBooking]);

  // ---------- libellés pour le journal ----------
  const resolve = (k, v) => {
    if (v === undefined || v === null || v === "") return "—";
    if (k === "roomId") return (dbRef.current.Room.find((r) => r.id === v) || {}).name || "—";
    if (k === "associationId") return (dbRef.current.Association.find((r) => r.id === v) || {}).name || "—";
    if (k === "status") return STATUS_LABELS[v] || v;
    if (k === "paymentStatus") return PAYMENT_LABELS[v] || v;
    if (k === "frequency") return FREQUENCY_LABELS[v] || v;
    if (k === "weekday") return WEEKDAYS[v] || v;
    if (typeof v === "boolean") return v ? "oui" : "non";
    if (Array.isArray(v)) return v.length && typeof v[0] === "object" ? `${v.length} élément(s)` : v.join(", ") || "—";
    return String(v);
  };
  const nameOfRoom = (id) => (dbRef.current.Room.find((r) => r.id === id) || {}).name || "Salle";
  const nameOfAssoc = (src) => (dbRef.current.Association.find((a) => a.id === src.associationId) || {}).name || src.customName || "Réservation";
  const bookingLabel = (x) => `${nameOfAssoc(x)} · ${x.startDate} · ${x.start}-${x.end}`;
  const seriesLabel = (x) => `${nameOfAssoc(x)} · ${FREQUENCY_LABELS[x.frequency] || ""} · ${x.start}-${x.end}`;

  // ---------- salles ----------
  const addRoom = (name) => {
    const n = (name || "").trim();
    if (!n) return;
    const list = dbRef.current.Room;
    const room = { id: newId(), name: n, rate: 0, rateWeekend: null, rateExternal: null, capacity: null, equipmentList: [], accessInfo: "", colorIdx: list.length % 8, sortOrder: list.length };
    update("Room", (l) => [...l, room]);
    log("create", "Salle", n);
  };
  const updateRoom = (id, patch) => {
    const before = dbRef.current.Room.find((r) => r.id === id);
    if (!before) return;
    update("Room", (l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    log("update", "Salle", before.name, diffDetail(before, patch, resolve));
  };
  const deleteRoom = (id) => {
    const before = dbRef.current.Room.find((r) => r.id === id);
    update("Room", (l) => l.filter((r) => r.id !== id));
    update("Booking", (l) => l.filter((x) => x.roomId !== id));
    update("RecurringBooking", (l) => l.filter((x) => x.roomId !== id));
    update("Closure", (l) => l.filter((x) => x.roomId !== id));
    log("delete", "Salle", before ? before.name : "Salle");
  };

  // ---------- associations ----------
  const addAssociation = (name) => {
    const n = (name || "").trim();
    if (!n) return;
    const count = dbRef.current.Association.filter((a) => a.schoolYear === year).length;
    update("Association", (l) => [...l, { id: newId(), name: n, schoolYear: year, colorIdx: count % 8, isExternal: false, rateCoef: 100, contact: "", email: "" }]);
    log("create", "Association", n);
  };
  const updateAssociation = (id, patch) => {
    const before = dbRef.current.Association.find((a) => a.id === id);
    if (!before) return;
    update("Association", (l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    log("update", "Association", before.name, diffDetail(before, patch, resolve));
  };
  const deleteAssociation = (id) => {
    const before = dbRef.current.Association.find((a) => a.id === id);
    update("Association", (l) => l.filter((a) => a.id !== id));
    log("delete", "Association", before ? before.name : "Association");
  };
  const copyPreviousYearAssociations = () => {
    const prev = dbRef.current.Association.filter((a) => a.schoolYear === year - 1);
    const have = new Set(dbRef.current.Association.filter((a) => a.schoolYear === year).map((a) => a.name.toLowerCase()));
    const toAdd = prev.filter((a) => !have.has(a.name.toLowerCase())).map((a) => ({ ...a, id: newId(), schoolYear: year }));
    if (toAdd.length === 0) { notify("Rien à copier depuis l'année précédente"); return; }
    update("Association", (l) => [...l, ...toAdd]);
    log("create", "Association", `${toAdd.length} association(s) copiée(s) depuis ${yearLabel(year - 1)}`);
    notify(`${toAdd.length} association(s) copiée(s)`);
  };

  // ---------- réservations ----------
  const cleanNames = (p) => (p.associationId ? { ...p, customName: "" } : { ...p, associationId: "" });
  const saveBooking = (payload, id) => {
    const data = { ...cleanNames(payload), schoolYear: schoolYearOf(payload.startDate) };
    if (id) {
      const before = dbRef.current.Booking.find((x) => x.id === id);
      update("Booking", (l) => l.map((x) => (x.id === id ? { ...x, ...data } : x)));
      log("update", "Réservation", bookingLabel({ ...before, ...data }), diffDetail(before, data, resolve));
      notify("Réservation enregistrée");
    } else {
      const rec = { id: newId(), ...data };
      update("Booking", (l) => [...l, rec]);
      log("create", "Réservation", bookingLabel(rec));
      notify("Réservation ajoutée");
    }
  };
  const deleteBooking = (id) => {
    const before = dbRef.current.Booking.find((x) => x.id === id);
    update("Booking", (l) => l.filter((x) => x.id !== id));
    log("delete", "Réservation", before ? bookingLabel(before) : "Réservation");
    notify("Réservation supprimée");
  };
  const updateBookingPayment = (id, paymentStatus) => {
    const before = dbRef.current.Booking.find((x) => x.id === id);
    if (!before) return;
    update("Booking", (l) => l.map((x) => (x.id === id ? { ...x, paymentStatus } : x)));
    log("update", "Réservation", bookingLabel(before), diffDetail(before, { paymentStatus }, resolve));
  };

  // ---------- séries ----------
  const saveRecurring = (payload, id) => {
    const data = { ...cleanNames(payload), schoolYear: schoolYearOf(payload.startDate) };
    if (id) {
      const before = dbRef.current.RecurringBooking.find((x) => x.id === id);
      update("RecurringBooking", (l) => l.map((x) => (x.id === id ? { ...x, ...data, exceptions: x.exceptions || [] } : x)));
      log("update", "Série", seriesLabel({ ...before, ...data }), diffDetail(before, data, resolve));
      notify("Série enregistrée");
    } else {
      const rec = { id: newId(), exceptions: [], ...data };
      update("RecurringBooking", (l) => [...l, rec]);
      log("create", "Série", seriesLabel(rec));
      notify("Série récurrente créée");
    }
  };
  const deleteRecurring = (id) => {
    const before = dbRef.current.RecurringBooking.find((x) => x.id === id);
    update("RecurringBooking", (l) => l.filter((x) => x.id !== id));
    log("delete", "Série", before ? seriesLabel(before) : "Série");
    notify("Série supprimée");
  };
  const cancelOccurrence = (id, d) => {
    const before = dbRef.current.RecurringBooking.find((x) => x.id === id);
    if (!before) return;
    update("RecurringBooking", (l) => l.map((x) => (x.id === id && !(x.exceptions || []).includes(d) ? { ...x, exceptions: [...(x.exceptions || []), d] } : x)));
    log("update", "Série", seriesLabel(before), `Séance annulée : ${d}`);
  };
  const updateRecurringFields = (id, patch) => {
    const before = dbRef.current.RecurringBooking.find((x) => x.id === id);
    if (!before) return;
    update("RecurringBooking", (l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    log("update", "Série", seriesLabel(before), diffDetail(before, patch, resolve));
  };

  // ---------- fermetures ----------
  const addClosure = (payload) => {
    const rec = { id: newId(), schoolYear: year, ...payload };
    update("Closure", (l) => [...l, rec]);
    log("create", "Fermeture", `${rec.label} · ${rec.startDate} → ${rec.endDate}`);
    notify("Fermeture ajoutée");
  };
  const deleteClosure = (id) => {
    const before = dbRef.current.Closure.find((x) => x.id === id);
    update("Closure", (l) => l.filter((x) => x.id !== id));
    log("delete", "Fermeture", before ? before.label : "Fermeture");
  };

  // ---------- factures ----------
  const saveInvoice = (inv) => {
    const orgNow = { ...ORG_DEFAULTS, ...(dbRef.current.OrganisationSettings[0] || {}) };
    const n = Number(orgNow.nextInvoiceNumber) || 1;
    const number = `${orgNow.invoicePrefix || "REL"}-${year}-${String(n).padStart(3, "0")}`;
    const rec = { id: newId(), number, issuedAt: todayKey(), dueDate: addDays(inv.periodEnd, 30), status: "sent", amountPaid: 0, payments: [], schoolYear: year, ...inv };
    update("Invoice", (l) => [...l, rec]);
    updateOrgRaw({ nextInvoiceNumber: n + 1 });
    log("create", "Relevé de frais", `${rec.number} · ${rec.associationName}`, `Total : ${rec.total} €`);
    notify("Relevé de frais enregistré");
    return rec;
  };
  const addInvoicePayment = (id, payment) => {
    const inv = dbRef.current.Invoice.find((x) => x.id === id);
    if (!inv) return;
    const payments = [...(inv.payments || []), payment];
    const amountPaid = round2(payments.reduce((s, p) => s + Number(p.amount || 0), 0));
    const status = amountPaid >= round2(inv.total) ? "paid" : "sent";
    update("Invoice", (l) => l.map((x) => (x.id === id ? { ...x, payments, amountPaid, status } : x)));
    log("create", "Règlement", `${inv.number} · ${inv.associationName}`, `${payment.amount} € · ${payment.method}`);
    notify("Règlement enregistré");
  };
  // Copie les séries de l'année affichée vers la suivante : 52 semaines plus tard (même jour de semaine)
  const copyRecurringToNextYear = () => {
    const src = dbRef.current.RecurringBooking.filter((r) => (r.schoolYear ?? schoolYearOf(r.startDate)) === year);
    const shifted = src.map((r) => ({ ...r, id: newId(), schoolYear: year + 1, startDate: addDays(r.startDate, 364), endDate: addDays(r.endDate, 364), exceptions: [], status: "a_confirmer", paymentStatus: "unpaid" }));
    if (!shifted.length) { notify("Aucune série à copier"); return; }
    update("RecurringBooking", (l) => [...l, ...shifted]);
    log("create", "Série", `${shifted.length} série(s) copiée(s) vers ${year + 1}-${year + 2}`);
    notify(`${shifted.length} série(s) copiée(s) (à valider dans « À traiter »)`);
  };
  const patchInvoice = (id, patch) => update("Invoice", (l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const deleteInvoice = (id) => {
    const before = dbRef.current.Invoice.find((x) => x.id === id);
    update("Invoice", (l) => l.filter((x) => x.id !== id));
    log("delete", "Relevé de frais", before ? `${before.number} · ${before.associationName}` : "Relevé de frais");
    notify("Relevé de frais supprimé");
  };

  // ---------- modèles, organisation, notes ----------
  const saveTemplate = (tpl) => {
    update("BookingTemplate", (l) => [...l, { id: newId(), ...tpl }]);
    log("create", "Modèle", tpl.name);
    notify("Modèle enregistré");
  };
  const deleteTemplate = (id) => {
    const before = dbRef.current.BookingTemplate.find((x) => x.id === id);
    update("BookingTemplate", (l) => l.filter((x) => x.id !== id));
    log("delete", "Modèle", before ? before.name : "Modèle");
  };
  function updateOrgRaw(patch) {
    update("OrganisationSettings", (l) => (l.length ? [{ ...l[0], ...patch }] : [{ id: newId(), ...patch }]));
  }
  const updateOrg = (patch) => {
    const before = { ...ORG_DEFAULTS, ...(dbRef.current.OrganisationSettings[0] || {}) };
    updateOrgRaw(patch);
    log(dbRef.current.OrganisationSettings.length > 1 ? "update" : "update", "Paramètres de l'organisation", before.name || "Organisation", diffDetail(before, patch, resolve));
    notify("Organisation enregistrée");
  };
  const saveDayNote = (d, patch) => {
    const cur = dbRef.current.DayNote.find((n) => n.date === d);
    const merged = { opening: "", closing: "", absence: "", note: "", ...(cur || {}), ...patch };
    const empty = !merged.opening && !merged.closing && !merged.absence && !merged.note;
    if (!cur && empty) return;
    if (cur && empty) { update("DayNote", (l) => l.filter((n) => n.date !== d)); log("delete", "Note du jour", d); return; }
    if (cur) update("DayNote", (l) => l.map((n) => (n.date === d ? { ...n, ...patch } : n)));
    else update("DayNote", (l) => [...l, { id: newId(), date: d, opening: "", closing: "", absence: "", note: "", ...patch }]);
    log(cur ? "update" : "create", "Note du jour", d, diffDetail(cur || {}, patch, resolve));
  };

  // ---------- vacances scolaires ----------
  const addVacation = (payload) => {
    update("Vacation", (l) => [...l, { id: newId(), schoolYear: year, ...payload }]);
    log("create", "Vacances scolaires", `${payload.label} · ${payload.startDate} → ${payload.endDate}`);
    notify("Vacances ajoutées");
  };
  const deleteVacation = (id) => {
    const before = dbRef.current.Vacation.find((x) => x.id === id);
    update("Vacation", (l) => l.filter((x) => x.id !== id));
    log("delete", "Vacances scolaires", before ? before.label : "Vacances");
  };

  // ---------- stages BAFA ----------
  const saveStage = ({ kind, label, floor, dates, associationId, customName, status, paymentStatus, start, end, dayPrice, note, params }, replaceId) => {
    if (replaceId) { update("Stage", (l) => l.filter((x) => x.id !== replaceId)); update("Booking", (l) => l.filter((x) => x.stageId !== replaceId)); }
    const roomIds = floorRoomIds(floor);
    const stageId = newId();
    const stage = { id: stageId, schoolYear: schoolYearOf(dates[0]), kind, label, floorName: floor.name, roomIds, dates, associationId, customName, dayPrice, status, paymentStatus, start, end, params };
    const bks = [];
    for (const d of dates) for (const roomId of roomIds) bks.push({ id: newId(), stageId, roomId, associationId, customName: associationId ? "" : customName, startDate: d, endDate: d, start, end, participants: "", contact: "", equipment: "", note: note || label, internalNote: "", status, paymentStatus, schoolYear: schoolYearOf(d) });
    update("Stage", (l) => [...l, stage]);
    update("Booking", (l) => [...l, ...bks]);
    log("create", "Stage", `${label} · ${floor.name} · ${dates[0]} → ${dates[dates.length - 1]}`, `${dates.length} jour(s) · ${roomIds.length} salle(s)`);
    notify("Stage enregistré");
  };
  const deleteStage = (id) => {
    const before = dbRef.current.Stage.find((x) => x.id === id);
    update("Stage", (l) => l.filter((x) => x.id !== id));
    update("Booking", (l) => l.filter((x) => x.stageId !== id));
    log("delete", "Stage", before ? `${before.label} · ${before.floorName}` : "Stage");
    notify("Stage supprimé");
  };
  const updateStageStatus = (id, patch) => {
    const before = dbRef.current.Stage.find((x) => x.id === id);
    if (!before) return;
    update("Stage", (l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    update("Booking", (l) => l.map((x) => (x.stageId === id ? { ...x, ...patch } : x)));
    log("update", "Stage", `${before.label} · ${before.floorName}`, diffDetail(before, patch, resolve));
  };

  // ---------- annuler la dernière action ----------
  const undo = () => {
    const u = undoRef.current;
    if (!u) { notify("Rien à annuler"); return; }
    for (const [n, list] of Object.entries(u.snap)) {
      dbRef.current = { ...dbRef.current, [n]: list };
      try { saveEntity(n, list); } catch (e) { /* ignoré */ }
    }
    setDb(dbRef.current);
    undoRef.current = null;
    log("update", "Annulation", u.label);
    notify("Action annulée : " + u.label);
  };
  const withUndo = (label, names, fn) => {
    const snap = {};
    names.forEach((n) => { snap[n] = dbRef.current[n]; });
    fn();
    undoRef.current = { label, snap };
    notify(label, "ok", { label: "Annuler", run: undo });
  };
  const wrap = (label, names, fn) => (...a) => withUndo(label, names, () => fn(...a));

  // ---------- champs, statuts et déplacements ----------
  const updateBookingFields = (id, patch) => {
    const before = dbRef.current.Booking.find((x) => x.id === id);
    if (!before) return;
    update("Booking", (l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    log("update", "Réservation", bookingLabel({ ...before, ...patch }), diffDetail(before, patch, resolve));
  };
  const setSourceFields = (kind, id, patch) => {
    if (kind === "booking") updateBookingFields(id, patch);
    else if (kind === "series") updateRecurringFields(id, patch);
    else updateStageStatus(id, patch);
  };
  // Mise à jour groupée : une seule écriture par type de données + une seule ligne d'historique
  const setSourceFieldsBulk = (items, patch, label = "Mise à jour groupée") => {
    const ids = { booking: new Set(), series: new Set(), stage: new Set() };
    items.forEach((u) => { (ids[u.kind] || ids.stage).add(u.id); });
    const merge = (l, set, key = "id") => l.map((x) => (set.has(x[key]) ? { ...x, ...patch } : x));
    if (ids.booking.size) update("Booking", (l) => merge(l, ids.booking));
    if (ids.series.size) update("RecurringBooking", (l) => merge(l, ids.series));
    if (ids.stage.size) { update("Stage", (l) => merge(l, ids.stage)); update("Booking", (l) => merge(l, ids.stage, "stageId")); }
    log("update", "Réservation", `${label} (${items.length})`, Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(", "));
  };
  const dayDiff = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);
  const moveSession = (s, toDate, toRoomId) => {
    if (s.stageId) { notify("Pour déplacer un stage : Réglages → Stages → Modifier", "error"); return false; }
    if (s.date === toDate && (!toRoomId || toRoomId === s.roomId)) return false;
    if (s.kind === "booking") {
      const b = dbRef.current.Booking.find((x) => x.id === s.sourceId);
      if (!b) return false;
      const delta = dayDiff(toDate, s.date);
      updateBookingFields(b.id, { roomId: toRoomId || b.roomId, startDate: addDays(b.startDate, delta), endDate: addDays(b.endDate, delta), schoolYear: schoolYearOf(addDays(b.startDate, delta)) });
    } else {
      cancelOccurrence(s.sourceId, s.date);
      saveBooking({ roomId: toRoomId || s.roomId, associationId: s.associationId, customName: s.customName, startDate: toDate, endDate: toDate, start: s.start, end: s.end, participants: s.participants, contact: s.contact, equipment: s.equipment, note: s.note, internalNote: s.internalNote, status: s.status, paymentStatus: s.paymentStatus });
    }
    return true;
  };

  // ---------- relevés : règlement -> séances payées ----------
  const markPeriodPaid = (inv) => {
    const from = inv.periodStart, to = inv.periodEnd, a = inv.associationId;
    let n = 0;
    update("Booking", (l) => l.map((x) => { if (x.associationId === a && x.startDate >= from && x.endDate <= to && x.status === "confirme" && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
    update("RecurringBooking", (l) => l.map((x) => { if (x.associationId === a && x.startDate >= from && x.endDate <= to && x.status === "confirme" && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
    update("Stage", (l) => l.map((x) => { if (x.associationId === a && x.dates[0] >= from && x.dates[x.dates.length - 1] <= to && x.status === "confirme" && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
    log("update", "Réservation", `${inv.associationName} · ${from} → ${to}`, `Séances marquées payées (relevé ${inv.number})`);
    notify(n ? `${n} réservation(s) / série(s) / stage(s) marqué(s) payé(s)` : "Aucune séance à marquer");
  };
  const saveInvoicesBatch = (list) => list.map((st) => saveInvoice(st));

  // ---------- vacances officielles ----------
  const addOfficialHolidays = () => {
    const have = dbRef.current.Vacation;
    const toAdd = SCHOOL_HOLIDAYS_C.filter((h) => !have.some((v) => v.startDate === h.startDate && v.label === h.label)).map((h) => ({ id: newId(), schoolYear: schoolYearOf(h.startDate), ...h }));
    if (!toAdd.length) { notify("Les vacances officielles sont déjà toutes ajoutées"); return; }
    update("Vacation", (l) => [...l, ...toAdd]);
    log("create", "Vacances scolaires", `${toAdd.length} période(s) officielles (zone C)`);
    notify(`${toAdd.length} période(s) de vacances ajoutée(s)`);
  };

  // ---------- sauvegarde ----------
  const exportBackup = () => download(`planning-des-salles-sauvegarde-${todayKey()}.json`, "application/json", exportJson(dbRef.current));
  const importBackup = (text) => {
    const data = parseBackup(text);
    for (const e of ENTITIES) saveEntity(e, data[e]);
    dbRef.current = data;
    setDb(data);
    notify("Sauvegarde importée");
  };

  const years = useMemo(() => {
    const cur = schoolYearOf(todayKey());
    const set = new Set();
    for (let y = cur - 10; y <= cur + 50; y++) set.add(y);
    set.add(year);
    return [...set].sort((a, c) => a - c);
  }, [year]);

  const value = {
    db, year, setYear, years, openReq, requestOpenDay: (d, roomId) => { setNav({ date: d, year: schoolYearOf(d) }); setOpenReq({ date: d, roomId, n: Date.now() }); }, clearOpenReq: () => setOpenReq(null), ask, dialog, closeDialog: () => setDialog(null), date, setDate, actor, setActor, notify, toast,
    rooms, associations, bookings, recurring, invoices, closures, templates, vacations, stages, floors, floorRoomIds, addVacation, deleteVacation: wrap("Vacances supprimées", ["Vacation"], deleteVacation), saveStage: (p, rid) => (rid ? withUndo("Stage modifié", ["Stage", "Booking"], () => saveStage(p, rid)) : saveStage(p)), deleteStage: wrap("Stage supprimé", ["Stage", "Booking"], deleteStage), updateStageStatus, org, dayNotes, dayNoteFor,
    sessions, sessionsFor, allSessions,
    addRoom, updateRoom, deleteRoom: wrap("Salle supprimée", ["Room", "Booking", "RecurringBooking", "Closure"], deleteRoom),
    addAssociation, updateAssociation, deleteAssociation: wrap("Association supprimée", ["Association"], deleteAssociation), copyPreviousYearAssociations,
    saveBooking, deleteBooking: wrap("Réservation supprimée", ["Booking"], deleteBooking), updateBookingPayment, updateBookingFields, setSourceFields, setSourceFieldsBulk, moveSession, undoable: withUndo, undo, markPeriodPaid, saveInvoicesBatch, addOfficialHolidays,
    sync, reloadRemote, overwriteRemote, chooseFolder, adoptFolder, revertFolder, useLocalFolder, openFolder,
    saveRecurring, deleteRecurring: wrap("Série supprimée", ["RecurringBooking"], deleteRecurring), cancelOccurrence: wrap("Séance annulée", ["RecurringBooking"], cancelOccurrence), updateRecurringFields,
    addClosure, deleteClosure: wrap("Fermeture supprimée", ["Closure"], deleteClosure),
    saveInvoice, patchInvoice, copyRecurringToNextYear, addInvoicePayment, deleteInvoice: wrap("Relevé de frais supprimé", ["Invoice"], deleteInvoice),
    saveTemplate, deleteTemplate: wrap("Modèle supprimé", ["BookingTemplate"], deleteTemplate), updateOrg, saveDayNote,
    exportBackup, importBackup,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
