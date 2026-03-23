function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
  }
  return value;
}

export const env = {
  molit: {
    apiKey: requireEnv("MOLIT_API_KEY"),
  },
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
  },
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    chatId: requireEnv("TELEGRAM_CHAT_ID"),
  },
} as const;
