import { db } from "./firebase.js";
import {
  collection, deleteDoc, doc,
  query, orderBy, limit, startAfter, getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { $, toast } from "./ui.js";
import { getCurrentUser, ADMIN_UID } from "./auth.js";
import { imgUrl } from "./cloudinary.js";

const grid = $("grid"), emptyEl = $("empty"),
      lightbox = $("lightbox"), lightboxImg = $("lightbox-img"),
      sentinel = $("sentinel");

// 조회 플로우: 최신순 30개씩 페이지네이션
const PAGE = 30;
let lastDoc = null, reachedEnd = false, loading = false;
const renderedIds = new Set();
const photos = []; // 렌더 순서대로 {id, publicId} 보관 — 라이트박스 좌우 이동용
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

export function refreshGallery() {
  galleryToken++;                                // 진행 중인 loadMore 무효화
  grid.innerHTML = "";
  emptyEl.hidden = true;
  lastDoc = null; reachedEnd = false; loading = false;
  renderedIds.clear();
  photos.length = 0;
  loadMore();
}

function showEmpty() {
  emptyEl.hidden = false;
  emptyEl.textContent = getCurrentUser()
    ? "아직 사진이 없어요. + 버튼으로 첫 사진을 올려보세요."
    : "아직 사진이 없어요. 로그인하면 첫 사진을 올릴 수 있어요.";
}

function renderCard(id, data) {
  if (renderedIds.has(id)) return;               // 중복 가드: 같은 문서 두 번 그리지 않음
  renderedIds.add(id);
  photos.push({ id, publicId: data.publicId });
  const card = document.createElement("figure");
  card.className = "card";
  card.dataset.id = id;
  if (data.width && data.height) card.style.aspectRatio = `${data.width} / ${data.height}`;

  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = imgUrl(data.publicId, 400);          // 그리드는 작은 썸네일
  img.alt = data.ownerName ? `${data.ownerName} 님의 사진` : "사진";
  img.onclick = () => {
    const idx = photos.findIndex((p) => p.id === id);
    if (idx >= 0) openLightbox(idx);
  };
  card.append(img);

  const currentUser = getCurrentUser();
  // 본인 업로드 또는 관리자에만 삭제 버튼 (1차 방어 — 진짜 방어는 Firestore 규칙)
  if (currentUser && (data.ownerUid === currentUser.uid || currentUser.uid === ADMIN_UID)) {
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "삭제";
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("이 사진을 갤러리에서 삭제할까요?")) return;
      try {
        await deleteDoc(doc(db, "photos", id));
        card.remove();
        renderedIds.delete(id);
        const idx = photos.findIndex((p) => p.id === id);
        if (idx >= 0) photos.splice(idx, 1);
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
let currentIndex = -1;
let prevBtn, nextBtn;

function showAt(index) {
  if (index < 0 || index >= photos.length) return;
  currentIndex = index;
  lightboxImg.src = imgUrl(photos[index].publicId, 1080);
  if (prevBtn) prevBtn.disabled = index <= 0;
  if (nextBtn) nextBtn.disabled = index >= photos.length - 1;
}

function openLightbox(index) {
  showAt(index);
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = "";
  currentIndex = -1;
}

function go(delta) {
  const next = currentIndex + delta;
  if (next < 0 || next >= photos.length) return;
  showAt(next);
}

export function initLightbox() {
  // 좌우 화살표 버튼 (데스크탑 클릭용; 모바일에서도 탭 가능)
  prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "lb-nav lb-prev";
  prevBtn.setAttribute("aria-label", "이전 사진");
  prevBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
  nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "lb-nav lb-next";
  nextBtn.setAttribute("aria-label", "다음 사진");
  nextBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  prevBtn.onclick = (e) => { e.stopPropagation(); go(-1); };
  nextBtn.onclick = (e) => { e.stopPropagation(); go(1); };
  lightbox.append(prevBtn, nextBtn);

  // 배경 클릭 = 닫기 (기존 동작 유지)
  lightbox.onclick = (e) => {
    if (e.target === prevBtn || e.target === nextBtn) return;
    if (prevBtn.contains(e.target) || nextBtn.contains(e.target)) return;
    closeLightbox();
  };

  // 키보드: ESC 닫기, ←/→ 이동
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    if (e.key === "Escape") { closeLightbox(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });

  // 터치 스와이프 (좌/우)
  let touchStartX = 0, touchStartY = 0, touchMoved = false;
  const SWIPE_THRESHOLD = 50;
  lightbox.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });
  lightbox.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) touchMoved = true;
  }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (!touchMoved) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      // 스와이프가 발생했으면 닫힘 클릭으로 처리되지 않도록 차단
      e.preventDefault();
      go(dx < 0 ? 1 : -1);
    }
  });
}

export function initInfiniteScroll() {
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore();
  }, { rootMargin: "600px" }).observe(sentinel);
}
