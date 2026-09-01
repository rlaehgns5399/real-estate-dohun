# real-estate-dohun

관심 아파트의 **실거래가 · 호가 · KB 시세**를 모아 한 페이지로 보여주는 대시보드.

**→ https://rlaehgns5399.github.io/real-estate-dohun**

국토교통부 실거래가(사실), 네이버 부동산 호가(파는 쪽 희망가), KB 시세(은행 담보평가 기준)를
한 차트에 겹쳐서 "지금 나온 매물이 비싼가 싼가"를 바로 판단할 수 있게 하는 것이 목적이다.
매입가를 설정하면 기준선과 평가손익도 함께 표시된다.

## 구조

수집은 로컬에서, 렌더와 배포는 CI에서 한다.

```
로컬  pnpm start
  ├─ 국토부 / KB / 네이버 수집 → Supabase 저장
  ├─ data/latest.json 갱신
  └─ 커밋 → 푸시
                  ↓  data/** 변경 감지
GitHub Actions  (.github/workflows/deploy.yml)
  ├─ pnpm build : Vite가 data/latest.json을 번들에 넣고 dist/ 생성
  └─ GitHub Pages 배포
                  ↓
브라우저는 완성된 정적 HTML만 받는다 (런타임에 Supabase·git 호출 없음)
```

**왜 수집을 CI에서 안 하나** — 네이버 부동산이 클라우드 IP 대역을 차단해서 GitHub Actions에서는
Playwright 스크래핑이 실패한다. 국토부·KB API는 CI에서도 되지만, 매물 없이는 반쪽이라 수집 전체를
로컬로 옮겼다.

**Supabase = 원본 저장소, `data/latest.json` = 페이지용 스냅샷** 두 층으로 나뉜다.
JSON은 빌드 시점에 번들로 들어가므로 브라우저가 Supabase를 부르지 않고,
**CI에 시크릿도 하나도 필요 없다.**

## 명령어

| 명령어 | 하는 일 |
|---|---|
| `pnpm start` | 수집 → `data/latest.json` → 커밋 → 푸시 (평소엔 이것만) |
| `pnpm telegram` | 수집 → 텔레그램 발송 |
| `pnpm data` | 수집 없이 Supabase → `data/latest.json` 갱신 |
| `pnpm dev` | Vite 개발 서버 (HMR) |
| `pnpm build` | `dist/` 생성 |
| `pnpm preview` | 빌드 결과 로컬 확인 |
| `pnpm bot` | CLI에서 텔레그램으로 메시지 전송 |
| `pnpm bot:listen` | 텔레그램 `/report` 명령 리스너 |
| `pnpm typecheck` / `pnpm lint` | 타입 검사 / 린트 |

데이터가 바뀌지 않으면 `pnpm start`는 커밋을 만들지 않는다 (`generatedAt`은 비교에서 제외).

커밋·푸시를 떼어내고 싶으면 `src/index.ts`에서 `publishData` 대신 `writeDataFile`만 호출하면 된다.

## 대시보드

- **시세 추이 차트** — 실거래 산점도 + 호가 최저~최고 밴드 + KB 일반가/하위~상위 밴드 + 매입가 기준선.
  가로로 밀어 이동, 핀치·휠로 확대. 범례 칩을 눌러 계열을 켜고 끌 수 있다.
- **요약 카드** — 최저 호가, KB 일반가, 호가−실거래 갭, 현재 매물 수
- **현재 매물** — 가격순/최신순/오래된순 정렬, 20건 단위 노출, 신규·장기 매물 배지
- **최근 변동** — 14일치. 날짜·유형별로 묶고, 펼치면 개별 매물을 볼 수 있다
- **실거래 내역** — 월 단위 그룹. 그룹 헤더에 건수·평균·범위, 최근 2개월은 펼친 상태
- 라이트/다크/기기 설정 3단 토글 (선택은 `localStorage`에 저장)

### 스타일

Tailwind v4를 쓰고, 디자인 토큰은 `web/src/styles.css`의 `@theme static`에 있다.

**`static`이 반드시 필요하다.** Tailwind v4는 유틸리티에서 쓰이지 않은 테마 변수를
빌드에서 지운다. 그런데 차트 색(`--color-deal` 등 11개)은 Chart.js가
`getComputedStyle`로 직접 읽으므로 Tailwind 입장에선 "안 쓰이는" 변수다.
`static`을 빼면 변수가 사라지고 차트가 빈 문자열을 색으로 받아 캔버스가 검게 나온다.

테마 전환은 같은 변수를 다크 셀렉터에서 다시 정의하는 방식이다. 유틸리티(`bg-card` 등)가
`var()`를 참조하므로 자동으로 따라온다.

```css
@theme static { --color-bg: #fbfbfd; ... }              /* 라이트 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --color-bg: #0a0a0c; ... }   /* 기기 설정 */
}
:root[data-theme="dark"] { --color-bg: #0a0a0c; ... }   /* 사용자 선택이 덮는다 */
```

CSS에 남긴 것은 유틸리티로 표현이 어렵거나 오히려 나빠지는 것들뿐이다 —
토큰과 테마 오버라이드, `reveal` 진입 애니메이션, `summary` 마커 리셋,
캔버스 `touch-action`, `prefers-reduced-motion` / `-transparency` / `-contrast` 대응.

**팔레트를 고칠 때는 `styles.css` 한 곳만 보면 된다.** 차트 색을 JS에 하드코딩하지
않은 이유이고, 그래서 테마가 바뀌면 토큰을 다시 읽어 차트를 새로 만든다.

### 값을 정하는 규칙

- **최근 실거래가** — 가장 최근 계약일의 **최고가**. 같은 날 여러 건이면 날짜만으로는 대표값이
  정해지지 않아 가격 내림차순을 2차 정렬로 둔다. 히어로에 그날의 가격 범위를 함께 표시한다.
- **호가 범위** — `ask_snapshots`에 기록이 있는 날짜는 기록값을, 그 이전 구간은 `listings`의
  관측 기록으로 채운다. `listings`는 가격이 바뀌면 행을 덮어써서 과거 호가를 되살릴 수 없기 때문에,
  기록이 쌓일수록 추정 구간이 줄어든다.

## 시작하기

### 1. 설치

```bash
pnpm install
pnpm exec playwright install --with-deps chromium
```

### 2. 환경변수

`.env.example`을 복사해 `.env` 생성.

| 변수 | 설명 |
|---|---|
| `MOLIT_API_KEY` | [공공데이터포털](https://www.data.go.kr/data/15126469/openapi.do) 발급 |
| `SUPABASE_URL` | 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | Settings → API Keys에서 발급 (`sb_secret_...`) |
| `SUPABASE_ANON_KEY` | 레거시 폴백. secret key가 있으면 쓰이지 않는다 |
| `TELEGRAM_BOT_TOKEN` | `@BotFather` 발급 |
| `TELEGRAM_CHAT_ID` | 그룹 chat_id(음수) 또는 개인 user_id |

수집기는 서버에서만 돌기 때문에 **RLS를 우회하는 secret key**를 쓴다. anon key는 RLS를 켜면
아무것도 못 하므로 전환기 폴백일 뿐이다.

### 3. Supabase 스키마

`src/db/schema.sql`을 SQL Editor에서 실행. 테이블은 `transactions`, `listings`, `kb_prices`,
`ask_snapshots` 네 개다.

이미 만들어 쓰던 DB라면 `src/db/migrations/`의 SQL을 순서대로 한 번씩 실행한다.
`001-kb-prices-per-area.sql`은 `kb_prices`에 `area`와 `jeonse_price_general`을 추가한다 —
이게 없으면 한 단지에서 면적을 하나밖에 수집하지 못하고, 수집기가 그 사실을 로그로 알린다.

이어서 RLS를 켠다. 정책은 만들지 않는다 — 브라우저가 Supabase를 직접 호출하지 않으므로
anon/publishable 키로 열려 있을 이유가 없고, 수집기는 secret key로 우회한다.

```sql
alter table public.transactions   enable row level security;
alter table public.listings       enable row level security;
alter table public.kb_prices      enable row level security;
alter table public.ask_snapshots  enable row level security;
```

### 4. 관심 아파트 등록

`src/constants/items.ts`:

```ts
{
  name: "강동리엔파크14단지",   // 국토부 API 아파트명 (정확히 일치)
  naverComplexId: "134513",     // 네이버 부동산 URL의 complexNo
  kbComplexId: "311861",        // KB 단지기본일련번호 (없으면 null)
  address: "서울특별시 강동구 고덕로98길 160",
  regionCode: "11740",          // 법정동코드 5자리
  areas: [
    { area: 49, purchasePrice: 89000, collectKb: true },
    { area: 59 },
  ],
}
```

`areas`에 적은 전용면적마다 상단바 드롭다운에 항목이 하나씩 생긴다. 첫 번째가 기본이고,
빌드할 때 면적마다 HTML을 따로 그려 둔다 — 기본은 `/`, 나머지는 `/59/`. 그래서 `/59/`로
바로 들어와도 서버가 처음부터 그 면적을 그린 HTML을 주고, 기본 면적이 잠깐 보였다가
바뀌는 일이 없다. 새로고침·링크 공유·뒤로가기 모두 동작한다.
거래 유형은 지정하지 않는다 — 매매·전세·월세를 한 번에 수집해 매매는 시세 추이와 매물
목록으로, 전세·월세는 전세가율과 전월세 목록으로 나눠 쓴다.

`purchasePrice`를 빼면 기준선·평가손익·매입가 대비 컬럼이 자동으로 사라진다.

KB는 주택형별로 시세를 나눠 놓는다. 예를 들어 59㎡는 59.94(A·198세대)와 59.78(B·7세대)
두 행으로 오는데, 네이버가 두 타입을 모두 `59`로 뭉쳐 주기 때문에 매물을 어느 쪽에 배정할
방법이 없다. 그래서 `areas`에는 `59` 하나만 적고, 수집기가 걸리는 주택형을 전부 합친다 —
밴드는 하한의 최소~상한의 최대, 일반거래가는 세대수 가중평균.

전세가율은 네이버 전세 매물의 중앙값을 우선 쓰고, 매물이 하나도 없으면 KB 전세 시세로
대신 낸다. 분모도 그에 맞춰 매매 호가 중앙값 또는 KB 매매 일반가로 바뀌며, 화면에는 어떤
값을 무엇으로 나눴는지 항상 함께 적는다.

### 5. GitHub Pages

`Settings → Pages → Source`를 **GitHub Actions**로 설정. 이후 `pnpm start` 한 번이면
푸시 → 렌더 → 배포까지 이어진다.

## 프로젝트 구조

```
src/                     Node — 수집 파이프라인 (tsx로 실행)
├── collectors/          molit / kb / naver(Playwright)
├── services/            report, snapshot, page-data, publish, telegram, notify
├── db/                  Supabase 클라이언트 + 스키마 + migrations/
├── config/env.ts        환경변수
├── constants/items.ts   관심 아파트
├── types/page.ts        페이지 payload 타입 ← web과 공유
├── utils/format.ts      가격·층·날짜 포맷  ← web과 공유
├── paths.ts             data/latest.json 위치
├── index.ts             pnpm start
├── telegram.ts          pnpm telegram
└── bot.ts               pnpm bot

web/                     Vite + React 대시보드
├── index.html           테마 FOUC 방지 인라인 스크립트
├── vite.config.ts
└── src/
    ├── main.tsx         data/latest.json을 빌드 시점에 import
    ├── App.tsx
    ├── styles.css       Tailwind 토큰(@theme) + 유틸리티로 안 되는 것들
    ├── chartTokens.ts   CSS 커스텀 프로퍼티 → 차트 색
    ├── components/      Topbar, ThemeToggle, Hero, StatCards, ChartCard,
    │                    ListingList, Timeline, TransactionTable, Chevron
    └── hooks/useTheme.ts
```

## 기술 스택

| 영역 | 기술 |
|---|---|
| 언어/런타임 | TypeScript, Node.js 22, pnpm |
| DB | Supabase (PostgreSQL, RLS) |
| 매물 수집 | Playwright + Chromium |
| 프론트 | React 19, Vite 8, Tailwind CSS 4 |
| 차트 | Chart.js 4 + chartjs-plugin-zoom |
| 알림 | Telegraf |
| 배포 | GitHub Actions → GitHub Pages |
| 포매터/린터 | Biome |

## 알아둘 것

- **네이버는 클라우드 IP를 차단한다.** `pnpm start`는 로컬에서만 돌아간다.
- **사내망에서 텔레그램이 막힐 수 있다.** 보안 게이트웨이가 `api.telegram.org`를 차단하면
  503이 돌아온다. `pnpm telegram`은 개인망에서 쓸 것.
- **국토부 실거래가의 동(棟) 정보는 대부분 비공개다.** API에 `aptDong` 필드가 있지만 강동구
  기준 5% 남짓만 값이 있다. 네이버 매물에는 동 정보가 있어 매물 목록에는 표시된다.
- 페이지는 빌드 시점에 데이터가 번들로 들어가므로 **배포물에 키가 들어가지 않는다.**
- **`@theme`에서 `static`을 빼면 차트가 검게 나온다.** 위 "스타일" 참고.
