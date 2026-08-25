function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
  }
  return value;
}

/** 값이 비어 있으면 undefined로 취급한다 (`KEY=` 형태의 빈 슬롯 대응) */
function optionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

/**
 * Supabase 키.
 *
 * 수집기는 서버에서만 돌기 때문에 secret key(구 service_role)를 쓴다.
 * secret key는 RLS를 우회하므로 테이블에 RLS를 켜둔 채로도 읽고 쓸 수 있다.
 * anon key는 RLS를 켜는 순간 아무것도 못 하게 되므로 전환 기간의 폴백일 뿐이다.
 */
const supabaseSecretKey = optionalEnv("SUPABASE_SECRET_KEY");
const supabaseAnonKey = optionalEnv("SUPABASE_ANON_KEY");

if (!supabaseSecretKey && !supabaseAnonKey) {
  throw new Error("SUPABASE_SECRET_KEY 또는 SUPABASE_ANON_KEY 중 하나는 설정되어야 합니다.");
}

export const env = {
  molit: {
    apiKey: requireEnv("MOLIT_API_KEY"),
  },
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    secretKey: supabaseSecretKey,
    anonKey: supabaseAnonKey,
  },
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    chatId: requireEnv("TELEGRAM_CHAT_ID"),
  },
} as const;
