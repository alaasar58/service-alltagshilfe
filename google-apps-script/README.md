# Google Apps Script – Einrichtung

Das Skript in `Code.gs` nimmt beides entgegen: die Messdaten der Webseite
und die Kontaktanfragen. Es schreibt in drei Blätter:

| Blatt | Inhalt |
|---|---|
| `Tracking` | ein Ereignis pro Zeile, 27 Spalten |
| `Anfragen` | eine Kontaktanfrage pro Zeile, plus Spalte `Status` zum Abhaken |
| `Dashboard` | Auswertung über Formeln, aktualisiert sich von selbst |

## Wichtig vor dem Einbau

Das bisherige Skript las den Datenkörper mit `JSON.parse(e.postData.contents)`
und erwartete Felder wie `visitId` und `action`. Die Webseite sendet aber
`FormData` mit Feldern wie `visitor_id` und `event`, und die Kontaktformulare
gehen an dieselbe URL. Das alte Skript konnte beides nicht verarbeiten und
kannte auch keine E-Mail-Benachrichtigung.

Das neue Skript liest `e.parameter`, trennt Messdaten und Anfragen über
`form_type` und verschickt die Benachrichtigung. Vor dem Umstieg lohnt der
Blick, ob in der Tabelle zuletzt überhaupt neue Zeilen ankamen.

## Einbau

1. Google-Tabelle öffnen → **Erweiterungen → Apps Script**.
2. Den vorhandenen Code sichern (in eine Textdatei kopieren), dann durch
   den Inhalt von `Code.gs` ersetzen.
3. Oben in `CONFIG` bei Bedarf `benachrichtigungAn` auf die gewünschte
   E-Mail-Adresse setzen. Leer lassen heißt: an den Besitzer des Skripts.
4. Speichern, dann einmal die Funktion **`einrichten`** ausführen und die
   Berechtigungen bestätigen.
   Ein altes Blatt namens `Tracking` oder `Anfragen`, dessen Kopfzeile
   nicht zu den neuen Spalten passt, wird dabei automatisch in
   `Archiv Tracking JJJJ-MM-TT` umbenannt. Es geht nichts verloren.
5. **Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) →
   Version: Neue Version → Bereitstellen.**
   Wichtig: die bestehende Bereitstellung bearbeiten, nicht eine neue
   anlegen. Nur so bleibt die URL gleich, die in `js/tracking.js` und in
   den Formularen steht.

## Aufräumen (optional, empfohlen)

Abschnitt 10 der Datenschutzerklärung verspricht, dass Messdaten gelöscht
werden, sobald sie nicht mehr gebraucht werden. Dafür gibt es
`altdatenLoeschen()` mit `CONFIG.aufbewahrungMonate` (Standard: 14 Monate).

Einrichten unter **Trigger → Trigger hinzufügen**:
Funktion `altdatenLoeschen`, zeitgesteuert, Tagestimer.

## Dashboard neu aufbauen

`dashboardAufbauen()` von Hand ausführen. Das Blatt wird komplett neu
geschrieben, die Daten in `Tracking` und `Anfragen` bleiben unberührt.

## Hinweis zur Geschwindigkeit

Das Dashboard rechnet mit `FILTER` über die ganzen Spalten. Bis in den
Bereich von einigen zehntausend Zeilen ist das flüssig. Wird es später
träge, hilft der Tagestrigger aus dem vorigen Abschnitt, weil er die
Tabelle klein hält.

## Spalten im Blatt `Tracking`

| Spalte | Feld | Bedeutung |
|---|---|---|
| A | Zeitstempel | Eingang auf dem Server |
| B | Datum | nur das Datum, Grundlage für alle Auswertungen |
| C | Besucher-ID | dauerhaft, erkennt wiederkehrende Geräte |
| D | Sitzungs-ID | eine Zusammenhängende Besuchsstrecke, endet nach 30 Min. Pause |
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
