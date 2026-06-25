import { firebaseConfig, cloudinary } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const NOT_CONFIGURED =
  firebaseConfig.apiKey.includes("PASTE") || cloudinary.cloudName.includes("PASTE");
if (NOT_CONFIGURED) {
  document.getElementById("setup-banner").hidden = false;
  throw new Error("config.js 미설정");
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
