import React, { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect } from "react";
import { loadAll, saveEntity, saveAll, newId, exportJson, parseBackup, ENTITIES } from "./store.js";
import { download } from "./exports.js";
import { parseKey, todayKey, schoolYearOf, yearBounds, addDays, yearLabel, weekdayIndex, frShort } from "./dates.js";
import { sessionsInRange, round2, timesOverlap, sessionName } from "./occurrences.js";
import { getSyncState, subscribeSync, onRemoteReload, reloadRemote, overwriteRemote, chooseFolder, adoptFolder, revertFolder, useLocalFolder, openFolder, canArchiveYears, writeArchive } from "./sync.js";
import { diffDetail } from "./changelog.js";
import { getActor, setActor as persistActor } from "./actor.js";
import { dueBilling, coproName } from "./billing.js";
import { publicSnapshot } from "./displayshare.js";
import { DEFAULT_ORG as ORG_DEFAULTS, STAGE_FLOORS, STAGE_KINDS, SCHOOL_HOLIDAYS_C, SEED_ROOMS, SEED_ASSOCIATIONS, DEFAULT_ORG, STATUS_LABELS, PAYMENT_LABELS, FREQUENCY_LABELS, WEEKDAYS, PALETTE } from "./constants.js";

const Ctx = createContext(null);
export const usePlanner = () => useContext(Ctx);

// Nombre d'années scolaires conservées dans le planning (l'année en cours comprise)
const KEEP_YEARS = 3;
// L'année scolaire à laquelle appartient un enregistrement (null = sans année : salles, modèles, réglages)
function yearOfRecord(entity, x) {
  if (entity === "Room" || entity === "OrganisationSettings" || entity === "BookingTemplate") return null;
  if (entity === "Booking") return x.startDate ? schoolYearOf(x.startDate) : null;
  if (entity === "DayNote") return x.date ? schoolYearOf(x.date) : null;
  if (entity === "RecurringBooking") return Number.isInteger(x.schoolYear) ? x.schoolYear : x.startDate ? schoolYearOf(x.startDate) : null;
  if (entity === "Stage") return Number.isInteger(x.schoolYear) ? x.schoolYear : x.dates && x.dates[0] ? schoolYearOf(x.dates[0]) : null;
  return Number.isInteger(x.schoolYear) ? x.schoolYear : null;
}
function* entityYears(data) {
  for (const e of ENTITIES) for (const x of data[e]) { const y = yearOfRecord(e, x); if (y !== null) yield [e, y]; }
}

const LOG_MAX = 4000;
const UNDO_MAX = 20;   // profondeur de la pile d'annulation (Ctrl+Z)
// Historique : on retire les images enregistrées par erreur dans le détail et on borne la taille
function tidyLog(db) {
  const log = db.ActivityLog || [];
  const heavy = log.some((e) => e.detail && e.detail.length > 600);
  if (!heavy && log.length <= LOG_MAX) return db;
  const next = log.slice(-LOG_MAX).map((e) => (e.detail && e.detail.length > 600 ? { ...e, detail: e.detail.replace(/data:[^\s;]+;base64,[A-Za-z0-9+/=]+/g, "(image)").slice(0, 400) } : e));
  try { saveEntity("ActivityLog", next); } catch (e) { /* ignoré */ }
  return { ...db, ActivityLog: next };
}

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
    try { saveEntity("Room", rooms); saveEntity("Association", associations); } catch (e) { /* mémoire pleine : on continue sans écrire */ }
  } catch (e) { /* ignoré */ }
  return { ...db, Room: rooms, Association: associations };
}

export function PlannerProvider({ children }) {
  const [db, setDb] = useState(() => tidyLog(seedIfEmpty(loadAll())));
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
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), action ? 20000 : 2800);   // 20 s pour avoir le temps d'annuler
  }, []);
  const [sync, setSync] = useState(getSyncState());
  useEffect(() => subscribeSync(setSync), []);
  // Pile d'annulation : les 20 dernières actions, de la plus ancienne à la plus récente.
  // Chaque étape ne garde qu'une référence vers les tableaux précédents, sans recopie.
  const undoRef = useRef([]);
  const inUndoableRef = useRef(0);
  const [undoTop, setUndoTop] = useState(null);
  const syncUndo = () => { const s = undoRef.current; setUndoTop(s.length ? { label: s[s.length - 1].label, count: s.length } : null); };
  // Une modification faite à la main après coup rend les photos précédentes de ces données
  // périmées : on les retire de la pile, pour qu'un Ctrl+Z tardif n'efface jamais ce travail.
  const pruneUndo = (name) => {
    const kept = undoRef.current.filter((e) => !(name in e.snap));
    if (kept.length !== undoRef.current.length) { undoRef.current = kept; syncUndo(); }
  };
  useEffect(() => onRemoteReload((by) => { undoRef.current = []; setUndoTop(null); dbRef.current = loadAll(); setDb(dbRef.current); if (by) setTimeout(() => notify(`Données mises à jour par ${by}`), 0); }), []);

  // Quand l'affichage est publié sur le réseau, on tient à jour ce que le serveur
  // sert à la télévision : seulement l'horaire du jour, rien de confidentiel.
  useEffect(() => {
    const fs = window.salleplanFS;
    if (!fs || !fs.netPush || !fs.netStatus) return;
    let alive = true;
    const push = async () => {
      try {
        const st = await fs.netStatus();
        if (!alive || !st || !st.ok || !st.on) return;
        await fs.netPush(publicSnapshot(dbRef.current, todayKey()));
      } catch (e) { /* sans effet sur le planning */ }
    };
    push();
    const t = setInterval(push, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [db]);

  const update = useCallback((name, fn) => {
    const next = fn(dbRef.current[name]);
    dbRef.current = { ...dbRef.current, [name]: next };
    setDb(dbRef.current);
    if (!inUndoableRef.current) pruneUndo(name);
    try { saveEntity(name, next); } catch (e) { setTimeout(() => notify("Enregistrement impossible", "error"), 0); }
  }, [notify]);

  const log = useCallback((action, entityType, targetLabel, detail = "") => {
    try {
      const entry = { id: newId(), actor: actorRef.current || "—", action, entityType, targetLabel, detail, schoolYear: schoolYearOf(todayKey()), at: new Date().toISOString() };
      const next = [...dbRef.current.ActivityLog, entry].slice(-LOG_MAX);
      dbRef.current = { ...dbRef.current, ActivityLog: next };
      setDb(dbRef.current);
      saveEntity("ActivityLog", next);
    } catch (e) { /* le journal ne bloque jamais l'action */ }
  }, []);

  const rooms = useMemo(() => [...db.Room].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [db.Room]);
  const associations = useMemo(() => db.Association.filter((a) => a.schoolYear === year).sort((a, b) => a.name.localeCompare(b.name, "fr")), [db.Association, year]);
  // Une séance peut pointer vers la fiche d'une autre année (série reprise) : on la retrouve quand même
  const assocAll = useMemo(() => { const m = new Map(); db.Association.forEach((a) => m.set(a.id, a)); return m; }, [db.Association]);
  const assocOf = useCallback((s) => (s && s.associationId ? assocAll.get(s.associationId) || null : null), [assocAll]);
  const b = yearBounds(year);
  const bookings = useMemo(() => db.Booking.filter((x) => x.startDate <= b.end && x.endDate >= b.start), [db.Booking, b.start, b.end]);
  const recurring = useMemo(() => db.RecurringBooking.filter((x) => (x.schoolYear ?? schoolYearOf(x.startDate)) === year), [db.RecurringBooking, year]);
  const invoices = useMemo(() => db.Invoice.filter((x) => x.schoolYear === year).sort((a, c) => (a.number < c.number ? 1 : -1)), [db.Invoice, year]);
  const closures = useMemo(() => db.Closure.filter((x) => x.schoolYear === year), [db.Closure, year]);
  const templates = db.BookingTemplate;
  const vacations = useMemo(() => db.Vacation.filter((x) => x.schoolYear === year).sort((a, c) => (a.startDate < c.startDate ? -1 : 1)), [db.Vacation, year]);
  const stages = useMemo(() => db.Stage.filter((x) => x.schoolYear === year).sort((a, c) => (a.dates[0] < c.dates[0] ? -1 : 1)), [db.Stage, year]);
  const floors = useMemo(() => {
    const o = db.OrganisationSettings[0]; const fl = (o && o.floors) || STAGE_FLOORS;
    if (o && o.floorsFixed) return fl;
    // correction v2.5 : un stage au 2e étage ne réserve que Teilhard de Chardin et Pascal
    return fl.map((f) => (f.name === "2e étage" ? { ...f, roomNames: (f.roomNames || []).filter((n) => !/port.?royal/i.test(n)) } : f));
  }, [db.OrganisationSettings]);
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

  const sessions = useMemo(() => sessionsInRange(bookings, recurring, b.start, b.end, db.Vacation), [bookings, recurring, b.start, b.end, db.Vacation]);
  // Toutes les séances de l'année scolaire affichée (semaine type, statistiques)
  const yearSessions = useMemo(() => sessionsInRange(db.Booking, db.RecurringBooking, b.start, b.end, db.Vacation), [db.Booking, db.RecurringBooking, b.start, b.end, db.Vacation]);
  const sessionIndex = useMemo(() => {
    const m = new Map();
    for (const s of sessions) { const k = `${s.date}|${s.roomId}`; if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
    return m;
  }, [sessions]);
  const sessionsFor = useCallback((roomId, d) => sessionIndex.get(`${d}|${roomId}`) || [], [sessionIndex]);
  // Relevés à préparer (rappels) : toujours calculés pour l'année scolaire en cours
  const dueItems = useMemo(() => {
    const t = todayKey(); const y = schoolYearOf(t); const yb = yearBounds(y);
    const sess = sessionsInRange(db.Booking, db.RecurringBooking, yb.start, yb.end, db.Vacation);
    return dueBilling({ associations: db.Association.filter((a) => a.schoolYear === y), sessions: sess, stages: db.Stage, invoices: db.Invoice, vacations: db.Vacation, year: y, today: t });
  }, [db.Booking, db.RecurringBooking, db.Association, db.Stage, db.Invoice, db.Vacation]);
  // Relevés non réglés dont l'échéance est dépassée (pastille rouge sur les séances concernées)
  const lateInvoices = useMemo(() => { const t = todayKey(); return db.Invoice.filter((i) => (i.amountPaid || 0) < i.total && i.dueDate && i.dueDate < t); }, [db.Invoice]);
  const isLate = useCallback((s) => lateInvoices.length > 0 && lateInvoices.some((i) => (i.sourceIds && i.sourceIds.length ? i.sourceIds.includes(s.id) : !!i.associationId && i.associationId === s.associationId && i.periodStart <= s.date && s.date <= i.periodEnd && ((i.kind === "stage") === !!s.stageId))), [lateInvoices]);
  const allSessions = useCallback((from, to) => sessionsInRange(db.Booking, db.RecurringBooking, from, to, db.Vacation), [db.Booking, db.RecurringBooking, db.Vacation]);

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
  const saveBooking = (payload, id, quiet) => {
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
      if (!quiet) notify("Réservation ajoutée");   // silencieux quand on en crée plusieurs d'un coup
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
    const sy = inv.periodStart ? schoolYearOf(inv.periodStart) : year;
    let seq = n;
    const mk = (x) => `${orgNow.invoicePrefix || "REL"}-${sy}-${String(x).padStart(3, "0")}`;
    const taken = new Set(dbRef.current.Invoice.map((i) => i.number));
    while (taken.has(mk(seq)) && seq < n + 999) seq++;   // jamais deux relevés avec le même numéro
    const number = mk(seq);
    const rec = { id: newId(), number, issuedAt: todayKey(), dueDate: addDays(inv.issuedAt || todayKey(), 30), status: "sent", amountPaid: 0, payments: [], schoolYear: sy, ...inv };
    update("Invoice", (l) => [...l, rec]);
    updateOrgRaw({ nextInvoiceNumber: seq + 1 });
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
  // ---------- import d'un planning (fichier .json issu d'un tableur) ----------
  const normName = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

  // Ce que l'import ajouterait, sans rien modifier
  const importPreview = (payload) => {
    const d = payload || {};
    const rooms = dbRef.current.Room;
    const findRoom = (n) => rooms.find((r) => normName(r.name) === normName(n)) || rooms.find((r) => normName(r.name).startsWith(normName(n).slice(0, 8)));
    const year = Number(d.year);
    const inYear = dbRef.current.Association.filter((a) => a.schoolYear === year);
    const declared = new Set((d.rooms || []).map((r) => normName(r.name)));
    const allRoomNames = [...(d.series || []), ...(d.bookings || [])].flatMap((x) => [x.room, ...(x.rooms || [])]);
    const missRooms = [...new Set(allRoomNames.filter((n) => n && !findRoom(n) && !declared.has(normName(n))))];
    const newRooms = (d.rooms || []).map((r) => r.name).filter((n) => !findRoom(n));
    const missFloors = [...new Set((d.stages || []).map((x) => x.floor).filter((n) => !floors.some((f) => f.name === n)))];
    const newAssoc = (d.associations || []).filter((n) => !inYear.some((a) => normName(a.name) === normName(n)));
    const days = new Set();
    (d.series || []).forEach((x) => (x.dates || []).forEach((k) => days.add(k)));
    (d.bookings || []).forEach((x) => days.add(x.date));
    (d.stages || []).forEach((x) => (x.dates || []).forEach((k) => days.add(k)));
    const busy = dbRef.current.Booking.filter((b) => days.has(b.startDate)).length + dbRef.current.RecurringBooking.filter((r) => (r.schoolYear ?? schoolYearOf(r.startDate)) === year).length;
    return { year, series: (d.series || []).length, bookings: (d.bookings || []).length,
      stages: (d.stages || []).length, stageDays: (d.stages || []).reduce((t, x) => t + (x.dates || []).length, 0),
      associations: (d.associations || []).length, newAssoc, newRooms, missRooms, missFloors, existing: busy, source: d.source || "" };
  };

  const importPlanning = (payload) => {
    const d = payload || {};
    const year = Number(d.year);
    if (!year || d.kind !== "import") { notify("Ce fichier n'est pas un planning à importer", "error"); return null; }
    const report = { series: 0, bookings: 0, stages: 0, assoc: 0, rooms: 0, skipped: 0 };
    const roomList = [...dbRef.current.Room];
    const findRoom = (n) => roomList.find((r) => normName(r.name) === normName(n)) || roomList.find((r) => normName(r.name).startsWith(normName(n).slice(0, 8)));
    for (const r of d.rooms || []) {   // salles déclarées par le fichier (ex. « Forum, Daubenton - Carré Censier »)
      if (findRoom(r.name)) continue;
      roomList.push({ id: newId(), name: r.name, capacity: r.capacity || "", rate: r.rate || 0, copropPrice: r.copropPrice || "", accessInfo: r.accessInfo || "", colorIdx: roomList.length % PALETTE.length, sortOrder: roomList.length, openStart: r.openStart || "", openEnd: r.openEnd || "" });
      report.rooms++;
    }
    withUndo(`Planning ${yearLabel(year)} importé`, ["Association", "RecurringBooking", "Booking", "Stage"], () => {
      const assocs = [...dbRef.current.Association];
      const nextIdx = () => assocs.filter((a) => a.schoolYear === year).length;
      const assocId = (name) => {
        const found = assocs.find((a) => a.schoolYear === year && normName(a.name) === normName(name));
        if (found) return found.id;
        const a = { id: newId(), name: String(name).trim(), schoolYear: year, colorIdx: nextIdx() % PALETTE.length, rateCoef: 100, isExternal: true, contact: "", email: "", phone: "", address: "", notes: "", fixedPrice: "" };
        assocs.push(a); report.assoc++;
        return a.id;
      };
      (d.associations || []).forEach(assocId);
      const newSeries = [], newBookings = [], newStages = [];
      for (const x of d.series || []) {
        const room = findRoom(x.room);
        if (!room) { report.skipped++; continue; }
        const kept = new Set(x.dates || []);
        const exceptions = [];
        for (let k = x.from; k <= x.to; k = addDays(k, 1)) if (weekdayIndex(k) === x.weekday && !kept.has(k)) exceptions.push(k);
        const extra = (x.rooms || []).map(findRoom).filter(Boolean).map((r) => r.id).filter((id) => id !== room.id);
        newSeries.push({ id: newId(), roomId: room.id, roomIds: extra, associationId: assocId(x.name), customName: "", startDate: x.from, endDate: x.to,
          start: x.start, end: x.end, frequency: "weekly", weekday: x.weekday, days: [x.weekday], exceptions,
          participants: "", contact: "", equipment: "", note: "", internalNote: "", status: x.status || "confirme",
          paymentStatus: x.exempt ? "exempt" : "unpaid", schoolYear: year });
        report.series++;
      }
      for (const x of d.bookings || []) {
        const room = findRoom(x.room);
        if (!room) { report.skipped++; continue; }
        const isA = x.assoc || (d.associations || []).some((n) => normName(n) === normName(x.name));
        const extraB = (x.rooms || []).map(findRoom).filter(Boolean).map((r) => r.id).filter((id) => id !== room.id);
        newBookings.push({ id: newId(), roomId: room.id, roomIds: extraB, associationId: isA ? assocId(x.name) : "", customName: isA ? "" : x.name,
          startDate: x.date, endDate: x.date, start: x.start, end: x.end, participants: "", contact: "", equipment: "",
          note: "", internalNote: "", status: x.status || "confirme", paymentStatus: x.exempt ? "exempt" : "unpaid", schoolYear: schoolYearOf(x.date) });
        report.bookings++;
      }
      for (const x of d.stages || []) {
        const floor = floors.find((f) => f.name === x.floor);
        const dates = x.dates || [];
        if (!floor || !dates.length) { report.skipped++; continue; }
        const roomIds = floorRoomIds(floor);
        const stageId = newId();
        const aId = assocId(x.name);
        newStages.push({ id: stageId, schoolYear: year, kind: x.kind || "base", label: x.label || x.name, floorName: floor.name, roomIds, dates,
          associationId: aId, customName: "", dayPrice: Number(floor.price) || 0, status: x.status || "confirme", paymentStatus: "unpaid", start: x.start, end: x.end });
        for (const k of dates) for (const roomId of roomIds) newBookings.push({ id: newId(), stageId, roomId, associationId: aId, customName: "",
          startDate: k, endDate: k, start: x.start, end: x.end, participants: "", contact: "", equipment: "", note: x.label || x.name,
          internalNote: "", status: x.status || "confirme", paymentStatus: "unpaid", schoolYear: schoolYearOf(k) });
        report.stages++;
      }
      if (report.rooms) update("Room", () => roomList);
      if (report.assoc) update("Association", () => assocs);
      if (newSeries.length) update("RecurringBooking", (l) => [...l, ...newSeries]);
      if (newBookings.length) update("Booking", (l) => [...l, ...newBookings]);
      if (newStages.length) update("Stage", (l) => [...l, ...newStages]);
      log("create", "Import", `Planning ${yearLabel(year)}`, `${report.series} série(s), ${report.bookings} réservation(s), ${report.stages} stage(s), ${report.assoc} association(s), ${report.rooms} salle(s)${d.source ? " · " + d.source : ""}`);
    });
    setDb(dbRef.current);   // pas de notification ici : elle remplacerait le bouton « Annuler »
    return report;
  };

  // ---------- suppression en lot : une association, une période ----------
  // Compte ce qui serait supprimé, sans rien modifier.
  const purgePreview = ({ assocId, from, to, series = true, bookings = true, stages = true }) => {
    const mine = (x) => x.associationId === assocId;
    const bk = bookings ? dbRef.current.Booking.filter((b) => mine(b) && !b.stageId && b.startDate <= to && b.endDate >= from) : [];
    const st = stages ? dbRef.current.Stage.filter((s) => mine(s) && (s.dates || []).some((d) => d >= from && d <= to)) : [];
    const sr = [];
    if (series) {
      for (const r of dbRef.current.RecurringBooking.filter(mine)) {
        const occ = sessionsInRange([], [r], from, to, db.Vacation).map((s) => s.date);
        if (!occ.length) continue;
        const all = sessionsInRange([], [r], r.startDate, r.endDate, db.Vacation).map((s) => s.date);
        sr.push({ series: r, occ, whole: occ.length >= all.length });
      }
    }
    return { bookings: bk, stages: st, series: sr, total: bk.length + st.length + sr.reduce((t, x) => t + x.occ.length, 0) };
  };

  // Supprime les réservations, les séances de série et les stages d'une association sur la période.
  // Une série partiellement concernée n'est pas supprimée : ses séances de la période sont retirées.
  const purge = (opts) => {
    const pv = purgePreview(opts);
    if (!pv.total) { notify("Rien à supprimer sur cette période"); return pv; }
    const a = dbRef.current.Association.find((x) => x.id === opts.assocId);
    withUndo(`Suppression : ${(a && a.name) || "association"} du ${frShort(opts.from)} au ${frShort(opts.to)}`, ["Booking", "RecurringBooking", "Stage"], () => {
      const bkIds = new Set(pv.bookings.map((b) => b.id));
      const stIds = new Set(pv.stages.map((s) => s.id));
      const dropSeries = new Set(pv.series.filter((x) => x.whole).map((x) => x.series.id));
      const trim = new Map(pv.series.filter((x) => !x.whole).map((x) => [x.series.id, x.occ]));
      if (bkIds.size || stIds.size) update("Booking", (l) => l.filter((b) => !bkIds.has(b.id) && !(b.stageId && stIds.has(b.stageId))));
      if (stIds.size) update("Stage", (l) => l.filter((s) => !stIds.has(s.id)));
      if (dropSeries.size || trim.size) update("RecurringBooking", (l) => l.filter((r) => !dropSeries.has(r.id)).map((r) => (trim.has(r.id) ? { ...r, exceptions: [...new Set([...(r.exceptions || []), ...trim.get(r.id)])] } : r)));
      log("delete", "Réservation", (a && a.name) || "Association", `${pv.total} séance(s) supprimée(s) du ${frShort(opts.from)} au ${frShort(opts.to)}`);
    });
    setDb(dbRef.current);
    return pv;
  };

  // ---------- rentrée : reconduire les séries vers l'année suivante ----------
  const sigOf = (r) => [r.roomId, r.start, r.end, (r.days && r.days.length ? r.days : [r.weekday]).join(","), r.frequency].join("|");
  const nameOfSeries = (r) => { const a = dbRef.current.Association.find((x) => x.id === r.associationId); return (a && a.name) || r.customName || "Réservation"; };

  // Ce que donnerait la reconduction, sans rien modifier : conflits et doublons repérés
  const rentreePreview = (targetYear) => {
    const src = dbRef.current.RecurringBooking.filter((r) => (r.schoolYear ?? schoolYearOf(r.startDate)) === targetYear - 1 && r.status !== "annule");
    const existing = dbRef.current.RecurringBooking.filter((r) => (r.schoolYear ?? schoolYearOf(r.startDate)) === targetYear && r.status !== "annule");
    return src.map((r) => {
      const days = r.days && r.days.length ? r.days : [r.weekday];
      const name = nameOfSeries(r);
      const duplicate = existing.some((x) => sigOf(x) === sigOf(r) && nameOfSeries(x).toLowerCase() === name.toLowerCase());
      const clash = duplicate ? null : existing.find((x) => x.roomId === r.roomId && (x.days && x.days.length ? x.days : [x.weekday]).some((d) => days.includes(d)) && timesOverlap(x.start, x.end, r.start, r.end));
      const room = dbRef.current.Room.find((x) => x.id === r.roomId);
      return {
        series: r, name, duplicate,
        conflict: clash ? `${nameOfSeries(clash)} (${clash.start}–${clash.end})` : null,
        roomName: room ? room.name : "Salle supprimée",
        dayLabel: days.map((d) => WEEKDAYS[d]).join(", "),
        timeLabel: `${r.start}–${r.end}`,
      };
    }).sort((a, c) => a.name.localeCompare(c.name, "fr"));
  };

  // Reconduit les séries choisies : dates décalées d'un an, statut « à valider »,
  // et surtout rattachées à la fiche d'association de l'année cible (créée au besoin).
  const carryOverSeries = (ids, targetYear) => {
    const chosen = new Set(ids);
    const src = dbRef.current.RecurringBooking.filter((r) => chosen.has(r.id));
    if (!src.length) { notify("Aucune série sélectionnée"); return { created: 0, associations: [] }; }
    const createdAssoc = [];
    withUndo(`Rentrée ${yearLabel(targetYear)} préparée`, ["RecurringBooking", "Association"], () => {
      const assocs = [...dbRef.current.Association];
      const findOrCreate = (oldId) => {
        const old = assocs.find((a) => a.id === oldId);
        if (!old) return "";
        const same = assocs.find((a) => a.schoolYear === targetYear && a.name.toLowerCase() === old.name.toLowerCase());
        if (same) return same.id;
        const copy = { ...old, id: newId(), schoolYear: targetYear };
        assocs.push(copy); createdAssoc.push(copy.name);
        return copy.id;
      };
      const shifted = src.map((r) => ({ ...r, id: newId(), schoolYear: targetYear, associationId: r.associationId ? findOrCreate(r.associationId) : "", startDate: addDays(r.startDate, 364), endDate: addDays(r.endDate, 364), exceptions: [], status: "a_confirmer", paymentStatus: "unpaid" }));
      if (createdAssoc.length) update("Association", () => assocs);
      update("RecurringBooking", (l) => [...l, ...shifted]);
      log("create", "Série", `Rentrée ${yearLabel(targetYear)}`, `${shifted.length} série(s) reconduite(s)${createdAssoc.length ? ` · ${createdAssoc.length} association(s) recréée(s)` : ""}`);
    });
    setDb(dbRef.current);
    return { created: src.length, associations: createdAssoc };
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
    const empty = !merged.opening && !merged.closing && !merged.absence && !merged.note && !merged.closed;
    if (!cur && empty) return;
    if (cur && empty) { update("DayNote", (l) => l.filter((n) => n.date !== d)); log("delete", "Note du jour", d); return; }
    if (cur) update("DayNote", (l) => l.map((n) => (n.date === d ? { ...n, ...patch } : n)));
    else update("DayNote", (l) => [...l, { id: newId(), date: d, opening: "", closing: "", absence: "", note: "", closed: false, ...patch }]);
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
  // Retire une journée d'un stage : toutes les salles de l'étage, et la date dans le stage (donc dans le relevé)
  const removeStageDay = (id, d) => {
    const before = dbRef.current.Stage.find((x) => x.id === id);
    if (!before) return;
    const dates = before.dates.filter((x) => x !== d);
    if (!dates.length) { deleteStage(id); return; }
    update("Stage", (l) => l.map((x) => (x.id === id ? { ...x, dates } : x)));
    update("Booking", (l) => l.filter((x) => !(x.stageId === id && x.startDate === d)));
    log("update", "Stage", `${before.label} · ${before.floorName}`, `Journée retirée : ${d}`);
    notify("Journée retirée du stage");
  };
  // Écarte des séances des relevés de frais (réservation : gratuite ; série : seulement la date concernée)
  const exemptSessions = (list) => {
    const bk = new Set(list.filter((s) => s.kind === "booking").map((s) => s.sourceId));
    const sr = new Map();
    list.filter((s) => s.kind === "series").forEach((s) => { if (!sr.has(s.sourceId)) sr.set(s.sourceId, []); sr.get(s.sourceId).push(s.date); });
    if (bk.size) update("Booking", (l) => l.map((x) => (bk.has(x.id) ? { ...x, paymentStatus: "exempt" } : x)));
    if (sr.size) update("RecurringBooking", (l) => l.map((x) => (sr.has(x.id) ? { ...x, noBill: [...new Set([...(x.noBill || []), ...sr.get(x.id)])] } : x)));
    log("update", "Réservation", `${list.length} séance(s) sans relevé de frais`);
  };
  const updateStageStatus = (id, patch) => {
    const before = dbRef.current.Stage.find((x) => x.id === id);
    if (!before) return;
    update("Stage", (l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    update("Booking", (l) => l.map((x) => (x.stageId === id ? { ...x, ...patch } : x)));
    log("update", "Stage", `${before.label} · ${before.floorName}`, diffDetail(before, patch, resolve));
  };

  // ---------- annuler les dernières actions (Ctrl+Z en chaîne) ----------
  const undo = () => {
    const stack = undoRef.current;
    const u = stack[stack.length - 1];
    if (!u) { notify("Rien à annuler"); return; }
    const entries = Object.entries(u.snap);
    entries.forEach(([n, list]) => { dbRef.current = { ...dbRef.current, [n]: list }; });
    const w = saveAll(entries);
    setDb(dbRef.current);
    undoRef.current = stack.slice(0, -1);
    syncUndo();
    log("update", "Annulation", u.label);
    const left = undoRef.current.length;
    notify(w.ok ? `Action annulée : ${u.label}${left ? ` · ${left} action${left > 1 ? "s" : ""} encore annulable${left > 1 ? "s" : ""}` : ""}` : w.error, w.ok ? "ok" : "error");
  };
  const withUndo = (label, names, fn) => {
    const snap = {};
    names.forEach((n) => { snap[n] = dbRef.current[n]; });
    inUndoableRef.current += 1;
    try { fn(); } finally { inUndoableRef.current -= 1; }
    undoRef.current = [...undoRef.current, { label, snap }].slice(-UNDO_MAX);
    syncUndo();
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
    // une salle ne peut pas accueillir deux groupes au même moment
    const room = toRoomId || s.roomId;
    const busy = allSessions(toDate, toDate).find((o) => o.roomId === room && o.sourceId !== s.sourceId && o.status !== "annule" && timesOverlap(o.start, o.end, s.start, s.end));
    if (busy) { notify(`Impossible : ${sessionName(busy, dbRef.current.Association)} occupe déjà cette salle de ${busy.start} à ${busy.end}`, "error"); return false; }
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
    if (inv.sourceIds && inv.sourceIds.length) {
      const ids = new Set(inv.sourceIds.filter((x) => x.startsWith("booking:")).map((x) => x.split(":")[1]));
      update("Booking", (l) => l.map((x) => { if (ids.has(x.id) && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
      log("update", "Réservation", `${inv.associationName} · ${from}`, `Réservation marquée payée (relevé ${inv.number})`);
      notify(n ? "Réservation marquée payée" : "Aucune réservation à marquer");
      return;
    }
    if (!a) { notify("Aucune séance à marquer"); return; }
    update("Booking", (l) => l.map((x) => { if (x.associationId === a && x.startDate >= from && x.endDate <= to && x.status === "confirme" && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
    update("RecurringBooking", (l) => l.map((x) => { if (x.associationId === a && x.startDate >= from && x.endDate <= to && x.status === "confirme" && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
    update("Stage", (l) => l.map((x) => { if (x.associationId === a && x.dates[0] >= from && x.dates[x.dates.length - 1] <= to && x.status === "confirme" && x.paymentStatus === "unpaid") { n++; return { ...x, paymentStatus: "paid" }; } return x; }));
    log("update", "Réservation", `${inv.associationName} · ${from} → ${to}`, `Séances marquées payées (relevé ${inv.number})`);
    notify(n ? `${n} réservation(s) / série(s) / stage(s) marqué(s) payé(s)` : "Aucune séance à marquer");
  };
  const saveInvoicesBatch = (list) => list.map((st) => saveInvoice(st));

  // ---------- contrôle des paiements d'une période ----------
  // Cocher une ligne : on encaisse les relevés qui couvrent la période et on marque
  // payées les réservations, séries et stages entièrement compris dedans. Décocher
  // défait exactement ce que le contrôle avait fait, sans toucher aux règlements
  // saisis à la main dans le registre.
  const setControlPaid = (row, from, to, paid, opts = {}) => {
    withUndo(`${paid ? "Paiement confirmé" : "Paiement décoché"} : ${row.name} (${frShort(from)} → ${frShort(to)})`, ["Booking", "RecurringBooking", "Stage", "Invoice"], () => {
      for (const inv of row.invoices || []) {
        const cur = dbRef.current.Invoice.find((x) => x.id === inv.id);
        if (!cur) continue;
        let payments;
        if (paid) {
          const rest = round2(Number(cur.total || 0) - Number(cur.amountPaid || 0));
          if (rest <= 0.005) continue;
          payments = [...(cur.payments || []), { amount: rest, method: opts.method || "virement", date: opts.date || todayKey(), reference: opts.reference || "", source: "controle" }];
        } else {
          payments = (cur.payments || []).filter((p) => p.source !== "controle");
          if (payments.length === (cur.payments || []).length) continue;
        }
        const amountPaid = round2(payments.reduce((t, p) => t + Number(p.amount || 0), 0));
        const status = amountPaid >= round2(Number(cur.total || 0)) - 0.005 ? "paid" : amountPaid > 0 || cur.sentAt ? "sent" : "draft";
        update("Invoice", (l) => l.map((x) => (x.id === cur.id ? { ...x, payments, amountPaid, status } : x)));
      }
      const next = paid ? "paid" : "unpaid";
      const mine = (x) => (row.assocId ? x.associationId === row.assocId : !x.associationId && coproName(x.customName) === row.name);
      const ok = (x) => x.status === "confirme" && x.paymentStatus !== "exempt" && x.paymentStatus !== next;
      update("Booking", (l) => l.map((x) => (mine(x) && ok(x) && x.startDate >= from && x.endDate <= to ? { ...x, paymentStatus: next } : x)));
      update("RecurringBooking", (l) => l.map((x) => (mine(x) && ok(x) && x.startDate >= from && x.endDate <= to ? { ...x, paymentStatus: next } : x)));
      update("Stage", (l) => l.map((x) => (mine(x) && ok(x) && (x.dates || [])[0] >= from && (x.dates || [])[(x.dates || []).length - 1] <= to ? { ...x, paymentStatus: next } : x)));
      log("update", "Contrôle des paiements", `${row.name} · ${frShort(from)} → ${frShort(to)}`, paid ? "marqué payé" : "remis à non payé");
    });
  };

  // ---------- vacances officielles ----------
  const addOfficialHolidays = () => {
    const have = dbRef.current.Vacation;
    const toAdd = SCHOOL_HOLIDAYS_C.filter((h) => !have.some((v) => v.startDate === h.startDate && v.label === h.label)).map((h) => ({ id: newId(), schoolYear: schoolYearOf(h.startDate), ...h }));
    if (!toAdd.length) { notify("Les vacances officielles sont déjà toutes ajoutées"); return; }
    update("Vacation", (l) => [...l, ...toAdd]);
    log("create", "Vacances scolaires", `${toAdd.length} période(s) officielles (zone C)`);
    notify(`${toAdd.length} période(s) de vacances ajoutée(s)`);
  };

  // ---------- archivage des anciennes années ----------
  // On garde l'année en cours et les KEEP_YEARS - 1 précédentes ; au-delà, les données
  // partent dans un fichier par année (dossier « archives ») et quittent le planning.
  const archivable = useMemo(() => {
    const limit = schoolYearOf(todayKey()) - (KEEP_YEARS - 1);
    const m = new Map();
    for (const [name, y] of entityYears(db)) { if (y < limit) { if (!m.has(y)) m.set(y, { year: y, counts: {}, total: 0 }); const g = m.get(y); g.counts[name] = (g.counts[name] || 0) + 1; g.total++; } }
    return [...m.values()].sort((a, b) => a.year - b.year);
  }, [db]);

  const splitYear = (data, y) => {
    const keep = {}, out = {};
    for (const e of ENTITIES) { keep[e] = []; out[e] = []; }
    for (const e of ENTITIES) for (const x of data[e]) (yearOfRecord(e, x) === y ? out[e] : keep[e]).push(x);
    return { keep, out };
  };

  const archiveYear = async (y) => {
    const { keep, out } = splitYear(dbRef.current, y);
    const n = ENTITIES.reduce((t, e) => t + out[e].length, 0);
    if (!n) { notify("Rien à archiver pour " + yearLabel(y)); return; }
    try {
      if (canArchiveYears()) { const r = await writeArchive(y, out); notify(`Année ${yearLabel(y)} archivée (${n} éléments) dans le dossier « archives »`); log("update", "Archive", yearLabel(y), `${n} éléments archivés · ${r.path || ""}`); }
      else { download(`planning-annee-${y}-${y + 1}.json`, "application/json", JSON.stringify({ app: "planning-des-salles", kind: "archive", year: y, savedAt: new Date().toISOString(), data: out }, null, 1)); notify(`Année ${yearLabel(y)} : fichier téléchargé, rangez-le puis confirmez`); log("update", "Archive", yearLabel(y), `${n} éléments archivés (téléchargement)`); }
    } catch (e) { notify("Archivage impossible : " + e.message, "error"); return; }
    const w = saveAll(ENTITIES.map((e) => [e, keep[e]]));
    if (!w.ok) { notify(w.error, "error"); return; }
    withUndo(`Année ${yearLabel(y)} retirée du planning`, ENTITIES, () => { dbRef.current = keep; });
    setDb(dbRef.current);
  };

  // Réintègre une archive (doublons ignorés) sans toucher aux années en cours
  const restoreArchive = (text) => {
    let obj; try { obj = JSON.parse(text); } catch (e) { notify("Fichier illisible", "error"); return; }
    const d = obj && obj.data;
    if (!d || typeof d !== "object") { notify("Ce fichier n'est pas une archive", "error"); return; }
    let n = 0;
    withUndo(`Archive ${obj.year ? yearLabel(obj.year) : ""} réintégrée`.trim(), ENTITIES, () => {
      const next = { ...dbRef.current };
      const writes = [];
      for (const e of ENTITIES) {
        if (!Array.isArray(d[e]) || e === "OrganisationSettings" || e === "Room") continue;
        const have = new Set(next[e].map((x) => x.id));
        const add = d[e].filter((x) => x && x.id && !have.has(x.id));
        if (add.length) { next[e] = [...next[e], ...add]; writes.push([e, next[e]]); n += add.length; }
      }
      const w = saveAll(writes);
      if (!w.ok) { notify(w.error, "error"); n = -1; return; }
      dbRef.current = next;
    });
    setDb(dbRef.current);
    if (n >= 0) notify(n ? `${n} élément(s) réintégré(s)` : "Ces données sont déjà dans le planning");
  };

  // ---------- sauvegarde ----------
  const exportBackup = () => download(`planning-des-salles-sauvegarde-${todayKey()}.json`, "application/json", exportJson(dbRef.current));
  const importBackup = (text) => {
    const data = parseBackup(text);
    const w = saveAll(ENTITIES.map((e) => [e, data[e]]));
    if (!w.ok) { notify(w.error, "error"); return; }   // rien n'est écrasé si l'écriture échoue
    dbRef.current = data;
    setDb(data);
    notify("Sauvegarde importée");
  };

  const years = useMemo(() => {
    const cur = schoolYearOf(todayKey());
    const set = new Set();
    for (let y = cur - 3; y <= cur + 5; y++) set.add(y);
    // plus toutes les années qui contiennent des données
    for (const n of ["Association", "RecurringBooking", "Invoice", "Stage"]) for (const x of db[n]) if (Number.isInteger(x.schoolYear)) set.add(x.schoolYear);
    for (const x of db.Booking) if (x.startDate) set.add(schoolYearOf(x.startDate));
    set.add(year);
    return [...set].sort((a, c) => a - c);
  }, [year, db.Association, db.RecurringBooking, db.Invoice, db.Stage, db.Booking]);

  const value = {
    db, year, setYear, years, openReq, requestOpenDay: (d, roomId) => { setNav({ date: d, year: schoolYearOf(d) }); setOpenReq({ date: d, roomId, n: Date.now() }); }, clearOpenReq: () => setOpenReq(null), ask, dialog, closeDialog: () => setDialog(null), date, setDate, actor, setActor, notify, toast,
    rooms, associations, bookings, recurring, invoices, closures, templates, vacations, stages, floors, floorRoomIds, addVacation, deleteVacation: wrap("Vacances supprimées", ["Vacation"], deleteVacation), saveStage: (p, rid) => (rid ? withUndo("Stage modifié", ["Stage", "Booking"], () => saveStage(p, rid)) : saveStage(p)), deleteStage: wrap("Stage supprimé", ["Stage", "Booking"], deleteStage), updateStageStatus, removeStageDay: (id, d) => withUndo("Journée retirée du stage", ["Stage", "Booking"], () => removeStageDay(id, d)), exemptSessions: (list, label = "Séance(s) sans relevé") => withUndo(label, ["Booking", "RecurringBooking"], () => exemptSessions(list)), isLate, org, dayNotes, dayNoteFor,
    sessions, sessionsFor, allSessions,
    addRoom, updateRoom, deleteRoom: wrap("Salle supprimée", ["Room", "Booking", "RecurringBooking", "Closure"], deleteRoom),
    addAssociation, updateAssociation, deleteAssociation: wrap("Association supprimée", ["Association"], deleteAssociation), copyPreviousYearAssociations,
    saveBooking, deleteBooking: wrap("Réservation supprimée", ["Booking"], deleteBooking), updateBookingPayment, updateBookingFields, setSourceFields, setSourceFieldsBulk, moveSession, undoable: withUndo, undo, undoTop, markPeriodPaid, saveInvoicesBatch, addOfficialHolidays,
    sync, reloadRemote, overwriteRemote, chooseFolder, adoptFolder, revertFolder, useLocalFolder, openFolder,
    saveRecurring, deleteRecurring: wrap("Série supprimée", ["RecurringBooking"], deleteRecurring), cancelOccurrence: wrap("Séance annulée", ["RecurringBooking"], cancelOccurrence), updateRecurringFields,
    addClosure, deleteClosure: wrap("Fermeture supprimée", ["Closure"], deleteClosure),
    saveInvoice, patchInvoice, dueItems, setControlPaid, purgePreview, purge, importPreview, importPlanning, rentreePreview, carryOverSeries, addInvoicePayment, deleteInvoice: wrap("Relevé de frais supprimé", ["Invoice"], deleteInvoice),
    saveTemplate, deleteTemplate: wrap("Modèle supprimé", ["BookingTemplate"], deleteTemplate), updateOrg, saveDayNote,
    assocOf, allAssociations: db.Association, yearSessions, exportBackup, importBackup, archivable, archiveYear, restoreArchive, keepYears: KEEP_YEARS,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
