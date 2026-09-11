-- 실거래가 이력 (국토교통부)
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  apartment_name TEXT NOT NULL, -- 국토교통부 API 아파트명
  region_code TEXT NOT NULL, -- 법정동코드 5자리
  deal_date DATE NOT NULL,
  price INTEGER NOT NULL, -- 만원 단위
  area NUMERIC(6,2) NOT NULL, -- 전용면적 ㎡
  floor INTEGER NOT NULL,
  build_year INTEGER,
  road_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(apartment_name, deal_date, price, area, floor)
);

-- 매물 스냅샷 (네이버 부동산)
CREATE TABLE listings (
  id SERIAL PRIMARY KEY,
  naver_complex_id TEXT NOT NULL, -- 네이버 부동산 complexNo
  article_id TEXT NOT NULL, -- 네이버 매물 고유번호
  trade_type TEXT NOT NULL, -- 매매, 전세, 월세
  price TEXT NOT NULL,
  area NUMERIC(6,2),
  floor TEXT,
  building_name TEXT, -- "1403동"
  direction TEXT, -- "남향"
  description TEXT,
  realtor_name TEXT,
  confirm_date TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(naver_complex_id, article_id)
);

-- KB 시세 (면적별)
-- 한 단지에서 여러 면적을 보므로 area 없이는 행을 구분할 수 없다.
-- 이미 만들어진 테이블은 migrations/001-kb-prices-per-area.sql로 옮긴다.
CREATE TABLE kb_prices (
  id SERIAL PRIMARY KEY,
  apartment_name TEXT NOT NULL,
  area NUMERIC(6,2) NOT NULL, -- 전용면적 ㎡ (items.ts의 관심 면적 값)
  deal_price_general INTEGER, -- 매매 일반거래가 (만원)
  deal_price_lower INTEGER, -- 매매 하위 평균가 (만원)
  deal_price_upper INTEGER, -- 매매 상위 평균가 (만원)
  jeonse_price_general INTEGER, -- 전세 일반거래가 (만원)
  base_date TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_transactions_apartment ON transactions(apartment_name, deal_date DESC);
CREATE INDEX idx_listings_complex_active ON listings(naver_complex_id, is_active);
CREATE INDEX idx_listings_article ON listings(article_id);
CREATE INDEX idx_kb_prices_apartment ON kb_prices(apartment_name, area, fetched_at DESC);

-- 호가 범위 스냅샷 (네이버)
-- listings 테이블은 가격 변동 시 행을 덮어써서 과거 호가를 복원할 수 없다.
-- 실행할 때마다 그 시점의 실제 호가 범위를 여기에 기록해 차트가 추론 없이 그리도록 한다.
CREATE TABLE ask_snapshots (
  id SERIAL PRIMARY KEY,
  naver_complex_id TEXT NOT NULL,
  area NUMERIC(6,2) NOT NULL, -- 전용면적 ㎡
  snapshot_date DATE NOT NULL,
  low INTEGER NOT NULL, -- 최저 호가 (만원)
  median INTEGER NOT NULL,
  high INTEGER NOT NULL,
  listing_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(naver_complex_id, area, snapshot_date)
);

CREATE INDEX idx_ask_snapshots_complex ON ask_snapshots(naver_complex_id, snapshot_date DESC);

-- (migrations/002-land-permits.sql와 동일)
-- 토지거래허가 내역 (서울시 부동산정보광장 → 국토교통부 K-Geo 연계)
--
-- 원본은 최근 62일 창으로만 조회되고 서울시가 보관하지 않는다. 우리가 받아서 쌓아야
-- 이력이 남는다. 집계가 아니라 건별 원본을 넣는 이유는, 나중에 지목·처리구분 기준을
-- 바꿔 다시 세고 싶을 때 원본이 없으면 못 되돌리기 때문이다.
CREATE TABLE land_permits (
  id SERIAL PRIMARY KEY,
  sgg_cd TEXT NOT NULL,        -- 자치구 코드 (11740 = 강동구)
  acc_year TEXT NOT NULL,      -- 접수연도
  acc_no TEXT NOT NULL,        -- 접수번호
  obj_seqno TEXT NOT NULL,     -- 물건 일련번호. 한 접수에 물건이 둘인 경우가 있다.
  lawd_cd TEXT NOT NULL,       -- 법정동코드 10자리 (1174010300 = 상일동)
  bobn TEXT NOT NULL,          -- 본번 4자리 (0028)
  bubn TEXT NOT NULL,          -- 부번 4자리 (0000)
  address TEXT NOT NULL,       -- "강동구 상일동 28"
  jimok TEXT,                  -- 지목. 토지정리 전 단지는 '대'에 '답'이 섞인다 (둘 다 같은 아파트 거래)
  job_gbn_nm TEXT NOT NULL,    -- 허가 / 취하 / 취소 / 기타 — 전부 허가가 아니다
  use_purp TEXT,               -- 이용목적 (주거용 등)
  permit_date DATE NOT NULL,   -- 처리(허가) 년월일
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sgg_cd, acc_year, acc_no, obj_seqno)
);

-- 차트는 "이 필지의 날짜별 건수"만 묻는다.
CREATE INDEX idx_land_permits_parcel ON land_permits(lawd_cd, bobn, bubn, permit_date);
