import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

// secret key가 있으면 항상 그걸 쓴다. anon key는 RLS를 켜면 막히므로 폴백일 뿐이다.
const key = env.supabase.secretKey ?? env.supabase.anonKey;

if (!env.supabase.secretKey) {
  console.warn(
    "[db] SUPABASE_SECRET_KEY가 없어 anon key로 접속합니다. " +
      "테이블에 RLS를 켜면 수집이 실패하므로 secret key로 전환하세요.",
  );
}

export const supabase = createClient(env.supabase.url, key as string);

/**
 * Supabase(PostgREST)가 한 요청에 돌려주는 최대 행 수.
 *
 * 이걸 넘는 select는 에러 없이 앞 1000행만 온다. listings가 1093행이 됐을 때 최근 활성
 * 매물 83건 중 78건이 잘려 페이지에 1~4건만 떴다. 단지 단위 조회라도 행 수는 계속
 * 늘어나므로, 전부 필요한 조회는 fetchAllRows로 끝까지 읽어야 한다.
 */
const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * 1000행 제한을 넘어 조회 결과를 끝까지 읽는다.
 *
 * page는 같은 조건의 쿼리에 .range(from, to)를 붙여 돌려줘야 한다. 페이지 사이에
 * 행 순서가 흔들리면 중복·누락이 생기므로 쿼리에 고유 칼럼(id) 정렬을 넣는다.
 * 조회가 실패하면 던진다 — 빈 배열로 넘기면 "데이터 없음"과 구분되지 않는다.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`[db] 조회 실패: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
