# Shopify-integratie (stap 2 — pas na geslaagde test)

## 1. Widget in de winkel
Theme dupliceren (main-theme is via de API geblokkeerd), in de kopie `layout/theme.liquid` vlak vóór `</body>`:

```liquid
<script src="https://homedecobali.github.io/hdb-ai/widget.js" data-lang="{{ request.locale.iso_code }}" defer></script>
```
Kopie publiceren. Opent een pagina met `?hdb_order=HDB26-1234`, dan gaat de chat direct open met dat ordernummer.

## 2. Link in alle mails na aankoop
Per notificatie (Bestelbevestiging, Verzendbevestiging, Verzendupdate, Bezorgd, Order bewerkt…) **én per taal** — Edit code wijzigt alleen de EN-basis; es en pt-PT zijn aparte vertaalde bodies (translatableResources EMAIL_TEMPLATE).

ES:
```liquid
<p style="font-family:Georgia,'Times New Roman',serif;color:#5C5245">¿Dudas sobre tu pedido? Pregunta a nuestro asistente, responde al momento:
<a href="https://homedecobali.es/?hdb_order={{ order.name | remove: '#' }}" style="color:#A4763F">consulta tu pedido {{ order.name }}</a></p>
```
pt-PT:
```liquid
<p style="font-family:Georgia,'Times New Roman',serif;color:#5C5245">Dúvidas sobre a tua encomenda? Pergunta ao nosso assistente, responde na hora:
<a href="https://homedecobali.es/?hdb_order={{ order.name | remove: '#' }}" style="color:#A4763F">consulta a tua encomenda {{ order.name }}</a></p>
```
Zelfde blok in de DEWI NA BESTELLING-mails (Brevo/n8n).

## 3. Eigen domein (later)
CNAME bv. `ayuda.homedecobali.es` → `homedecobali.github.io`, in de repo een `CNAME`-bestand, en het domein aan `ALLOWED_ORIGINS` in de edge function toevoegen.
