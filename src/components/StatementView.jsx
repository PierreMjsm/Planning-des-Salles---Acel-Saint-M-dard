import React from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { fmtDec, fmtMoney } from "../lib/planner/format.js";
import { dmy, dmy2, hm, frLongDay } from "../lib/planner/statements.js";
import { frLong } from "../lib/planner/dates.js";

const T = { border: "1px solid #000", padding: "3px 8px", fontSize: 12.5 };
const fr = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function Header({ org, title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        <div style={{ fontSize: 20, fontWeight: 700, textTransform: "uppercase" }}>{org.name}</div>
        <div style={{ fontSize: 10, fontStyle: "italic", textTransform: "uppercase", marginBottom: 8, maxWidth: 260 }}>{org.subtitle}</div>
        <div style={{ whiteSpace: "pre-line" }}>{org.address}</div>
        {org.phone && <div>Tél. : {org.phone}</div>}
        {org.email && <div>Mel : {org.email}{org.website ? ` - site : ${org.website}` : ""}</div>}
        {org.siret && <div style={{ fontSize: 11 }}>SIRET {org.siret}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
    </div>
  );
}

function Footer({ org, showRib }) {
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ textAlign: "right", marginRight: 30 }}>
        {org.signatory && <div style={{ fontSize: 13 }}>{org.signatory}</div>}
        {org.signImage && <img src={org.signImage} alt="" style={{ maxWidth: 200, maxHeight: 90 }} />}
      </div>
      {showRib && org.ribImage && <img src={org.ribImage} alt="RIB" style={{ maxWidth: "88%", display: "block", marginTop: 14 }} />}
      {org.legal && <p style={{ fontSize: 10.5, marginTop: 16, whiteSpace: "pre-line", color: "#555" }}>{org.legal}</p>}
    </div>
  );
}

// Les trois modèles de « Relevé de frais » : associations (heures), copropriétés (prix fixe), stages BAFA
export default function StatementView({ st }) {
  const { org } = usePlanner();
  const issued = st.issuedAt;
  const base = { fontFamily: "Arial, Helvetica, sans-serif", color: "#000", background: "#fff", padding: "26px 30px", maxWidth: 820, margin: "0 auto", fontSize: 13 };
  const ref = st.number ? <div style={{ fontSize: 10, color: "#777", marginTop: 4 }}>Réf. {st.number}</div> : null;

  // anciens relevés enregistrés avant les nouveaux modèles
  if (!st.kind) return (
    <div style={base}>
      <Header org={org} title="Relevé de frais" right={<div style={{ fontSize: 12 }}>Paris, le {frLong(issued)}</div>} />
      <p style={{ margin: "22px 0 8px" }}><b>{st.associationName}</b></p>
      <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>{(st.lines || []).map((l, i) => <tr key={i}><td style={T}>{l.label}</td><td style={T}>{l.detail}</td><td style={{ ...T, textAlign: "right" }}>{fmtMoney(l.amount)}</td></tr>)}</tbody></table>
      <p style={{ textAlign: "right", marginTop: 10 }}><b>Total : {fmtMoney(st.total)}</b></p>
      <Footer org={org} showRib />
    </div>
  );

  if (st.kind === "hourly") return (
    <div style={base}>
      <Header org={org} title="Relevé de frais" right={
        <table style={{ marginLeft: "auto", fontSize: 12, textAlign: "left", marginTop: 10 }}><tbody>
          <tr><td style={{ paddingRight: 14 }}><b>DATE :</b></td><td>{frLong(issued)}</td></tr>
          <tr><td><b>POUR :</b></td><td>Les mois de :</td></tr>
          <tr><td></td><td><b>{st.monthsLabel}</b></td></tr></tbody></table>} />
      <div style={{ margin: "18px 0 6px", fontSize: 12.5 }}>
        <div><b>{st.associationName}</b></div>
        {st.address && <div style={{ whiteSpace: "pre-line" }}>{st.address}</div>}
        {st.email && <div>{st.email}</div>}
      </div>
      {st.roomsLabel && <p style={{ textAlign: "center", margin: "12px 0", fontSize: 12.5 }}>{st.multiRoom ? "Salles occupées" : "Salle occupée"} : <b>{st.multiRoom ? st.roomsLabel : `Salle ${st.roomsLabel.toUpperCase()}`}</b></p>}
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{["DESCRIPTION", "DATE", "HEURES", "PRIX / HEURE", "MONTANT"].map((h) => <th key={h} style={{ ...T, fontWeight: 400, textAlign: "center" }}>{h}</th>)}</tr></thead>
        <tbody>
          {st.rows.map((r, i) => <tr key={i}><td style={T}>{st.multiRoom ? `${r.label} — ${r.room}` : r.label}</td><td style={{ ...T, textAlign: "center" }}>{dmy2(r.date)}</td><td style={{ ...T, textAlign: "center" }}>{fr(r.hours)}</td><td style={{ ...T, textAlign: "center" }}>{fmtMoney(r.rate)}</td><td style={{ ...T, textAlign: "right" }}>{fmtMoney(r.amount)}</td></tr>)}
          {st.extras.map((e, i) => <tr key={"x" + i}><td style={{ ...T, fontWeight: 700 }} colSpan={4}>{e.label}</td><td style={{ ...T, textAlign: "right" }}>{fmtMoney(e.amount)}</td></tr>)}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14, marginTop: 6, fontSize: 12 }}>
        <span style={{ fontSize: 10 }}>Total d'heure</span><b>{fr(st.totalHours)}</b><b style={{ marginLeft: 20 }}>TOTAL</b>
        <span style={{ border: "1px solid #000", background: "#eee", padding: "3px 10px", minWidth: 110, textAlign: "right" }}>{fmtMoney(st.total)}</span>
      </div>
      <p style={{ marginTop: 16 }}>Nous vous remercions d'adresser un règlement de : <b>{fmtMoney(st.total)}</b></p>
      <p style={{ fontSize: 12, marginTop: 6 }}>Veuillez libeller votre chèque à l'ordre de l'{org.name} ou effectuer un virement aux coordonnées bancaires ci-dessous.</p>
      <Footer org={org} showRib />
      {ref}
    </div>
  );

  if (st.kind === "fixed") return (
    <div style={base}>
      <div style={{ fontSize: 13, lineHeight: 1.45 }}>
        <div style={{ fontSize: 17, fontWeight: 700, textTransform: "uppercase" }}>{org.name}</div>
        <div style={{ whiteSpace: "pre-line" }}>{org.address}</div>
        {org.phone && <div>Tél. {org.phone}</div>}
        {org.email && <div>Courrier électronique : {org.email}</div>}
        {org.website && <div>Site : {org.website}</div>}
        {org.siret && <div style={{ marginTop: 6 }}>Siret : {org.siret.replace(/\s/g, "")}</div>}
      </div>
      <div style={{ textAlign: "right", margin: "6px 0 22px" }}>Paris, le {frLong(issued)}</div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div>Copropriété :</div>
        <div style={{ fontWeight: 700 }}>{st.associationName}{st.address ? ` - ${st.address.replace(/\n/g, " ")}` : ""}</div>
      </div>
      <h2 style={{ textAlign: "center", fontSize: 22, margin: "18px 0 22px" }}>Relevé de Frais</h2>
      {st.rows.length === 1 ? (
        <div style={{ textAlign: "center", lineHeight: 1.7 }}>
          <div>Participation aux frais de mise à disposition de salle du {st.rows[0].label}</div>
          <div>Salle {st.rows[0].room} de {hm(st.rows[0].start)} à {hm(st.rows[0].end)}</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", lineHeight: 1.6 }}>
          <div style={{ marginBottom: 6 }}>Participation aux frais de mise à disposition de salle :</div>
          {st.rows.map((r, i) => <div key={i}>Le {r.label} — Salle {r.room} de {hm(r.start)} à {hm(r.end)} : {fmtMoney(r.amount)}</div>)}
        </div>
      )}
      <p style={{ textAlign: "center", fontWeight: 700, margin: "26px 0", fontSize: 15 }}>Soit un total de {fmtMoney(st.total)}</p>
      <Footer org={org} showRib={false} />
      {ref}
    </div>
  );

  // stage
  return (
    <div style={base}>
      <Header org={org} title="Relevé de frais" />
      <div style={{ textAlign: "right", margin: "6px 0 14px", fontSize: 12.5 }}>Paris, le {frLong(issued)}</div>
      <div style={{ marginLeft: "36%", fontSize: 13, lineHeight: 1.4, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, textTransform: "uppercase" }}>{st.associationName}</div>
        <div style={{ whiteSpace: "pre-line" }}>{st.address}</div>
      </div>
      <p style={{ lineHeight: 1.5, marginBottom: 14 }}>Participation aux frais de mise à disposition des salles pour les stages BAFA qui étaient programmés et qui se sont déroulés à la Maison des Jeunes de Saint Médard du {dmy(st.from)} au {dmy(st.to)}.</p>
      <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
        {st.rows.map((r, i) => <tr key={i}><td style={T}>{r.label}</td><td style={{ ...T, textAlign: "center" }}>{dmy(r.from)}</td><td style={{ ...T, textAlign: "center" }}>{dmy(r.to)}</td><td style={{ ...T, textAlign: "center" }}>{r.days} jours</td><td style={{ ...T, textAlign: "center" }}>{r.floor}</td></tr>)}
      </tbody></table>
      <div style={{ margin: "16px 0", lineHeight: 1.7, fontSize: 13 }}>
        {st.groups.map((g, i) => <div key={i}>{g.label} : {g.days} jours x {fmtDec(g.price)} € = {fmtMoney(g.amount)}</div>)}
      </div>
      <p style={{ textAlign: "center", fontWeight: 700, margin: "18px 0" }}>Soit un Total de {fmtMoney(st.total)}</p>
      <p style={{ margin: "14px 0" }}>Nous vous remercions de votre confiance.</p>
      <Footer org={org} showRib />
      {ref}
    </div>
  );
}
