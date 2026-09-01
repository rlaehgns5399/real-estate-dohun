-- kb_prices를 면적별로 구분하고 KB 전세 시세를 함께 담는다.
--
-- 배경: kb_prices는 아파트명으로만 행을 구분해 한 단지에서 두 면적을 수집하면
-- 같은 이름으로 섞여 되돌릴 수 없었다. 그래서 49㎡만 수집해 왔다.
--
-- Supabase SQL Editor에서 한 번 실행하면 된다. 여러 번 실행해도 안전하다.

alter table kb_prices add column if not exists area numeric(6,2);

-- 이 칼럼이 생기기 전에 쌓인 행은 전부 49㎡ 하나뿐이었다.
update kb_prices set area = 49 where area is null;

alter table kb_prices alter column area set not null;

-- KB 전세 일반거래가 (mpriByType의 전세일반거래가).
-- 네이버에 전세 매물이 하나도 없는 면적에서도 전세가율을 낼 수 있게 한다.
alter table kb_prices add column if not exists jeonse_price_general integer;

create index if not exists idx_kb_prices_apartment_area
  on kb_prices(apartment_name, area, fetched_at desc);
