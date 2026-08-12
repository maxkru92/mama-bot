export type Direction = 'inbound' | 'outbound'
export type MessageStatus = 'received' | 'queued' | 'sent' | 'failed'

export interface QueueMessage {
  kind: 'inbound' | 'outbox'
  messageId: string
  phone: string
  text?: string
  outboxId?: number
}

export interface MetaWebhookPayload {
  object?: string
  entry?: MetaEntry[]
}

export interface MetaEntry {
  changes?: Array<{ field?: string; value?: MetaChangeValue }>
}

export interface MetaChangeValue {
  messages?: MetaIncomingMessage[]
  statuses?: Array<Record<string, unknown>>
}

export interface MetaIncomingMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

export interface IncomingMessage {
  id: string
  phone: string
  text: string
  timestamp: string
}

export interface UserProfile {
  phone: string
  name: string
  timezone: string
  locale: string
  proactiveEnabled: boolean
  lastInboundAt: string | null
}

export interface RecentMessage {
  direction: Direction
  body: string
  createdAt: string
}

export interface TopicCard {
  key: string
  title: string
  text: string
  tags: string[]
}

export interface MorningCandidate {
  key: string
  text: string
}

export interface AiResult {
  text: string
  provider: 'workers-ai' | 'fallback'
}
