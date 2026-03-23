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

-- KB 시세 (매매)
CREATE TABLE kb_prices (
  id SERIAL PRIMARY KEY,
  apartment_name TEXT NOT NULL,
  deal_price_general INTEGER, -- 일반거래가 (만원)
  deal_price_lower INTEGER, -- 하위 평균가 (만원)
  deal_price_upper INTEGER, -- 상위 평균가 (만원)
  base_date TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_transactions_apartment ON transactions(apartment_name, deal_date DESC);
CREATE INDEX idx_listings_complex_active ON listings(naver_complex_id, is_active);
CREATE INDEX idx_listings_article ON listings(article_id);
CREATE INDEX idx_kb_prices_apartment ON kb_prices(apartment_name, fetched_at DESC);
