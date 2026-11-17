const KEY = "salleplan.actor";
export const ACTORS = ["Katell", "Pierre"];
export function getActor() {
  try {
    const v = window.localStorage.getItem(KEY);
    return ACTORS.includes(v) ? v : null;
  } catch (e) {
    return null;
  }
}
export function setActor(name) {
  try {
    window.localStorage.setItem(KEY, name);
  } catch (e) {
    /* ignoré */
  }
}
