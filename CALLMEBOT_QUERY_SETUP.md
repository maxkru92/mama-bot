# CallMeBot Query Bridge – Cloudflare-only Einrichtung

**Live-Status (13. September 2026):** Die Worker-Bridge ist implementiert und deployed.
Die offizielle CallMeBot-Seite kennzeichnet den Query-/Empfangsdienst weiterhin als
„in development“. Die dort dokumentierten `whatsapp_add.php`-, `whatsapp_list.php`- und `whatsapp_remove.php`-Endpoints antworteten bei der Live-Prüfung mit HTTP 404.
Daher ist die Registrierung derzeit **nicht bestätigt und nicht als live verfügbar
anzusehen**. Diese Anleitung beschreibt die vorbereitete Worker-Seite für den Fall,
dass CallMeBot den Dienst wieder freischaltet oder einen aktuellen Endpoint bereitstellt.

Diese Variante benötigt **keine Meta WhatsApp Cloud API**. Sie nutzt die dokumentierte
CallMeBot-Query/Action-Funktion:

```text
WhatsApp-Query → CallMeBot ruft Worker-Action per GET auf
              → Cloudflare Queue → Groq → D1-Outbox
              → CallMeBot sendet die Antwort zurück
```

> Einschränkung: CallMeBot-Queries sind feste Kommandos. Dieser Weg ist kein freier
> WhatsApp-Webhook für beliebige Nachrichtentexte.

## 1. Secrets setzen

Zusätzlich zu `MOTHER_PHONE`, `GROQ_API_KEY` und `CALLMEBOT_API_KEY` benötigt die
Bridge ein eigenes zufälliges Secret:

```dotenv
CALLMEBOT_CALLBACK_TOKEN=<langes-zufälliges-secret>
```

Das Secret wird als geschützter URL-Parameter an die Action übergeben. Da CallMeBot
bei dieser Query-Funktion keinen benutzerdefinierten Authorization-Header setzt, muss
die Action-URL den Token enthalten. Deshalb: nicht in Git committen, nicht in Logs
ausgeben und bei einer Rotation alle registrierten Actions aktualisieren.

```bash
./deploy.sh secrets
./deploy.sh
```

## 2. Action-URL

Die Action-URL lautet:

```text
https://mama-bot.maxkrupp.workers.dev/callmebot/inbound
```

CallMeBot muss für jedes feste Thema eine Action-URL mit den festen Parametern
`intent`, `phone` und `token` aufrufen. Beispiel für die `pflege`-Query:

```text
https://mama-bot.maxkrupp.workers.dev/callmebot/inbound?intent=pflege&phone=4916090764166&token=<CALLMEBOT_CALLBACK_TOKEN>
```

Registriere für jedes Thema eine eigene Action-URL und ersetze nur `intent`. Ein
separater `phone`-Parameter ist optional, wenn der Dienst ihn nicht unterstützt:
der Worker verwendet dann die konfigurierte `MOTHER_PHONE`. Die Action akzeptiert
außerdem `query` als Alias für `intent`.

## 3. Unterstützte Queries

| Query                    | Intent                              |
| ------------------------ | ----------------------------------- |
| `italien` / `italy`      | Italien und Lebensart               |
| `toskana`                | Toskana                             |
| `rezept` / `kochen`      | italienisches Rezept                |
| `pflege` / `pflegekasse` | allgemeine Pflege-Orientierung      |
| `rente` / `renten`       | allgemeine Renten-Orientierung      |
| `anwalt` / `recht`       | vorsichtige rechtliche Orientierung |
| `hilfe` / `help`         | verfügbare Themen                   |
| `start`                  | Morgen-Grüße einschalten            |
| `stop` / `stopp`         | Morgen-Grüße pausieren              |

## 4. Queries bei CallMeBot registrieren

Nach erfolgreicher CallMeBot-Aktivierung können Queries laut CallMeBot-Dokumentation
über `whatsapp_add.php` registriert werden. Beispiel:

```text
https://api.callmebot.com/whatsapp_add.php?phone=4916090764166&apikey=<CALLMEBOT_API_KEY>&query=pflege&action=https%3A%2F%2Fmama-bot.maxkrupp.workers.dev%2Fcallmebot%2Finbound%3Fintent%3Dpflege%26phone%3D4916090764166%26token%3D<CALLMEBOT_CALLBACK_TOKEN>
```

Der API-Key und der Callback-Token sind Platzhalter und dürfen nicht in Git, Logs
oder öffentlichen Issues erscheinen. Prüfe nach jeder Registrierung die Antwort von
CallMeBot und teste zuerst mit `hilfe`.

Zum Auflisten bzw. Entfernen verwendet CallMeBot:

```text
https://api.callmebot.com/whatsapp_list.php?phone=4916090764166&apikey=<CALLMEBOT_API_KEY>
https://api.callmebot.com/whatsapp_remove.php?phone=4916090764166&apikey=<CALLMEBOT_API_KEY>&query=pflege
```

## 6. Aktueller Befund

Die Worker-Route kann nach dem Setzen von `CALLMEBOT_CALLBACK_TOKEN` sicher getestet
werden. Ohne dieses Secret antwortet sie absichtlich mit `503`. Eine echte WhatsApp-
Nachricht wird erst verarbeitet, wenn CallMeBot die Query-Registrierung wieder anbietet
und eine registrierte Query den Endpoint aufruft.

Für einen echten freien Zwei-Wege-Chat bleibt weiterhin ein Inbound-Anbieter nötig,
beispielsweise die Meta Cloud API oder ein dauerhaft laufender WhatsApp-Web-Client.
