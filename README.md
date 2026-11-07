# hdb-ai — HomeDecoBali klantassistent

Virtuele assistent die klanten helpt met **lopende orders** (na verificatie) en met **alles over onze producten**, verzending, reserveringen en retouren. Klantgericht in ES-ES / pt-PT / EN.

## Opbouw

| Onderdeel | Pad | Waar het draait |
| --- | --- | --- |
| Chatpagina (test + iframe) | `index.html` | GitHub Pages → `https://homedecobali.ai/` (CNAME in repo; fallback `homedecobali.github.io/hdb-ai/`) |
| Winkel-bubbel | `widget.js` | ingeladen in het Shopify-theme |
| Backend | `supabase/functions/hdb-ai/index.ts` | Supabase Edge Function `hdb-ai` (project `jucubuoftjehwancegma`) |
| Log + rate-limit | `supabase/migrations/20261105_hdb_ai_assistant_tables.sql` | `hdb_ai_messages` (30 dg), `hdb_ai_events` (2 dg), cron `hdb-ai-retentie` |

Endpoint: `POST https://jucubuoftjehwancegma.supabase.co/functions/v1/hdb-ai`
Body: `{ "session_id": "...", "lang": "es|pt|en", "messages": [{ "role": "user", "content": "..." }] }` → `{ "session_id", "reply" }`

## Wat de assistent kan (tools, live Shopify Admin GraphQL)
- `search_products` / `get_product` — catalogus (actief), titel + omschrijving in klanttaal, prijs, voorraad, reservering (`custom.preorder_eta`), link.
- `get_store_policies` — verzending, retour, contact, privacy, voorwaarden (live shopbeleid).
- `lookup_order` — status, betaling, verzending, track & trace, reserveringsregels. **Verificatie: 2 van 3** — ordernummer, e-mail van de order, voor- + achternaam. Faalt de match, dan zegt de assistent niet of de order bestaat. Max 5 mislukte pogingen per IP per uur.

Kan niet: wijzigen, annuleren, terugbetalen, adres aanpassen, kortingen. Verwijst dan naar support@homedecobali.com.

## Beveiliging
- CORS-allowlist: homedecobali.es/.com/.pt, `c62tdp-kr.myshopify.com`, `homedecobali.github.io`, localhost.
- Rate-limit 30 berichten / IP / 10 min (IP alleen gehasht opgeslagen).
- Geen PII naar de klant behalve voornaam + bezorgplaats. Gesprekslog 30 dagen.
- Secrets alleen in Supabase Edge Function Secrets — nooit in deze repo.

## Secrets (Supabase → Edge Functions → Secrets)
| Naam | Waarde |
| --- | --- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` | Klant-ID + Klantgeheim van Dev Dashboard-app **HDB-ai** (zelfde organisatie als de winkel; client credentials grant, token 24u). Scopes: `read_products`, `read_orders`, `read_customers` (+ `read_all_orders`, `read_legal_policies` gepland) |
| `SHOPIFY_STORE` | optioneel, default `c62tdp-kr.myshopify.com` |
| `HDB_AI_MODEL` | optioneel, default `claude-sonnet-4-6` |

## Testen
1. GitHub Pages aan: Settings → Pages → Deploy from branch `main` / root.
2. Open `https://homedecobali.github.io/hdb-ai/` (taal: `?lang=pt`, order-voorinvulling: `?order=HDB26-1837`).
3. Testvragen: "¿Dónde está mi pedido #HDB26-xxxx?" + e-mail · "Busco una cesta grande" · "¿Enviáis a Baleares?".

## Medewerkermodus: prijsetiketten (07-11-2026)
Een medewerker typt op homedecobali.ai: *"ik ben marco en mijn code is 1234"*. De pagina herkent dit zelf (Nederlands "ik ben …" + "code …") en stuurt het **niet** naar de klantchat of Claude, maar naar n8n **HDB · CUSTSERV · Dewi Etiketten** (`POST /webhook/dewi-staff`, workflow `6RMIOFJaNiFr47AJ`).

| Onderdeel | Waar |
| --- | --- |
| Medewerkers + codes (bcrypt) | Supabase `hdb_ai_staff`; sessies (sha256-token, 10 uur) `hdb_ai_staff_sessions` |
| Login / check / logout | RPC `hdb_ai_staff_login` (max 5 fout per uur per IP en per naam), `hdb_ai_staff_check`, `hdb_ai_staff_logout` |
| Medewerker toevoegen / code wijzigen | `select public.hdb_ai_staff_set('<naam>', '<Weergavenaam>', '<code>');` (oude sessies verlopen direct) |
| Vaste etiketnaam per SKU | `hdb_ai_label_names` (via Dewi: "noem DE… voortaan …") |
| Migratie | `supabase/migrations/20261107_hdb_ai_staff_labels.sql` |

Na inloggen praat Dewi Nederlands en zet ze **printlijsten** klaar: per SKU, meerdere SKU's, SKU-reeks (prefix), categorie of zoekwoord; aantal 1 / vast / gelijk aan voorraad; prijs +/- % of bedrag of vaste prijs, afronden (hele euro, ,95, ,99, ,50). Prijzen, SKU en voorraad komen live uit Shopify; **prijsaanpassingen gelden alleen op het etiket**.

**Etiketnaam** = producttype + modelnaam uit de Spaanse titel (bijv. *Escultura … Modelo Kanawa* → `ESCULTURA KANAWA`), tenzij er een vaste naam is opgeslagen.

**Printen** gebeurt in de browser van de medewerker, zonder DYMO-software: de pagina maakt per stuk een pagina van 89 × 36 mm (DYMO 30321 Large Address), opgemaakt 1-op-1 naar het DYMO-sjabloon `Etiket1.label` (SKU + naam vet, prijs `EURO 149,00`, daaronder links de **SKU als Code 128-barcode** (module 0,254 mm = 3 dots op 300 dpi, 6,1 mm hoog), logo `assets/etiket-logo.png`), en opent het afdrukvenster. Eenmalig kiezen: printer DYMO LabelWriter 450 Turbo, papier 30321, marges Geen, schaal 100%. Zonder afdrukvenster: DYMO als standaardprinter + Chrome/Edge-snelkoppeling met `--kiosk-printing`.

## Live zetten (na test)
Zie `docs/shopify-integratie.md` — widget in het theme, link in orderbevestiging/verzendmails.
