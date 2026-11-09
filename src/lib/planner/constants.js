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

export const DEFAULT_ORG = { name: "", address: "", legal: "", invoicePrefix: "FACT", nextInvoiceNumber: 1 };

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
