# Meta WhatsApp Cloud API – Einrichtung (einmalig, ~10 Minuten)

Dieser Bot läuft auf der **offiziellen Meta WhatsApp Cloud API**. Dafür wird eine
eigene Meta-Developer-App angelegt (kostenlos). Die Antworten im 24-Stunden-
Kundenservice-Fenster sind bei Meta **kostenlos** (unbegrenzt, Stand 2026).

> Hinweis: Das Anlegen einer Meta-App funktioniert nur im Browser-Login –
> es gibt dafür keine CLI. Alles danach (Cloudflare-Infrastruktur, Secrets,
> Deployment) ist mit `./deploy.sh` vollautomatisch.

---

## 1. Meta-Developer-Konto

1. Gehe auf **https://developers.facebook.com** und melde dich an (Facebook-Konto).
2. Beim ersten Mal: **Get Started** → Entwicklerkonto bestätigen.
   - Meta kann zur Verifizierung nach einer Kreditkarte fragen – **es wird nichts
     berechnet**, die Karte dient nur der Kontobestätigung.

## 2. App anlegen

1. **My Apps** → **Create App**
2. Nutzungszweck: **Business** → **Next**
3. Name: z. B. `Mama Bot` → **Create app**

## 3. WhatsApp-Produkt hinzufügen

1. Im App-Dashboard: **Add product** → **WhatsApp** → **Set up**
2. **Meta Business Account**: vorhandenen auswählen oder neu erstellen
   (kostenlos, ohne Zahlungsmethode anlegen).

## 4. Telefonnummer / Testnummer

Du hast zwei Optionen:

| Option                                        | Vorteil                    | Hinweis                                                                             |
| --------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| **Testnummer von Meta** (empfohlen zum Start) | sofort da, 100 % kostenlos | kann Nachrichten an bis zu 5 Nummern senden – perfekt für Mama + dich               |
| **Eigene echte Nummer**                       | dauerhaft, unbegrenzt      | die Nummer darf keinem normalen WhatsApp-Konto gehören; Verifizierung per SMS/Anruf |

Unter **WhatsApp → API Setup** findest du nach der Auswahl:

- **Access Token** (temporär, läuft nach 24 h ab)
- **Phone number ID** (eine lange Zahl)
- **Add recipient**: Mamas Nummer im internationalen Format, z. B. `49...`

> **Permanentes Token (empfohlen):** Damit der Bot nicht täglich neu konfiguriert
> werden muss, lege einen System-User an:
> **https://business.facebook.com/settings/system-users** → **Add** →
> **Generate new token** → App `Mama Bot` wählen → Scopes:
> `whatsapp_business_messaging`, `whatsapp_business_management`.

## 5. App-Secret holen

1. **App settings → Basic**
2. Bei **App secret**: **Show** → Wert kopieren (das ist `META_APP_SECRET`).

## 6. Verify-Token wählen

Wähle ein **langes, zufälliges** Token, z. B. `mb-<30 zufällige Zeichen>`.
Es ist nur ein Passwort zwischen Meta und dem Bot – du legst es selbst fest.

## 7. Werte eintragen und deployen

```bash
cd mama-bot
npm install                        # Abhängigkeiten einmalig installieren
cp secrets.env.example secrets.env
# secrets.env mit den Werten fuellen:
#   WHATSAPP_TOKEN              = Access Token aus Schritt 4 (oder permanentes Token)
#   WHATSAPP_PHONE_NUMBER_ID    = Phone number ID aus Schritt 4
#   WHATSAPP_VERIFY_TOKEN       = dein selbst gewaehltes Token aus Schritt 6
#   META_APP_SECRET             = App-Secret aus Schritt 5
#   MOTHER_PHONE                = Mamas Nummer OHNE "+", z. B. 491512345678
#   GROQ_API_KEY                = Optional: Groq API Key (gsk_...) für KI-Antworten
#   CALLMEBOT_API_KEY          = Optional: CallMeBot API Key für alternativen Kanal
./deploy.sh secrets   # setzt die Secrets auf Cloudflare
./deploy.sh           # migriert die DB und deployed den Worker
```

## 8. Webhook im Meta-Dashboard eintragen

1. **WhatsApp → Configuration → Edit**
2. **Callback URL**: `https://mama-bot.<dein-subdomain>.workers.dev/webhook`
   (die genaue URL zeigt das Deployment in Schritt 7)
3. **Verify token**: exakt dein Token aus Schritt 6
4. **Webhook fields**: `messages` abonnieren
5. **Verify and save** – der Bot bestätigt automatisch.

## 9. KI-Anbieter wählen (optional)

Standardmäßig nutzt der Bot **Groq** (schnell, günstig, API-Key reicht). Falls du
Groq nicht nutzen willst, stelle in `wrangler.toml` `AI_PROVIDER = "workers-ai"`
und entferne `GROQ_API_KEY`/`GROQ_MODEL` aus `secrets.env`.

| Anbieter           | Voraussetzung                | Vorteil                        |
| ------------------ | ---------------------------- | ----------------------------- |
| **Groq** (Standard)| `GROQ_API_KEY` in secrets.env| Schnell, kostenlos bedienbar   |
| **Workers AI**     | `AI_PROVIDER=workers-ai`     | Keine externen Keys nötig      |

## 10. Testen

1. Schreib Mama (oder dir selbst) auf dem Testnummer-Handy eine WhatsApp-Nachricht.
2. Du solltest innerhalb weniger Sekunden eine KI-Antwort erhalten.
3. Am nächsten Morgen kommt der erste persönliche Gruß (nur wenn innerhalb der
   letzten 24 h Kontakt bestand – dann ist der Versand bei Meta kostenlos).

---

## Fehlerbehebung

| Problem                                   | Lösung                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `Webhook secret is not configured`        | `./deploy.sh secrets` ausführen                                                  |
| `Invalid signature` bei Webhook-Test      | `META_APP_SECRET` prüfen (App settings → Basic)                                  |
| Keine Antwort auf Nachricht               | `curl https://<url>/health/config` – fehlende Secrets sehen                      |
| Token abgelaufen                          | permanentes System-User-Token anlegen (Schritt 4)                                |
| `The number is not a valid WhatsApp user` | Nummer hat kein WhatsApp, oder Empfänger muss zuerst die Testnummer kontaktieren |
