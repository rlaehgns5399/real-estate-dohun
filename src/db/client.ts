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
