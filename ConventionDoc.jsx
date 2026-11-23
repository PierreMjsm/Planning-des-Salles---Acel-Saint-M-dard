import React from "react";
import { usePlanner } from "../lib/planner/PlannerContext.jsx";
import { frLong } from "../lib/planner/dates.js";
import { frLongDay } from "../lib/planner/statements.js";
import { fmtDec } from "../lib/planner/format.js";
import { tariffTable, seasonLabel } from "../lib/planner/convention.js";

// Les deux pages de la « Demande de mise à disposition » : le courrier
// d'accompagnement et la fiche à remplir, suivie du tableau des tarifs.
const T = { border: "1px solid #000", padding: "3px 7px", fontSize: 12 };
const line = { borderBottom: "1px dotted #999", minHeight: 17, margin: "2px 0 10px" };

function Entete({ org }) {
  return (
    <div style={{ textAlign: "center", lineHeight: 1.45 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{org.name} <span style={{ fontWeight: 400 }}>(Association Loi de 1901)</span></div>
      <div style={{ fontSize: 12 }}>Siège social : {String(org.address || "").split("\n").slice(-2).join(" ").replace(/\s+/g, " ").trim()}{org.phone ? ` - Tél : ${org.phone}` : ""}{org.email ? ` – ${org.email}` : ""}</div>
    </div>
  );
}

export default function ConventionDoc({ cfg, year }) {
  const P = usePlanner();
  const org = P.org;
  const season = seasonLabel(year);
  const table = tariffTable(P.rooms);
  const base = { fontFamily: "Arial, Helvetica, sans-serif", color: "#000", background: "#fff", padding: "26px 34px", maxWidth: 820, margin: "0 auto", fontSize: 12.5, textAlign: "left", lineHeight: 1.45 };
  return (
    <div>
      {/* ---------- page 1 : le courrier ---------- */}
      <div style={base} className="sheet-break">
        <Entete org={org} />
        <p style={{ margin: "26px 0 18px" }}>Paris, le {frLong(cfg.letterDate)}</p>
        <p style={{ fontWeight: 700, marginBottom: 16 }}>Aux responsables d'activités de la Maison des Jeunes de Saint Médard</p>
        <p style={{ marginBottom: 14 }}>Madame, Monsieur,</p>
        <p style={{ textAlign: "justify", marginBottom: 8 }}>La rentrée {season} approche, vous trouverez donc ci-joint la fiche qui nous permettra d'établir la convention de mise à disposition des salles pour l'année {season}. Quelques informations importantes :</p>
        <ul style={{ margin: "0 0 14px 18px", padding: 0 }}>
          <li style={{ marginBottom: 4 }}>La Maison des Jeunes de Saint Médard ouvrira ses portes à vos activités à partir du <b>{frLongDay(cfg.openingDate)}</b>.</li>
          <li style={{ marginBottom: 4 }}>Afin de vous permettre de mettre à jour vos tarifs, nous vous joignons une mise à jour du tarif des salles pour cette nouvelle saison.</li>
          <li style={{ marginBottom: 4 }}>Si vous avez un site internet, merci de nous fournir l'adresse afin que nous puissions établir un lien depuis le site de la Maison des Jeunes.</li>
          <li>Si vous n'avez pas de site internet, merci de nous fournir un descriptif de votre activité et les coordonnées que nous pouvons mettre sur notre site de la Maison des Jeunes.</li>
        </ul>
        <p style={{ textAlign: "justify", marginBottom: 6 }}><b>IMPERATIF</b> : <b>Pour des raisons de sécurité</b> et afin de mieux connaitre le public qui fréquente la Maison des Jeunes de saint Médard, nous demandons aux associations qui accueillent des jeunes de moins de 18 ans de bien vouloir nous transmettre une liste des jeunes fréquentant vos activités durant la saison {season}, comportant :</p>
        <p style={{ marginBottom: 14 }}>Nom et Prénom / Date de naissance / Adresse complète / Téléphone des parents ou tuteurs légaux.</p>
        <p style={{ textAlign: "justify", marginBottom: 14 }}>Nous vous remercions de nous fournir cette liste pour le {frLong(cfg.minorsDeadline)}. Cette liste devra être réactualisée chaque fin de trimestre durant la saison {season}. <u>Nous vous rappelons que ces mineurs restent sous la responsabilité de votre association avant et après votre activité</u>.</p>
        <p style={{ textAlign: "justify", marginBottom: 14 }}>Par ailleurs, aucun mineur ne doit rester dans la cour sans surveillance du responsable de l'activité. Merci de vérifier en partant qu'<u><b>aucune personne, mineur ou majeur ne reste dans les locaux ou dans la cour</b></u>.</p>
        <p style={{ marginBottom: 4 }}>Si vous le souhaitez, vous pouvez nous fournir également :</p>
        <ul style={{ margin: "0 0 14px 18px", padding: 0 }}>
          <li style={{ marginBottom: 4 }}>Une affichette sur papier couleur (A4 21x29,7 formats « portrait » exclusivement) pour le panneau du hall d'entrée qui présente votre activité, les horaires et les coordonnées où joindre le responsable de l'activité.</li>
          <li>Un tract (format A5 ou A6) qui sera transmis aux personnes qui en feront la demande.<br />Merci de nous en faire parvenir 20 exemplaires.</li>
        </ul>
        <p style={{ textAlign: "justify", marginBottom: 14 }}>Merci de bien vouloir nous renvoyer la fiche jointe dument complétée avant le {frLong(cfg.returnDeadline)} pour pouvoir réserver votre créneau car nous avons de très nombreuses demandes. Si votre activité s'interrompt, merci de nous le signaler rapidement.</p>
        <p style={{ textAlign: "justify", marginBottom: 18 }}>Nous vous souhaitons à tous un bel été et nous espérons que nous continuerons ensemble à être au service des jeunes et des habitants de ce quartier.</p>
        <div style={{ textAlign: "right", marginRight: 40 }}>
          <div>{cfg.signatories}</div>
          {org.signImage && <img src={org.signImage} alt="" style={{ maxWidth: 200, maxHeight: 90 }} />}
        </div>
      </div>

      {/* ---------- page 2 : la fiche et les tarifs ---------- */}
      <div style={base}>
        <Entete org={org} />
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <div style={{ fontWeight: 700 }}>Saison {season}</div>
          <div>Demande de mise à disposition de salles pour une activité régulière</div>
        </div>
        <div style={{ marginTop: 18 }}>
          <div>Nom de l'association :</div>
          <div style={{ fontSize: 10.5 }}>(Merci de nous fournir la liste actualisée de votre conseil d'administration en cas de changement)</div>
          <div style={line} />
          <div>Nom du responsable de l'association :</div><div style={line} />
          <div>Fonction dans l'association :</div><div style={line} />
          <div style={{ display: "flex", gap: 30 }}><div style={{ flex: 1 }}>Téléphone :<div style={line} /></div><div style={{ flex: 1 }}>Adresse mél :<div style={line} /></div></div>
          <div>Adresse du site internet :</div><div style={line} />
          <div>Salles et horaires souhaités en {season} :</div>
          <div style={{ fontSize: 10.5 }}>(Nous restons sur la base des horaires de la saison passée. Les changements d'horaires devront être validés)</div>
          <div style={{ ...line, minHeight: 34 }} />
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div>Nombre de participants approximatif :</div><div style={line} />
              <div>Date souhaitée de la reprise de vos activités :</div><div style={line} />
              <div style={{ marginBottom: 4 }}>❑ Nous sommes susceptibles de continuer nos activités<br /><span style={{ marginLeft: 16 }}>pendant les vacances scolaires</span></div>
              <div>❑ Nous ne sommes jamais présents pendant les vacances scolaires</div>
            </div>
            <div style={{ width: 250, border: "1px solid #000", minHeight: 120, padding: 8 }}>Date et signature :</div>
          </div>
        </div>
        <div style={{ borderTop: "1px dashed #000", margin: "16px 0 10px" }} />
        <p style={{ marginBottom: 12 }}>Merci de nous retourner ce coupon le plus rapidement possible afin que nous puissions établir la convention</p>
        <table style={{ borderCollapse: "collapse", width: "82%", margin: "0 auto" }}>
          <thead><tr><th style={{ ...T, width: "48%" }}>Salles</th><th style={{ ...T, width: "28%" }}>Zones</th><th style={{ ...T }}>Tarifs</th></tr></thead>
          <tbody>
            {table.map((g) => (
              <React.Fragment key={g.section}>
                <tr><td style={{ ...T, background: "#D9D9D9", fontWeight: 700, textAlign: "center" }} colSpan={3}>{g.section}</td></tr>
                {g.lines.map((l) => <tr key={l.roomId}><td style={T}>{l.label}</td><td style={T}>{l.zone}</td><td style={T}>{fmtDec(l.rate)} euros</td></tr>)}
              </React.Fragment>
            ))}
            {table.length === 0 && <tr><td style={T} colSpan={3}>Aucune salle rangée dans une section (Réglages › Salles).</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
