const requiredSecrets = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'META_APP_SECRET',
  'MOTHER_PHONE',
  'GROQ_API_KEY',
  'CALLMEBOT_API_KEY'
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
} {
  const missing = missingConfiguration(env)
  return {
    ok: missing.length === 0 && Boolean(env.DB) && Boolean(env.INBOUND_QUEUE),
    missing,
    aiConfigured: Boolean(env.AI),
    d1Configured: Boolean(env.DB),
    queueConfigured: Boolean(env.INBOUND_QUEUE)
  }
}
