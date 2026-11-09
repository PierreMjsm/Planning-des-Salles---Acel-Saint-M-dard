import { STATUS_LABELS, PAYMENT_LABELS } from "./constants.js";
import { sessionName } from "./occurrences.js";
import { csvNum } from "./format.js";

export function download(filename, mime, content) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const q = (c) => `"${String(c === undefined || c === null ? "" : c).replace(/"/g, '""')}"`;
const toCsv = (rows) => "\uFEFF" + rows.map((r) => r.map(q).join(";")).join("\r\n");

export function planningCsv(sessions, associations, rooms) {
  const rows = [["Date", "Salle", "Association", "Début", "Fin", "Statut", "Paiement", "Participants", "Contact", "Matériel", "Note"]];
  for (const s of sessions) {
    const room = rooms.find((r) => r.id === s.roomId);
    rows.push([s.date, room ? room.name : "", sessionName(s, associations), s.start, s.end, STATUS_LABELS[s.status], PAYMENT_LABELS[s.paymentStatus], s.participants, s.contact, s.equipment, s.note]);
  }
  return toCsv(rows);
}

const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const icsDt = (d, t) => `${d.replace(/-/g, "")}T${(t || "00:00").replace(":", "")}00`;

export function planningIcs(sessions, associations, rooms) {
  const st = { confirme: "CONFIRMED", a_confirmer: "TENTATIVE", annule: "CANCELLED" };
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Planning des salles//FR", "CALSCALE:GREGORIAN"];
  for (const s of sessions) {
    const room = rooms.find((r) => r.id === s.roomId);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${s.id}@planning-salles`);
    lines.push(`DTSTAMP:${icsDt(s.date, "00:00")}`);
    lines.push(`DTSTART:${icsDt(s.date, s.start)}`);
    lines.push(`DTEND:${icsDt(s.date, s.end)}`);
    lines.push(`SUMMARY:${icsEsc(`${sessionName(s, associations)} - ${room ? room.name : ""}`)}`);
    if (room) lines.push(`LOCATION:${icsEsc(room.name)}`);
    const d = [];
    if (s.note) d.push(s.note);
    if (s.contact) d.push(`Contact : ${s.contact}`);
    if (s.equipment) d.push(`Matériel : ${s.equipment}`);
    if (s.participants) d.push(`Participants : ${s.participants}`);
    if (d.length) lines.push(`DESCRIPTION:${icsEsc(d.join(" | "))}`);
    lines.push(`STATUS:${st[s.status] || "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function invoicesCsv(invoices) {
  const rows = [["Numero", "Date", "Echeance", "Association", "Debut", "Fin", "Total", "Encaisse", "Reste", "Statut", "Reglements"]];
  for (const i of invoices) {
    const rest = Math.max(0, (i.total || 0) - (i.amountPaid || 0));
    const pays = (i.payments || []).map((p) => `${p.date} ${p.method} ${csvNum(p.amount)}${p.note ? ` ${p.note}` : ""}`).join(" | ");
    rows.push([i.number, i.issuedAt, i.dueDate, i.associationName, i.periodStart, i.periodEnd, csvNum(i.total), csvNum(i.amountPaid), csvNum(rest), i.status === "paid" ? "Payee" : "En attente", pays]);
  }
  return toCsv(rows);
}
