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
