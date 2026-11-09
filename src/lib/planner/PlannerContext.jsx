import React, { createContext, useContext, useState, useRef, useMemo, useCallback } from "react";
import { loadAll, saveEntity, newId, exportJson, parseBackup, ENTITIES } from "./store.js";
import { download } from "./exports.js";
import { todayKey, schoolYearOf, yearBounds, addDays, yearLabel } from "./dates.js";
import { sessionsInRange, round2 } from "./occurrences.js";
import { diffDetail } from "./changelog.js";
import { getActor, setActor as persistActor } from "./actor.js";
import { SEED_ROOMS, SEED_ASSOCIATIONS, DEFAULT_ORG, STATUS_LABELS, PAYMENT_LABELS, FREQUENCY_LABELS, WEEKDAYS } from "./constants.js";

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

  const date = nav.date;
  const year = nav.year;

  const setDate = useCallback((d) => setNav({ date: d, year: schoolYearOf(d) }), []);
  const setYear = useCallback((y) => setNav((n) => (schoolYearOf(n.date) === y ? { date: n.date, year: y } : { date: `${y}-09-01`, year: y })), []);
  const setActor = useCallback((name) => { persistActor(name); actorRef.current = name; setActorState(name); }, []);

  const notify = useCallback((message, kind = "ok") => {
    const id = newId();
    setToast({ id, message, kind });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2800);
  }, []);

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
  const org = db.OrganisationSettings[0] || { ...DEFAULT_ORG };
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
    if (Array.isArray(v)) return v.join(", ") || "—";
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
    const orgNow = dbRef.current.OrganisationSettings[0] || { ...DEFAULT_ORG };
    const n = Number(orgNow.nextInvoiceNumber) || 1;
    const number = `${orgNow.invoicePrefix || "FACT"}-${year}-${String(n).padStart(3, "0")}`;
    const rec = { id: newId(), number, issuedAt: todayKey(), dueDate: addDays(inv.periodEnd, 30), status: "sent", amountPaid: 0, payments: [], schoolYear: year, ...inv };
    update("Invoice", (l) => [...l, rec]);
    updateOrgRaw({ nextInvoiceNumber: n + 1 });
    log("create", "Facture", `${rec.number} · ${rec.associationName}`, `Total : ${rec.total} €`);
    notify("Facture enregistrée");
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
  const deleteInvoice = (id) => {
    const before = dbRef.current.Invoice.find((x) => x.id === id);
    update("Invoice", (l) => l.filter((x) => x.id !== id));
    log("delete", "Facture", before ? `${before.number} · ${before.associationName}` : "Facture");
    notify("Facture supprimée");
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
    update("OrganisationSettings", (l) => (l.length ? [{ ...l[0], ...patch }] : [{ id: newId(), ...DEFAULT_ORG, ...patch }]));
  }
  const updateOrg = (patch) => {
    const before = dbRef.current.OrganisationSettings[0] || { ...DEFAULT_ORG };
    updateOrgRaw(patch);
    log(dbRef.current.OrganisationSettings.length > 1 ? "update" : "update", "Paramètres de l'organisation", before.name || "Organisation", diffDetail(before, patch, resolve));
    notify("Organisation enregistrée");
  };
  const saveDayNote = (d, patch) => {
    const cur = dbRef.current.DayNote.find((n) => n.date === d);
    const merged = { presence: "", note: "", ...(cur || {}), ...patch };
    if (!cur && !merged.presence && !merged.note) return;
    if (cur) update("DayNote", (l) => l.map((n) => (n.date === d ? { ...n, ...patch } : n)));
    else update("DayNote", (l) => [...l, { id: newId(), date: d, presence: merged.presence, note: merged.note }]);
    log(cur ? "update" : "create", "Note du jour", d, diffDetail(cur || {}, patch, resolve));
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
    db, year, setYear, years, date, setDate, actor, setActor, notify, toast,
    rooms, associations, bookings, recurring, invoices, closures, templates, org, dayNotes, dayNoteFor,
    sessions, sessionsFor, allSessions,
    addRoom, updateRoom, deleteRoom,
    addAssociation, updateAssociation, deleteAssociation, copyPreviousYearAssociations,
    saveBooking, deleteBooking, updateBookingPayment,
    saveRecurring, deleteRecurring, cancelOccurrence, updateRecurringFields,
    addClosure, deleteClosure,
    saveInvoice, addInvoicePayment, deleteInvoice,
    saveTemplate, deleteTemplate, updateOrg, saveDayNote,
    exportBackup, importBackup,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
