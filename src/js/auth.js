import { auth, provider } from "./firebase.js";
import {
  signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { $, toast } from "./ui.js";

export const ADMIN_UID = "p6EDP1NNMZZ0zPWm6SD1kiqPeSE3";

let currentUser = null;
const authSlot = $("auth-slot");

export const getCurrentUser = () => currentUser;
export function setCurrentUser(user) { currentUser = user; }

export function renderAuth() {
  authSlot.innerHTML = "";
  if (currentUser) {
    const name = document.createElement("span");
    name.className = "uname";
    name.textContent = currentUser.displayName || "로그인됨";

    const out = document.createElement("button");
    out.className = "btn ghost icon-btn";
    out.setAttribute("aria-label", "로그아웃");
    out.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>`;
    out.onclick = () => signOut(auth);

    authSlot.append(name, out);
  } else {
    const inBtn = document.createElement("button");
    inBtn.className = "btn";
    inBtn.textContent = "Google로 로그인";
    inBtn.onclick = () => signInWithPopup(auth, provider).catch((e) => toast("로그인 실패: " + e.message));
    authSlot.append(inBtn);
  }
}
