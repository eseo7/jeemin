# jeemin gallery

방지민 팬채널 이미지 갤러리. 무료 스택(Cloudflare Pages + Firebase Auth·Firestore + Cloudinary), 백엔드 없음.

- 조회: 누구나 (무로그인)
- 업로드·삭제: Google 로그인한 사용자 (삭제는 본인 것만)

## 파일 구조
```
/
├── index.html              # Cloudflare Pages 진입점
├── firestore.rules         # Firebase 보안 규칙 (콘솔에 붙여 게시)
├── README.md
└── src/
    ├── css/
    │   └── styles.css
    └── js/
        ├── config.js       # **여기 두 곳만 채우면 끝** (firebaseConfig, cloudinary)
        ├── firebase.js     # Firebase 초기화
        ├── auth.js         # 로그인/로그아웃 · ADMIN_UID
        ├── cloudinary.js   # URL 빌더 · 리사이즈 · 업로드
        ├── gallery.js      # 페이지네이션 · 카드 렌더 · 삭제 · 라이트박스 · 무한스크롤
        ├── ui.js           # $ 셀렉터 · toast
        └── main.js         # 진입점 (모듈 조립 · 이벤트 바인딩)
```

## 1. config.js 채우기
- **firebaseConfig**: Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹) → SDK 설정의 객체를 그대로 복사
- **cloudinary**: Cloudinary Dashboard의 Cloud name + 만들어 둔 unsigned upload preset 이름
> 이 값들은 클라이언트 공개용이라 GitHub에 커밋해도 됩니다. (Cloudinary API secret은 절대 넣지 마세요)

## 2. Firestore 보안 규칙 게시
Firebase 콘솔 → Firestore Database → 규칙 탭 → `firestore.rules` 내용 붙여넣기 → 게시.

## 3. GitHub에 올리기
이 폴더 내용을 `https://github.com/eseo7/jeemin` 레포에 푸시.

## 4. Cloudflare Pages 연결 (배포)
1. dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → `eseo7/jeemin` 선택
2. Framework preset: **None**, Build command: **(비움)**, Output directory: **/** (정적 파일 그대로)
3. Deploy → `xxx.pages.dev` 주소 발급

## 5. ⚠ 인증 도메인 등록 (안 하면 로그인 실패)
Firebase 콘솔 → Authentication → Settings → 승인된 도메인에 **발급받은 `xxx.pages.dev`** 추가.
(`localhost`는 기본 허용되어 로컬 테스트는 바로 됨)

## 로컬 테스트
ES 모듈 + 팝업 로그인이라 `file://`로 열면 안 됩니다. 폴더에서 간단 서버를 띄우세요:
```
python3 -m http.server 8080   # → http://localhost:8080
```

## 알아둘 것
- 이미지: 업로드 시 긴 변 1440px·WebP로 축소, 표시 시 썸네일 400px / 큰 이미지 1080px (`q_auto,f_auto`)
- 삭제는 갤러리(Firestore)에서 제거. Cloudinary 원본 파일 자체 삭제는 서명이 필요해 후속 과제(현재는 남음)
- 무료 천장: Cloudinary 전송 25GB/월. 초과 시 과금 아닌 차단 → 트래픽 커지면 R2 전환 검토
