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
        toast("삭제됨");
      } catch (err) {
        toast("삭제 실패: " + err.message);
      }
    };
    card.append(del);
  }
  grid.append(card);
}

function openLightbox(publicId) {
  lightboxImg.src = imgUrl(publicId, 1080);       // 탭하면 큰 이미지
  lightbox.hidden = false;
}

export function initLightbox() {
  lightbox.onclick = () => { lightbox.hidden = true; lightboxImg.src = ""; };
}

export function initInfiniteScroll() {
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore();
  }, { rootMargin: "600px" }).observe(sentinel);
}
