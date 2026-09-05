interface Env {
  DB: D1Database
  INBOUND_QUEUE: Queue<QueueMessage>
  AI?: Ai
  MOTHER_NAME: string
  MOTHER_TIMEZONE: string
  MOTHER_LOCALE: string
  MORNING_HOUR: string
  MORNING_MINUTE: string
  MORNING_VARIANCE_MINUTES: string
  AI_MODEL: string
  WHATSAPP_API_VERSION: string
  MAX_REPLY_CHARS: string
  WHATSAPP_TOKEN: string
  WHATSAPP_PHONE_NUMBER_ID: string
  WHATSAPP_VERIFY_TOKEN: string
  META_APP_SECRET: string
  MOTHER_PHONE: string
  AI_PROVIDER: string
  GROQ_API_KEY: string
  GROQ_MODEL: string
  CHANNEL: string
  MORNING_DAILY: string
  CALLMEBOT_API_KEY: string
}
