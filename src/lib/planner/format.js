export const fmtDec = (n) => Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (n) => `${fmtDec(n)} €`;
export const fmtHours = (h) => `${Number(h || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}h`;
export const csvNum = (n) => Number(n || 0).toFixed(2).replace(".", ",");
export const sheetTime = (t) => {
  if (!t || t.indexOf(":") === -1) return "";
  const p = t.split(":");
  return `${Number(p[0])} H ${p[1]}`;
};
