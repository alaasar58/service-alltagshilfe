# Google Apps Script – Umstieg

## Was bleibt, was sich ändert

| Blatt | Was passiert |
|---|---|
| `Privatkunden` | **unverändert.** Gleiche Spalten, gleiche Anfrage-IDs, gleiche E-Mail |
| `Firmenkunden` | **unverändert.** Ebenso |
| `Tracking` | wird **eingefroren**. Kein Schreibzugriff mehr, bleibt vollständig als Archiv |
| `Dashboard` | bleibt als Archiv stehen |
| `Dashboard_Daten` | bleibt als Archiv stehen |
| `Tracking_Ereignisse` | **neu.** Eine Zeile pro Ereignis, 28 Spalten |
| `Auswertung` | **neu.** Kennzahlen, Verlauf, Tabellen |

Die Formularverarbeitung ist Zeile für Zeile aus dem bisherigen Skript
übernommen. Anfrage-IDs laufen weiter (`ANF-P-JJJJMMTT-001`), der
E-Mail-Text ist identisch, `replyTo` bleibt die Adresse des Absenders.

## Warum das Tracking umgestellt wird

Bisher gab es **eine Zeile pro Besucher**, in der Summen und Listen
fortgeschrieben wurden. Für jedes einzelne Ereignis musste das Skript die
Zeile des Besuchers suchen (`createTextFinder` über die ganze Spalte),
42 Zellen lesen und wieder zurückschreiben. Das wird mit jeder neuen Zeile
langsamer, und Einzelheiten gehen verloren: Reihenfolge, Uhrzeit und
Zusammenhang eines Besuchs lassen sich nicht mehr rekonstruieren.

Jetzt wird nur noch angehängt. Das ist schnell und bleibt es auch, und die
Auswertung kann Fragen beantworten, die vorher nicht beantwortbar waren.

## Reihenfolge beim Umstieg

1. Tabelle öffnen → **Erweiterungen → Apps Script**.
2. Den bisherigen Code in eine Textdatei sichern.
3. Inhalt von `Code.gs` einfügen und speichern.
4. Funktion **`einrichten`** ausführen, Berechtigungen bestätigen.
   Legt `Tracking_Ereignisse` und `Auswertung` an. Fasst nichts Vorhandenes an.
5. Funktion **`altdatenUebernehmen`** ausführen.
   Wandelt das alte `Tracking`-Blatt in Ereignisse um. Ein zweiter Lauf
   wird erkannt und abgebrochen, es entstehen also keine Doppel.
6. **Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) →
   Version: Neue Version → Bereitstellen.**
   Die vorhandene Bereitstellung bearbeiten, nicht eine neue anlegen —
   sonst ändert sich die URL, die in `js/tracking.js` und in beiden
   Formularen steht.

## Was die Übernahme aus einer alten Zeile macht

Aus einem alten Sammeleintrag entstehen die einzelnen Ereignisse zurück:

| Alte Spalte | Wird zu |
|---|---|
| ZeitstempelStart, Gerät, Sprache, Bildschirm, Referrer | ein `page_view` |
| BesuchteSeiten | je weitere Seite ein `page_view` |
| SektionenGesehen | je Abschnitt ein `view_section` |
| DetailsGeöffnet | je Leistung ein `details_open` |
| DauerSekunden | ein `page_leave` mit der Dauer |
| MaxZeitstufe | ein `time_on_page` |
| ZeitÜberblick … ZeitKontakt | je Bereich ein `section_time` |
| KlickPrivat … KlickEmail | je Zähler so viele `click_*` wie gezählt |
| FormularPrivat/Firmen Gesehen … Abbruch | je Zähler ein `form_*` mit `Formular = privat/firmen` |

Ein Besuch mit drei Abschnitten, zwei geöffneten Leistungen und vier
Klicks wird so zu rund 20 Ereigniszeilen.

Übernommene Zeilen tragen in Spalte `Herkunft` den Wert **`Import`**,
laufende Messungen den Wert `Live`. So lassen sie sich jederzeit trennen.

## Zwei ehrliche Einschränkungen bei den Altdaten

1. **Alle Ereignisse eines alten Besuchs bekommen die Startzeit des
   Besuchs.** Genauere Zeiten hat das alte Blatt nie gespeichert. Für
   Tages-, Wochen- und Monatszahlen ist das ohne Bedeutung, die
   Reihenfolge innerhalb eines Besuchs ist aber nur ungefähr.
2. **Besucher und Sitzung sind bei Altdaten dasselbe.** Die alte
   Besuchs-ID lief nach 30 Minuten ab, war also eher eine Sitzung als ein
   Gerät. Für den Zeitraum vor dem Umstieg sind „Besucher" und
   „Sitzungen" daher gleich groß. Ab dem Umstieg werden beide getrennt
   gezählt, wiederkehrende Besucher sind dann erkennbar.

Betriebssystem, Browser und Kampagne bleiben bei Altdaten leer — diese
Angaben wurden vorher nicht erhoben. Bei der Kampagne wird ersatzweise der
Verweis eingetragen, etwa `referrer=www.google.com`.

## Aufräumen (optional)

Abschnitt 10 der Datenschutzerklärung verspricht, dass Messdaten gelöscht
werden, sobald sie nicht mehr gebraucht werden. Dafür gibt es
`altdatenLoeschen()` mit `CONFIG.aufbewahrungMonate` (Standard 14).

Einrichten unter **Trigger → Trigger hinzufügen**: Funktion
`altdatenLoeschen`, zeitgesteuert, Tagestimer.

## Auswertung neu aufbauen

`auswertungAufbauen()` von Hand ausführen. Das Blatt wird neu geschrieben,
die Daten bleiben unberührt.

Die Auswertung rechnet mit `FILTER` über ganze Spalten. Bis in den Bereich
einiger zehntausend Zeilen bleibt das flüssig; danach hilft der Tagestrigger.

## Spalten in `Tracking_Ereignisse`

| Spalte | Feld | Bedeutung |
|---|---|---|
| A | Zeitstempel | Eingang auf dem Server |
| B | Datum | nur das Datum, Grundlage aller Auswertungen |
| C | Besucher-ID | dauerhaft, erkennt wiederkehrende Geräte |
| D | Sitzungs-ID | ein zusammenhängender Besuch, endet nach 30 Min. Pause |
| E | Besuch-Nr | der wievielte Besuch dieses Geräts |
| F | Reihenfolge | Position des Ereignisses innerhalb der Seite |
| G | Ereignis | `page_view`, `view_section`, `click_phone`, `form_submit` … |
| H | Seite | Startseite, Privatkunden, Firmenkunden, Impressum, Datenschutz |
| I | Pfad | URL-Pfad |
| J | Abschnitt | `leistungen`, `preise`, `kontakt` … |
| K | Ziel | angeklickter Link oder Button |
| L | Wert | je nach Ereignis: Sekundenstufe, Scrollprozent, Linktext |
| M | Sekunden | Verweildauer |
| N | Bereich | navigation, hero, kontakt, footer, inhalt |
| O | Detail | Name der geöffneten Leistung |
| P | Formular | privat oder firmen |
| Q | Letztes Feld | zuletzt bearbeitetes Formularfeld |
| R | Pflichtfelder | z. B. `4/7` |
| S | Gerät | Handy, Tablet, Desktop |
| T | Betriebssystem | Android, iOS, Windows, macOS, Linux |
| U | Browser | Chrome, Safari, Firefox, Edge, Samsung Internet, Opera |
| V | Kampagne | Herkunft, z. B. `source=flyer \| medium=qr` |
| W–AA | Verweis, Sprache, Bildschirm, Titel, Client-Zeit | nur beim `page_view` gefüllt |
| AB | Herkunft | `Live` oder `Import` |
