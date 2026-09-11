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
