const requiredSecrets = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'META_APP_SECRET',
  'MOTHER_PHONE'
] as const

export function missingConfiguration(env: Env): string[] {
  return requiredSecrets.filter((key) => !env[key]?.trim())
}

export function configurationStatus(env: Env): {
  ok: boolean
  missing: string[]
  aiConfigured: boolean
  d1Configured: boolean
  queueConfigured: boolean
  groqConfigured: boolean
  channel: string
  morningDaily: boolean
} {
  const missing = missingConfiguration(env)
  return {
    ok: missing.length === 0 && Boolean(env.DB) && Boolean(env.INBOUND_QUEUE),
    missing,
    aiConfigured: Boolean(env.AI),
    d1Configured: Boolean(env.DB),
    queueConfigured: Boolean(env.INBOUND_QUEUE),
    groqConfigured: Boolean(env.GROQ_API_KEY),
    channel: (env.CHANNEL as string) || 'meta',
    morningDaily: env.MORNING_DAILY === 'true'
  }
}
