import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { $, toast } from "./ui.js";
import { setCurrentUser, renderAuth } from "./auth.js";
import { uploadOne } from "./cloudinary.js";
import { refreshGallery, initLightbox, initInfiniteScroll } from "./gallery.js";

const fab = $("fab"), fileInput = $("file-input");

onAuthStateChanged(auth, (user) => {
  setCurrentUser(user);
  renderAuth();
  fab.hidden = !user;        // 업로드 버튼은 로그인 시에만
  refreshGallery();          // 삭제 버튼 노출 상태가 바뀌므로 다시 그림
});

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

initLightbox();
initInfiniteScroll();

// 첫 로드
refreshGallery();
