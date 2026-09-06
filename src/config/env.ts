const META_SECRETS = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'META_APP_SECRET'
] as const
const CALLMEBOT_SECRETS = ['CALLMEBOT_API_KEY'] as const

export function missingConfiguration(env: Env): string[] {
  const channel = (env.CHANNEL || 'meta').toLowerCase()
  const channelSecrets = channel === 'callmebot' ? CALLMEBOT_SECRETS : META_SECRETS
  const baseSecrets = ['MOTHER_PHONE', 'GROQ_API_KEY']
  const requiredSecrets = [...baseSecrets, ...channelSecrets]
  return requiredSecrets.filter((key) => {
    const value = env[key as keyof Env]
    return typeof value !== 'string' || !value.trim()
  })
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
