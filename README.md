# Oefentoets Frans – POC

Statische web-app (HTML/CSS/JS, geen build, geen server) om oefentoetsen te maken
op basis van de cursus **Frans 5de leerjaar – Deel A** (Missions 1–3 + Destination A).

## Lokaal openen
Dubbelklik `index.html` – werkt rechtstreeks in de browser (ook offline).

## Structuur
```
index.html            schermen: instellingen → toets → resultaat
css/style.css         opmaak (licht/donker, gsm-vriendelijk)
js/engine.js          vraaggeneratoren, verbetering, foutanalyse
js/app.js             interface
js/config.js          koffieknop (voorlopig uit) + link, feedbackmail
data/frans-5-cahier-a.json   leerstof (bron)
data/frans-5-cahier-a.js     zelfde leerstof, laadbaar zonder server
```
Na een wijziging in het `.json`-bestand moet het `.js`-bestand opnieuw gegenereerd worden
(`window.COURSES.push(<json>)`).

## Functies (POC)
- **Selectie**: per Mission en per onderdeel (woordenschat en grammatica apart), met snelkeuze
  *Alles / Enkel woordenschat / Enkel grammatica*.
- **Richting**: NL→FR, FR→NL of beide (voor woordenschat).
- **Aantal vragen**: 10/20/30/50 of **Alle** = eindtoets met volledige dekking:
  elk woord, elke zin en elk getal precies één keer (optioneel in beide richtingen), en per grammatica-onderdeel
  een vaste lijst gevallen (`COVERAGE` in `engine.js`): alle vormen van être/aimer, elke -ER-uitgang en elk werkwoord,
  het lidwoord van elk zelfstandig naamwoord, elke variant van le/la/l'/les en au/à la/à l'/aux, enz.
  Op het resultaatscherm volgt per onderdeel een oordeel: volledig gekend / bijna gekend / nog niet gekend.
- **Context-hints** (💡) bij dubbelzinnige woorden, bv. *te* → "zoals in: Niet te snel!" (velden `hint_nl`/`hint_fr` in de leerstof).
- **Moeilijkheid**: makkelijk (meerkeuze), normaal (mix; accentfout telt als goed maar wordt gemeld),
  moeilijk (alles typen; accent en lidwoord moeten juist zijn).
- **Vraagtypes**: vertalen, getallen en rekenen, voornaamwoord kiezen, être/aimer/-ER vervoegen, de/d',
  un/une/des, le/la/l'/les, au/à la/à l'/aux, meervoud, c'est/ce sont, c'est qui/quoi, tu/vous, j'aime + infinitief.
  Vragen worden telkens nieuw samengesteld.
- **Verbetering**: herkent accentfout, verkeerd/vergeten lidwoord, één-letterfout.
- **Resultaat**: score, conclusies (werkpunten met paginaverwijzing en regel, foutpatronen,
  NL→FR vs FR→NL, meerkeuze vs typen), score per onderdeel, foutenlijst,
  knop *Oefen enkel je fouten opnieuw*.
- Laatste instellingen worden in de browser onthouden.

## Publiceren op GitHub Pages
1. Nieuwe repo (bv. `oefentoets-frans`) op GitHub, inhoud van deze map in de root.
2. *Settings → Pages → Deploy from a branch → main / (root)*.
3. De site staat op `https://<gebruiker>.github.io/oefentoets-frans/`.

## Roadmap
1. **POC verfijnen**: feedback van Lauke verwerken, foute/onduidelijke vragen bijsturen, uitspraak (spraaksynthese) voor FR-woorden.
2. **Meer leerstof**: Cahier B en andere vakken als extra datafiles; vakkeuze op het startscherm.
3. **Voortgang**: geschiedenis van toetsen per toestel, "zwakke woorden" vaker herhalen (spaced repetition).
4. **Semi-commercieel**: koffieknop is klaar maar verborgen (aanzetten met showCoffee + link invullen in `js/config.js` zodra het account bestaat), suggestiemail, eigen domein,
   privacyvriendelijke statistieken. Let op auteursrecht: de woordenlijsten komen uit een uitgeverscursus
   — voor publiek/commercieel gebruik eerst nagaan wat mag, of eigen woordenlijsten gebruiken.
