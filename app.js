import { firebaseConfig, cloudinary } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  query, orderBy, limit, startAfter, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── DOM ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const grid = $("grid"), authSlot = $("auth-slot"), fab = $("fab"),
      fileInput = $("file-input"), emptyEl = $("empty"),
      lightbox = $("lightbox"), lightboxImg = $("lightbox-img"),
      sentinel = $("sentinel"), toastEl = $("toast");

// ── 설정 점검: 비어 있으면 배너만 띄우고 멈춤 ──────────
const NOT_CONFIGURED =
  firebaseConfig.apiKey.includes("PASTE") || cloudinary.cloudName.includes("PASTE");
if (NOT_CONFIGURED) {
  $("setup-banner").hidden = false;
  throw new Error("config.js 미설정");
}

// ── 초기화 ───────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// ── 인증 ─────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  renderAuth();
  fab.hidden = !user;        // 업로드 버튼은 로그인 시에만
  refreshGallery();          // 삭제 버튼 노출 상태가 바뀌므로 다시 그림
});

function renderAuth() {
  authSlot.innerHTML = "";
  if (currentUser) {
    const name = document.createElement("span");
    name.className = "uname";
    name.textContent = currentUser.displayName || "로그인됨";
    const out = document.createElement("button");
    out.className = "btn ghost";
    out.textContent = "로그아웃";
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

// ── Cloudinary 전송 URL 빌더 ─────────────────────────
const imgUrl = (publicId, w) =>
  `https://res.cloudinary.com/${cloudinary.cloudName}/image/upload/c_limit,w_${w},q_auto,f_auto/${publicId}`;

// ── 업로드 직전 클라이언트 리사이즈 (긴 변 1440 · WebP · q80) ──
async function resizeImage(file, maxEdge = 1440, quality = 0.8) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC 등 브라우저가 못 디코딩하면 원본 전송 → Cloudinary가 c_limit,w_1440로 서버측 캡
    return file;
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.round(width * scale), h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
  return blob || file;
}

// ── 업로드 플로우 (A): 리사이즈 → Cloudinary → Firestore ──
async function uploadOne(file) {
  const resized = await resizeImage(file);
  const fd = new FormData();
  fd.append("file", resized);
  fd.append("upload_preset", cloudinary.uploadPreset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("Cloudinary 업로드 실패 (preset/cloud name 확인)");
  const data = await res.json(); // { public_id, width, height, ... }
  await addDoc(collection(db, "photos"), {
    ownerUid: currentUser.uid,
    ownerName: currentUser.displayName || "익명",
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    createdAt: serverTimestamp(),
  });
}

fab.onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const files = [...fileInput.files];
  fileInput.value = "";
  if (!files.length) return;
  let done = 0;
  toast(`업로드 중… (0/${files.length})`, true);
  for (const f of files) {
    try { await uploadOne(f); done++; toast(`업로드 중… (${done}/${files.length})`, true); }
    catch (e) { toast(e.message); }
  }
  toast(`${done}장 업로드 완료`);
  refreshGallery();
};

// ── 조회 플로우 (B): 최신순 30개씩 페이지네이션 ───────
const PAGE = 30;
let lastDoc = null, reachedEnd = false, loading = false;
const renderedIds = new Set();
let galleryToken = 0;

async function loadMore() {
  if (loading || reachedEnd) return;
  loading = true;
  const token = galleryToken;
  let q = lastDoc
    ? query(collection(db, "photos"), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(PAGE))
    : query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(PAGE));
  try {
    const snap = await getDocs(q);
    if (token !== galleryToken) return;          // refreshGallery가 도중에 끼어들면 결과 폐기
    if (snap.empty && !lastDoc) showEmpty();
    snap.forEach((d) => renderCard(d.id, d.data()));
    lastDoc = snap.docs[snap.docs.length - 1] || lastDoc;
    if (snap.size < PAGE) reachedEnd = true;
  } catch (e) {
    toast("불러오기 실패: " + e.message);
  } finally {
    if (token === galleryToken) loading = false;
  }
}

function refreshGallery() {
  galleryToken++;                                // 진행 중인 loadMore 무효화
  grid.innerHTML = "";
  emptyEl.hidden = true;
  lastDoc = null; reachedEnd = false; loading = false;
  renderedIds.clear();
  loadMore();
}

function showEmpty() {
  emptyEl.hidden = false;
  emptyEl.textContent = currentUser
    ? "아직 사진이 없어요. + 버튼으로 첫 사진을 올려보세요."
    : "아직 사진이 없어요. 로그인하면 첫 사진을 올릴 수 있어요.";
}

// ── 카드 렌더 + 삭제 플로우 (C) ──────────────────────
function renderCard(id, data) {
  if (renderedIds.has(id)) return;               // 중복 가드: 같은 문서 두 번 그리지 않음
  renderedIds.add(id);
  const card = document.createElement("figure");
  card.className = "card";
  card.dataset.id = id;
  if (data.width && data.height) card.style.aspectRatio = `${data.width} / ${data.height}`;

  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = imgUrl(data.publicId, 400);          // 그리드는 작은 썸네일
  img.alt = data.ownerName ? `${data.ownerName} 님의 사진` : "사진";
  img.onclick = () => openLightbox(data.publicId);
  card.append(img);

  // 본인 업로드에만 삭제 버튼 (1차 방어 — 진짜 방어는 Firestore 규칙)
  if (currentUser && data.ownerUid === currentUser.uid) {
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "삭제";
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("이 사진을 갤러리에서 삭제할까요?")) return;
      try {
        await deleteDoc(doc(db, "photos", id));  // 규칙이 ownerUid==uid 검증
        card.remove();
        renderedIds.delete(id);
        toast("삭제됨");
      } catch (err) {
        toast("삭제 실패: " + err.message);
      }
    };
    card.append(del);
  }
  grid.append(card);
}

// ── 라이트박스 ───────────────────────────────────────
function openLightbox(publicId) {
  lightboxImg.src = imgUrl(publicId, 1080);       // 탭하면 큰 이미지
  lightbox.hidden = false;
}
lightbox.onclick = () => { lightbox.hidden = true; lightboxImg.src = ""; };

// ── 무한 스크롤 ──────────────────────────────────────
new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) loadMore();
}, { rootMargin: "600px" }).observe(sentinel);

// ── 토스트 ───────────────────────────────────────────
let toastTimer;
function toast(msg, sticky = false) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => (toastEl.hidden = true), 2400);
}

// 첫 로드
refreshGallery();
