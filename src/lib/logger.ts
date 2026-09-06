export function logError(context: string, error: unknown, extra?: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      level: 'error',
      context,
      message: error instanceof Error ? error.message : String(error),
      ...extra
    })
  )
}
