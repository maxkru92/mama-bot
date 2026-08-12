# Security Policy

## Reporting

Bitte keine Sicherheitslücken, Tokens oder privaten Telefonnummern in öffentlichen Issues posten. Melde sie dem Repository-Owner privat.

## Grundsätze

- Secrets gehören ausschließlich in Wrangler Secrets oder lokale `.dev.vars`.
- `MOTHER_PHONE` wird nicht in Logs ausgegeben.
- Webhooks werden per HMAC-SHA256 validiert.
- Eingehende Nachrichten werden dedupliziert.
- Nur die konfigurierte Telefonnummer darf verarbeitet werden.
- Bei versehentlich veröffentlichten Tokens: sofort bei Meta/Cloudflare widerrufen und rotieren.
