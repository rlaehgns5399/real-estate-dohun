# real-estate-dohun

관심 아파트의 실거래가·매물·시세를 매일 지정된 시간에 텔레그램으로 알려주는 봇.

## 기능

- **실거래가** — 국토교통부 API로 최근 3개월 매매 실거래가 수집
- **매물 현황** — 네이버 부동산에서 현재 매물 목록 수집, 이전 스냅샷과 비교해 신규/가격변동/삭제 감지
- **KB 시세** — KB부동산에서 매매 일반가·하위평균가·상위평균가 수집
- **텔레그램 알림** — 하루 4회(9시/12시/15시/18시 KST) 자동 발송
- **수동 실행** — 텔레그램 그룹에서 `/report` 명령어로 즉시 조사

## 기술 스택

| 영역 | 기술 |
|------|------|
| 언어/런타임 | TypeScript, Node.js 22, pnpm |
| DB | Supabase (PostgreSQL) |
| 매물 수집 | Playwright + Chromium (네이버 TLS fingerprint 우회) |
| 알림 | Telegraf (Telegram Bot) |
| 스케줄 | GitHub Actions cron |
| 포매터/린터 | Biome |

## 프로젝트 구조

```
src/
├── collectors/       # 외부 API 수집기
│   ├── kb.ts         # KB부동산 매매 시세
│   ├── molit.ts      # 국토교통부 실거래가
│   └── naver.ts      # 네이버 부동산 매물 (Playwright)
├── services/
│   ├── report.ts     # 수집 + 알림 파이프라인
│   ├── snapshot.ts   # 매물 스냅샷 diff
│   └── telegram.ts   # 텔레그램 메시지 빌더
├── db/
│   ├── client.ts     # Supabase 클라이언트
│   └── schema.sql    # 테이블 스키마
├── config/env.ts     # 환경변수 파싱
├── constants/items.ts # 관심 아파트 목록
├── types/index.ts    # 공용 타입
├── utils/            # 공용 유틸
├── bot.ts            # 텔레그램 봇 (CLI/리스너 모드)
└── index.ts          # 크론 진입점
```

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
pnpm exec playwright install --with-deps chromium
```

### 2. 환경변수 설정

`.env.example`을 참고해 `.env` 생성.

| 변수 | 설명 |
|------|------|
| `MOLIT_API_KEY` | [공공데이터포털](https://www.data.go.kr/data/15126469/openapi.do)에서 발급 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `TELEGRAM_BOT_TOKEN` | `@BotFather`에서 발급 |
| `TELEGRAM_CHAT_ID` | 그룹 chat_id (음수) 또는 개인 user_id |
| `TARGET_REGION_CODE` | 법정동코드 5자리 (강동구 `11740`) |

### 3. Supabase 스키마 적용

`src/db/schema.sql`을 Supabase SQL Editor에서 실행.

### 4. 관심 아파트 등록

`src/constants/items.ts`에 아파트 정보 추가:

```ts
{
  name: "강동리엔파크14단지",      // 국토교통부 API 아파트명 (정확히 일치)
  naverComplexId: "134513",        // 네이버 부동산 URL complexNo
  kbComplexId: "311861",           // KB 단지기본일련번호 (없으면 null)
  regionCode: "11740",             // 법정동코드 5자리
  targetArea: 49,                  // 관심 전용면적 (㎡)
  tradeType: "매매",
}
```

### 5. 실행

```bash
pnpm start              # 한번 실행
pnpm bot                # CLI에서 텔레그램으로 메시지 전송
pnpm bot:listen         # 텔레그램 명령어 리스너 실행
```

## GitHub Actions 크론

`.github/workflows/cron.yml` — 하루 4회(9시/12시/15시/18시 KST) 자동 실행.

Repository secrets에 다음을 등록:
- `MOLIT_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `TARGET_REGION_CODE`

> **주의**: 네이버 부동산은 클라우드 IP 대역을 차단하므로 GitHub Actions에서는 네이버 수집이 실패할 수 있습니다. KB 시세·실거래가는 정상 동작하며, 네이버 매물은 로컬에서 `pnpm start`로 별도 실행 권장.

## 명령어 (텔레그램)

| 명령어 | 설명 |
|--------|------|
| `/report` | 수동으로 매물 조사 실행 |
| `/start` | 봇 사용 안내 |
