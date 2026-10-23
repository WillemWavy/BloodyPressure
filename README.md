# Bloody Pressure

Web-app als **lichamelijk logboek voor mensen met hoge bloeddruk**. Gebaseerd op [Emo Track / Emodagboek](https://github.com/WillemWavy/Emodagboek), maar gericht op bloeddruk, klachten en leefstijl.

**Open de app:** https://willemwavy.github.io/BloodyPressure/

## Functies

- **Kalender** met per dag een kleur volgens de bloeddrukindeling en een stip per ingevuld dagdeel. Vandaag heeft een rand.
- **Per dagdeel (ochtend, middag, avond):**
  - **Bloeddruk**: meerdere metingen (boven, onder, hartslag, tijd); de app neemt het gemiddelde.
  - **Meetomstandigheden**: linker- of rechterarm, zittend, staand of liggend.
  - **Gevoel** (vijf gezichtjes) en **stress of spanning** (1–5).
  - **Medicatie**: eigen medicijnlijst, per dagdeel afvinken als ingenomen of overgeslagen.
  - **Lichamelijke klachten** met ernst (licht, matig, ernstig): hoofdpijn, duizeligheid, vermoeidheid, pijn op de borst, andere pijn (met plek), hartkloppingen, kortademig, misselijk, wazig zien, oorsuizen, neusbloeding, dikke enkels, droge hoest, spierpijn of kramp, vaak plassen.
  - **Bijwerkingen**, eventueel gekoppeld aan een medicijn, en een notitie.
- **Per dag (dag & leefstijl):** slaap (uren en kwaliteit), beweging (soort, minuten, intensiteit, stappen), zout, alcohol, cafeïne, gewicht en een notitie.
- **Waarschuwingen** bij een zeer hoge bloeddruk (vanaf 180/110), pijn op de borst, of lage bloeddruk met duizeligheid.
- **Kleurcodes** volgens de indeling voor thuismetingen uit de ESC-richtlijn 2024 (normaal onder 120/70, verhoogd 120–134 / 70–84, hoog vanaf 135/85), plus een **eigen streefwaarde**. Kleurcodes zijn uit te zetten.
- **Trendanalyse**: gemiddelden, % binnen streefwaarde, bloeddruk en hartslag per dag, ochtend/middag/avond, indeling, gevoel en stress, klachten, beweging per week, slaap, gewicht, medicatietrouw, en **verbanden** (bijv. bovendruk op dagen met en zonder beweging, veel zout, alcohol, weinig slaap, veel stress, overgeslagen medicatie of bepaalde klachten).
- **PDF-rapport** over een zelfgekozen periode, om mee te nemen naar de huisarts of specialist: samenvatting, medicijnen, grafieken, verbanden, alle metingen, leefstijl en notities.
- **Back-up**: alles als één JSON-bestand opslaan of delen (bijv. naar Google Drive) en later terugzetten, ook op een ander apparaat.
- **Nederlands en Engels**, licht en donker thema, Material 3-stijl.
- **Installeerbaar** als app (PWA) en werkt zonder internet.

## Privacy

Alles blijft lokaal in de browser (IndexedDB) op je eigen apparaat. Geen account, geen server, geen cookies, geen trackers, geen externe lettertypes of scripts. De app laadt alleen bestanden van zijn eigen adres.

Let op: wis je de browsergegevens van de site, dan zijn je gegevens weg. Maak dus af en toe een back-up (de app herinnert je eraan).

## Geen medisch advies

Bloody Pressure is een hulpmiddel om bij te houden, geen medisch hulpmiddel. Volg altijd het advies van je eigen arts. Bij pijn op de borst, plotselinge uitval of een zeer hoge bloeddruk met klachten: bel 112.

## Techniek

Gewone HTML, CSS en JavaScript (ES-modules), zonder build-stap of afhankelijkheden van buitenaf.

- `index.html`, `css/app.css` — Material 3-thema en componenten
- `js/store.js` — opslag in IndexedDB, back-up
- `js/bp.js` — indeling, gemiddelden, statistiek en verbanden
- `js/charts.js`, `js/analysis.js` — SVG-grafieken (ook gebruikt in de PDF)
- `js/pdf.js` — PDF-rapport met [jsPDF](https://github.com/parallax/jsPDF) (meegeleverd in `vendor/`, MIT)
- `js/views/` — de schermen
- `sw.js`, `manifest.webmanifest` — offline gebruik en installeren
- Iconen: [Material Design Icons](https://pictogrammers.com/library/mdi/) (Pictogrammers, Apache 2.0)

Lokaal draaien:

```
python3 -m http.server 8000
```

en open http://localhost:8000.

Bij een nieuwe versie: verhoog `APP_VERSION` in `js/store.js` en `VERSION` in `sw.js`, zodat gebruikers de update krijgen.

## Steunen

Vind je de app fijn? Je kunt me steunen via [Throne](https://throne.com/willemwavy).

Gemaakt door [WillemWavy](https://github.com/WillemWavy).
