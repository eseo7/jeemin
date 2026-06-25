import { cloudinary } from "./config.js";
import { db } from "./firebase.js";
import {
  collection, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getCurrentUser } from "./auth.js";

export const imgUrl = (publicId, w) =>
  `https://res.cloudinary.com/${cloudinary.cloudName}/image/upload/c_limit,w_${w},q_auto,f_auto/${publicId}`;

// 업로드 직전 클라이언트 리사이즈 (긴 변 1440 · WebP · q80)
export async function resizeImage(file, maxEdge = 1440, quality = 0.8) {
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

// 업로드 플로우: 리사이즈 → Cloudinary → Firestore
export async function uploadOne(file) {
  const resized = await resizeImage(file);
  const fd = new FormData();
  fd.append("file", resized);
  fd.append("upload_preset", cloudinary.uploadPreset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("Cloudinary 업로드 실패 (preset/cloud name 확인)");
  const data = await res.json();
  const currentUser = getCurrentUser();
  await addDoc(collection(db, "photos"), {
    ownerUid: currentUser.uid,
    ownerName: currentUser.displayName || "익명",
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    createdAt: serverTimestamp(),
  });
}
