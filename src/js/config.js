// ─────────────────────────────────────────────────────────────
//  설정 — Firebase + Cloudinary 모두 입력 완료. 그대로 사용하면 됩니다.
//  (이 값들은 클라이언트 공개용이라 GitHub 커밋해도 안전. Cloudinary API secret은 들어있지 않음)
// ─────────────────────────────────────────────────────────────

// ② Firebase (Default Gemini Project · Spark)
export const firebaseConfig = {
  apiKey: "AIzaSyCULoOQNVDPNEhSHK3daYiJZHrq4xVI1WM",
  authDomain: "gen-lang-client-0262624817.firebaseapp.com",
  projectId: "gen-lang-client-0262624817",
  storageBucket: "gen-lang-client-0262624817.firebasestorage.app",
  messagingSenderId: "58879417976",
  appId: "1:58879417976:web:dd76164181d2a1c848578d",
};

// ③ Cloudinary
export const cloudinary = {
  cloudName: "dupsyl1jj",
  uploadPreset: "gallery",
};
