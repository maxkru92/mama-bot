export type UserCommand = 'stop' | 'start' | 'help' | null

export function commandFor(text: string): UserCommand {
  const normalized = text.trim().toLocaleLowerCase('de-DE')
  if (/^(stopp|stop|pause|keine nachrichten mehr)$/.test(normalized)) return 'stop'
  if (/^(start|weiter|nachrichten an)$/.test(normalized)) return 'start'
  if (/^(hilfe|help|menu|menü)$/.test(normalized)) return 'help'
  return null
}

export function safetyPrefix(text: string): string {
  if (/\b(112|notfall|notruf|bewusstlos|schlaganfall|herzinfarkt|akute luftnot)\b/i.test(text)) {
    return 'Wenn das gerade ein echter Notfall ist: Bitte sofort 112 anrufen und eine Person in deiner Nähe um Hilfe bitten. '
  }
  if (/\b(selbstmord|suizid|nicht mehr leben|umbringen)\b/i.test(text)) {
    return 'Wenn du dich akut in Gefahr siehst, ruf bitte sofort 112 an oder wende dich an eine vertraute Person. '
  }
  return ''
}

export function helpText(name: string): string {
  return `Ich bin dein Mama Bot, ${name}. Du kannst mich alles fragen — zum Beispiel zu Rezepten, Italien, Reisen, Meer, Toskana oder dem Alltag. Mit STOPP pausiere ich morgendliche Grüße, mit START schalte ich sie wieder ein.`
}
