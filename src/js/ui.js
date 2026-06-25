export const $ = (id) => document.getElementById(id);

const toastEl = $("toast");
let toastTimer;
export function toast(msg, sticky = false) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => (toastEl.hidden = true), 2400);
}
