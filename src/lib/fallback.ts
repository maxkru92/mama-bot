import { TOPICS } from '../config/topics'

export function fallbackReply(text: string, name: string): string {
  const normalized = text.toLocaleLowerCase('de-DE')
  if (
    normalized.includes('rezept') ||
    normalized.includes('kochen') ||
    normalized.includes('pasta')
  ) {
    return `Gern, ${name}! Für ein einfaches italienisches Abendessen empfehle ich Pasta al pomodoro: gute Tomaten mit Olivenöl sanft köcheln lassen, die Pasta knapp al dente kochen und etwas Nudelwasser in die Sauce geben. Zum Schluss Basilikum und Parmesan — falls du magst.`
  }
  const topic =
    TOPICS.find((candidate) => candidate.tags.some((tag) => normalized.includes(tag))) ?? TOPICS[0]
  return `${topic.text} Wenn du möchtest, erzähle ich dir mehr dazu oder mache daraus eine konkrete Reiseidee beziehungsweise ein Rezept.`
}
