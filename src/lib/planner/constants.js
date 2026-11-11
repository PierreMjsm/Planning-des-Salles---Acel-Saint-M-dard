export const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MONTH_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
export const WEEKDAY_ABBR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export const STATUS_LABELS = { confirme: "Validée", a_confirmer: "En attente de validation", annule: "Refusée" };
export const STATUS_SHORT = { confirme: "Validée", a_confirmer: "En attente", annule: "Refusée" };
export const PAYMENT_LABELS = { unpaid: "Non payé", paid: "Payé", exempt: "Gratuit / Exonéré" };
export const PAYMENT_SHORT = { unpaid: "Non payé", paid: "Payé", exempt: "Gratuit" };
export const FREQUENCY_LABELS = { weekly: "Chaque semaine", weekdays: "Lun. au ven.", daily: "Tous les jours" };
export const FREQUENCY_TEXT = { weekly: "chaque semaine", weekdays: "du lundi au vendredi", daily: "tous les jours" };
export const PAYMENT_METHODS = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "especes", label: "Espèces" },
  { value: "carte", label: "Carte bancaire" },
  { value: "prelevement", label: "Prélèvement" },
];

export const PALETTE = [
  { bg: "#E1F5EE", border: "#5DCAA5", text: "#085041", name: "vert d'eau" },
  { bg: "#EEEDFE", border: "#AFA9EC", text: "#3C3489", name: "lavande" },
  { bg: "#FAECE7", border: "#F0997B", text: "#712B13", name: "terracotta" },
  { bg: "#FBEAF0", border: "#ED93B1", text: "#72243E", name: "rose" },
  { bg: "#E6F1FB", border: "#85B7EB", text: "#0C447C", name: "bleu ciel" },
  { bg: "#EAF3DE", border: "#97C459", text: "#27500A", name: "vert anis" },
  { bg: "#FAEEDA", border: "#EF9F27", text: "#633806", name: "ambre" },
  { bg: "#FCEBEB", border: "#F09595", text: "#791F1F", name: "corail" },
];
export const REFUSED_STYLE = { bg: "#F3F1EA", border: "#DDD9CD", text: "#8A877E" };

export const DAY_START = "08:00";
export const DAY_END = "22:00";
export const DEFAULT_START = "09:00";
export const DEFAULT_END = "11:00";
export const AVAIL_START = "18:00";
export const AVAIL_END = "20:00";
export const HOUSE_TITLE = "Maison des jeunes de Saint Médard";

export const DEFAULT_ORG = {
  name: "ACEL Saint Médard",
  subtitle: "Association culturelle éducative et de loisirs Saint Médard",
  address: "Maison des Jeunes de Saint Médard\n3, rue du Gril – 14, rue Censier\n75005 Paris",
  phone: "01 43 31 44 84",
  email: "acel@mjsm.fr",
  website: "mjsm.fr",
  siret: "518 693 528 00011",
  signatory: "Katell Lauquet",
  adhesionLabel: "Adhésion à l'ACEL Saint-Médard",
  adhesionAmount: 10,
  fixedPrices: [375, 480],
  legal: "",
  invoicePrefix: "REL",
  nextInvoiceNumber: 1,
  ribImage: "",
  signImage: "",
};

export const SEED_ROOMS = [
  { name: "Bords de Bièvre", accessInfo: "Derrière vous, entre les DEUX PORTES en verre" },
  { name: "Daubenton", accessInfo: "A votre droite, traversez le FORUM" },
  { name: "Carré Censier", accessInfo: "Derrière vous, entre les DEUX PORTES en verre" },
  { name: "Marmousets", accessInfo: "Au 1 ETAGE par la porte verte" },
  { name: "Arbalète", accessInfo: "Au 1 ETAGE par la porte verte" },
  { name: "Teilhard de Chardin", accessInfo: "Au 2 ETAGE par la porte verte" },
  { name: "Port Royal" },
  { name: "Pascal" },
  { name: "Monge" },
  { name: "Buffon" },
  { name: "Puits de l'Ermite" },
  { name: "Fer à Moulin" },
  { name: "Box A2 - A3 - A4", accessInfo: "A DROITE, traversez le FORUM et PORTE JAUNE, puis descendez" },
];

export const SEED_ASSOCIATIONS = [
  "JSM ALSH", "JSM ADO", "AFOCAL BAFA", "UFCV", "Aumônerie", "Rythme", "Harmonie et Flûtes", "L'Atelier d'Alphonse",
  "Suzuki", "Vocaliz", "Tango", "Sculpture", "EKDP", "La Comète", "ALCP", "Fuga Furiosa", "Not en Bulle", "ASB",
  "Feeln'", "Groove", "Théâtre", "Act in Mad", "Judo", "Chœur à Cœur", "Écoutes", "Chorale", "Enchanté.es",
  "Divertimento", "Yoga LCDC", "Allegro", "Yoginine", "Furioso", "Les Airs Andalous", "Scouts", "AS Museum",
  "Aimé", "SGDF", "Cie de Vallois", "Tai Chi Nature", "Trans-Faire", "Opsi Opla",
];

// Stages BAFA : un stage occupe tous les espaces d'un étage, de 9h à 18h
export const STAGE_KINDS = {
  base: { label: "Stage Base BAFA", short: "BAFA FG", days: 8 },
  approf: { label: "Stage Approfondissement BAFA", short: "BAFA APPRO", days: 6 },
  custom: { label: "Autre stage", short: "Stage", days: 5 },
};
export const STAGE_START = "09:00";
export const STAGE_END = "18:00";
export const STAGE_FLOORS = [
  { name: "3e étage", statementLabel: "3ème étage", roomNames: ["Buffon", "Monge"], price: 300 },
  { name: "Sous-sol", statementLabel: "Bords de Bièvre", roomNames: ["Bords de Bièvre"], price: 200 },
  { name: "1er sous-sol", statementLabel: "Carré Censier", roomNames: ["Carré Censier"], price: 200 },
  { name: "1er étage", statementLabel: "1er étage", roomNames: ["Marmousets", "Arbalète"], price: 0 },
  { name: "2e étage", statementLabel: "2ème étage", roomNames: ["Teilhard de Chardin", "Pascal"], price: 300 },
];

// Vacances scolaires officielles, zone C (Paris). Dernier jour = veille de la reprise des cours.
export const SCHOOL_HOLIDAYS_C = [
  { label: "Vacances de la Toussaint", startDate: "2026-10-17", endDate: "2026-11-01" },
  { label: "Vacances de Noël", startDate: "2026-12-19", endDate: "2027-01-03" },
  { label: "Vacances d'hiver", startDate: "2027-02-06", endDate: "2027-02-21" },
  { label: "Vacances de printemps", startDate: "2027-04-03", endDate: "2027-04-18" },
  { label: "Vacances d'été", startDate: "2027-07-03", endDate: "2027-08-31" },
  { label: "Vacances de la Toussaint", startDate: "2027-10-23", endDate: "2027-11-07" },
  { label: "Vacances de Noël", startDate: "2027-12-18", endDate: "2028-01-02" },
  { label: "Vacances d'hiver", startDate: "2028-02-12", endDate: "2028-02-27" },
  { label: "Vacances de printemps", startDate: "2028-04-15", endDate: "2028-05-01" },
  { label: "Vacances d'été", startDate: "2028-07-04", endDate: "2028-08-31" },
];
