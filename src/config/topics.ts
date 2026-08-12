import type { MorningCandidate, TopicCard } from '../types'

export const TOPICS: TopicCard[] = [
  {
    key: 'italy-life',
    title: 'Italienisches Lebensgefühl',
    text: 'In Italien gehört die kleine Pause nicht zum Luxus, sondern zum guten Leben: ein Espresso, ein Gespräch und ein Moment ohne Eile. Genau diese Kunst, den Alltag zu genießen, kannst du dir auch zu Hause bewahren.',
    tags: ['italien', 'lebensgefühl', 'wissen', 'pause', 'genuss']
  },
  {
    key: 'tuscany',
    title: 'Toskana',
    text: 'Die Toskana ist nicht nur Landschaft: Viele Orte pflegen bis heute Wochenmärkte, saisonale Küche und eine starke Verbindung zwischen Dorf, Handwerk und Familie. Florenz, Siena und die kleinen Hügeldörfer lohnen sich zu jeder Jahreszeit.',
    tags: ['toskana', 'reise', 'wissen', 'florenz', 'siena']
  },
  {
    key: 'sea',
    title: 'Meer',
    text: 'An Italiens Küsten verändert sich die Küche oft innerhalb weniger Kilometer. Am Meer werden einfache Zutaten besonders wichtig: gutes Olivenöl, Zitrone, Kräuter und frischer Fisch.',
    tags: ['meer', 'küste', 'küche', 'urlaub', 'strand']
  },
  {
    key: 'personality',
    title: 'Italienische Herzlichkeit',
    text: 'Italienische Herzlichkeit zeigt sich oft in kleinen Gesten: jemanden zum Essen einladen, Zeit teilen und ein Rezept nicht nur erklären, sondern gemeinsam zubereiten. So entstehen die schönsten Erinnerungen.',
    tags: ['italien', 'kultur', 'lebensgefühl', 'herzlichkeit', 'familie']
  },
  {
    key: 'pasta',
    title: 'Pasta-Wissen',
    text: 'Eine gute Pastasauce braucht nicht viele Zutaten. Entscheidend sind Hitze, etwas Nudelwasser und der richtige Moment, in dem Sauce und Pasta zusammenfinden. Al dente heißt: außen weich, innen mit leichtem Biss.',
    tags: ['kochen', 'pasta', 'rezept', 'nudeln']
  },
  {
    key: 'pomodoro',
    title: 'Schnelle italienische Küche',
    text: 'Für eine einfache Tomatensauce reichen gute Dosentomaten, Olivenöl, Knoblauch oder Zwiebel, Salz und Basilikum. Weniger Zutaten machen die Qualität umso wichtiger — und das Gericht ist in 20 Minuten fertig.',
    tags: ['kochen', 'rezept', 'italien', 'tomatensauce']
  },
  {
    key: 'travel',
    title: 'Reisen',
    text: 'Eine schöne Italienreise muss nicht aus vielen Stationen bestehen. Oft bleibt gerade ein Ort in Erinnerung, an dem man morgens ohne Plan losgeht und abends am selben Platz wiederkommt.',
    tags: ['reise', 'italien', 'meer', 'urlaub']
  },
  {
    key: 'espresso',
    title: 'Espresso & Kaffeekultur',
    text: 'In Italien ist der Espresso ein kurzer, freundlicher Moment am Tag — meist stehend an der Bar getrunken, oft mit einem Gläschen Wasser dazu. Ein caffè macchiato am Vormittag gehört zum Alltag wie das Wettergespräch.',
    tags: ['kaffee', 'espresso', 'italien', 'genuss', 'kultur']
  },
  {
    key: 'wine',
    title: 'Italienische Weine',
    text: 'Italien hat mehr Weinsorten als viele Länder Trauben: vom Chianti aus der Toskana über Prosecco aus Venetien bis zum prickelnden Lambrusco aus der Emilia-Romagna. Zum Essen gehört Wein dazu — aber immer in Maßen.',
    tags: ['wein', 'italien', 'toskana', 'chianti', 'prosecco']
  },
  {
    key: 'dolce-vita',
    title: 'Dolce Vita & Lebensart',
    text: 'Dolce Vita bedeutet nicht Faulheit, sondern das richtige Tempo: Die Arbeit ernst nehmen, aber auch das Essen, die Gespräche und die Sonne. Eine Pausa nach dem Essen gehört in Italien fast zum Gesetz.',
    tags: ['dolce vita', 'lebensart', 'italien', 'entspannung', 'genuss']
  },
  {
    key: 'festivals',
    title: 'Feste & Traditionen',
    text: 'Jede italienische Region feiert ihre eigenen Feste: von der Palio-Pferderennbahn in Siena bis zu den Lichterfesten in den Dörfern. Viele Feste drehen sich um Essen, Musik und die ganze Nachbarschaft.',
    tags: ['feste', 'tradition', 'italien', 'siena', 'kultur']
  },
  {
    key: 'sicily',
    title: 'Sizilien',
    text: 'Sizilien vereint viele Kulturen: griechische Tempel, arabische Einflüsse und barocke Städte. In der Küche zeigen sich diese Spuren — von Arancini über Cannoli bis zu Zitronen und Mandeln aus dem Süden.',
    tags: ['sizilien', 'reise', 'italien', 'meer', 'essen']
  },
  {
    key: 'market',
    title: 'Märkte & Einkaufen',
    text: 'Auf italienischen Märkten entscheidet die Saison: Tomaten und Basilikum im Sommer, Pilze und Kürbis im Herbst, Orangen und Zitronen im Winter. Wer saisonal einkauft, kocht fast von allein gut.',
    tags: ['markt', 'einkaufen', 'saison', 'kochen', 'italien']
  },
  {
    key: 'family',
    title: 'Familie & Zusammenhalt',
    text: 'In Italien steht der Sonntag oft im Zeichen der Familie: ein gemeinsames Essen, das lange dauert und bei dem keiner auf die Uhr schaut. Genau dieser Zusammenhalt macht so viele Erinnerungen aus.',
    tags: ['familie', 'sonntag', 'italien', 'zusammenhalt', 'essen']
  }
]

export const MORNING_MESSAGES: MorningCandidate[] = [
  {
    key: 'espresso',
    text: 'Guten Morgen, liebe Mama ☀️ Heute wünsche ich dir einen ruhigen Start, vielleicht mit einem Kaffee und einem kleinen italienischen Gedanken: Das gute Leben beginnt oft mit Zeit füreinander.'
  },
  {
    key: 'tuscany',
    text: 'Buongiorno, liebe Mama 🌿 Ein kleiner Gruß aus der Toskana: Stell dir sanfte Hügel, Zypressen und einen Markt mit frischem Brot vor. Ich hoffe, dein Tag beginnt genauso angenehm.'
  },
  {
    key: 'recipe',
    text: 'Guten Morgen, liebe Mama 🍅 Vielleicht wäre heute ein schöner Tag für etwas Italienisches: Pasta al pomodoro mit Basilikum, gutem Olivenöl und ganz viel Ruhe beim Kochen. Wenn du magst, schicke ich dir das Rezept!'
  },
  {
    key: 'sea',
    text: 'Guten Morgen, liebe Mama 🌊 Heute ein Gedanke ans Meer: Zitrone, Salz, Sonne und ein bisschen Wind können schon in der Vorstellung einen kleinen Urlaub schenken.'
  },
  {
    key: 'travel',
    text: 'Buongiorno, liebe Mama ✈️ Manchmal ist die schönste Reise eine kleine: ein neuer Markt, ein unbekannter Weg oder ein Rezept aus einer Region, die man noch nicht kennt.'
  },
  {
    key: 'warmth',
    text: 'Guten Morgen, liebe Mama ❤️ In Italien sagt man nicht nur, dass man an jemanden denkt — man lädt ihn zum Essen ein. Ich schicke dir heute beides: einen lieben Gedanken und eine Portion Vorfreude auf etwas Schönes.'
  },
  {
    key: 'coffee',
    text: 'Buongiorno, liebe Mama ☕ Italien beginnt den Tag mit einem Espresso — kurz, stark und voller Genuss. Heute wünsche ich dir genau diesen Moment: nur für dich, ohne Eile.'
  },
  {
    key: 'sunday',
    text: 'Guten Morgen, liebe Mama 🏡 In Italien gehört der Sonntag der Familie und dem Essen. Selbst wenn heute kein Sonntag ist: Vielleicht findest du eine kleine Auszeit für etwas, das dir guttut.'
  },
  {
    key: 'autumn',
    text: 'Guten Morgen, liebe Mama 🍂 Je nach Jahreszeit lohnt sich ein Blick auf den Markt: Pilze und Kürbis im Herbst, Spargel im Frühling, Tomaten im Sommer. Die Natur gibt den Rhythmus vor — und das Kochen wird ganz einfach.'
  },
  {
    key: 'smile',
    text: 'Buongiorno, liebe Mama 😊 Ein Lächeln am Morgen wirkt wie Sonne im Raum. Ich schicke dir eins — zusammen mit dem Gedanken, dass heute bestimmt ein schöner Tag für dich bereithält.'
  },
  {
    key: 'memories',
    text: 'Guten Morgen, liebe Mama 🧡 Die schönsten Erinnerungen entstehen oft bei kleinen gemeinsamen Momenten: ein Kaffee, ein Gespräch, ein Rezept. Ich denke heute besonders an dich.'
  },
  {
    key: 'garden',
    text: 'Buongiorno, liebe Mama 🌿 Italienische Gärten sind Orte der Ruhe: Zypressen, Kräuter und ein Platz im Schatten. Vielleicht findest du heute einen kleinen Moment zum Durchatmen — ganz in deinem Tempo.'
  }
]

export function topicContext(): string {
  return TOPICS.map((topic) => `${topic.title}: ${topic.text}`).join('\n')
}
