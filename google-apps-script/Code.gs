/* =========================================================
   AlltagsHilfe Service – Google Apps Script
   ---------------------------------------------------------
   Nimmt zwei Arten von POST-Anfragen entgegen:

     form_type = "tracking"          -> Blatt "Tracking"
     form_type = "privat" | "firmen" -> Blatt "Anfragen" + E-Mail

   Einmalig nach dem Einfuegen ausfuehren:  einrichten()
   Danach: Bereitstellen -> Neue Bereitstellung -> Web-App
           Ausfuehren als: ich
           Zugriff: Jeder
========================================================= */

var CONFIG = {
  /* Leer lassen = E-Mail geht an den Besitzer des Skripts. */
  benachrichtigungAn: '',

  trackingBlatt: 'Tracking',
  anfragenBlatt: 'Anfragen',
  dashboardBlatt: 'Dashboard',

  /* Tracking-Zeilen, die aelter sind, werden von altdatenLoeschen()
     entfernt. Passt zu Abschnitt 10 der Datenschutzerklaerung. */
  aufbewahrungMonate: 14
};

var TRACKING_SPALTEN = [
  'Zeitstempel', 'Datum', 'Besucher-ID', 'Sitzungs-ID', 'Besuch-Nr', 'Reihenfolge',
  'Ereignis', 'Seite', 'Pfad', 'Abschnitt', 'Ziel', 'Wert', 'Sekunden', 'Bereich',
  'Detail', 'Formular', 'Letztes Feld', 'Pflichtfelder', 'Gerät', 'Betriebssystem',
  'Browser', 'Kampagne', 'Verweis', 'Sprache', 'Bildschirm', 'Titel', 'Client-Zeit'
];

var ANFRAGEN_SPALTEN = [
  'Zeitstempel', 'Art', 'Status', 'Firma', 'Vorname', 'Nachname', 'E-Mail', 'Telefon',
  'Rückruf', 'PLZ', 'Ort', 'Leistung', 'Einsatzart', 'Wunschtermin', 'Gefunden über',
  'Sonstiges', 'Nachricht', 'Datenschutz'
];

/* =========================================================
   EINGANG
========================================================= */

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    if (p.form_type === 'tracking') {
      ereignisSpeichern(p);
    } else if (p.form_type === 'privat' || p.form_type === 'firmen') {
      anfrageSpeichern(p);
    }

    return antwort({ status: 'ok' });
  } catch (fehler) {
    console.error(fehler);
    return antwort({ status: 'error', message: String(fehler) });
  }
}

function doGet() {
  return antwort({ status: 'ok', hinweis: 'Dieser Endpunkt nimmt nur POST entgegen.' });
}

function antwort(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   TRACKING
========================================================= */

function ereignisSpeichern(p) {
  if (!p.event) return;

  var jetzt = new Date();

  var zeile = [
    jetzt,
    nurDatum(jetzt),
    text(p.visitor_id),
    text(p.session_id),
    zahl(p.visit_number),
    zahl(p.sequence),
    text(p.event),
    text(p.source),
    text(p.page),
    text(p.section),
    text(p.target),
    text(p.value),
    zahl(p.duration_seconds),
    text(p.click_area),
    text(p.detail_name),
    text(p.form_kind),
    text(p.last_field),
    text(p.required_filled),
    text(p.device),
    text(p.os),
    text(p.browser),
    text(p.campaign),
    text(p.referrer),
    text(p.language),
    text(p.screen),
    text(p.title),
    text(p.client_time)
  ];

  anhaengen(CONFIG.trackingBlatt, TRACKING_SPALTEN, zeile);
}

/* =========================================================
   ANFRAGEN
========================================================= */

function anfrageSpeichern(p) {
  /* Honigtopf: nur Bots fuellen dieses versteckte Feld aus. */
  if (text(p.website) !== '') return;

  var art = p.form_type === 'firmen' ? 'Firma' : 'Privat';

  var gefunden = text(p.Gefunden);
  var sonstiges = text(p.GefundenSonstiges);

  var zeile = [
    new Date(),
    art,
    'Neu',
    text(p.Firma),
    text(p.Vorname),
    text(p.Nachname),
    text(p['E-Mail']),
    text(p.Telefon),
    text(p.Rueckruf),
    text(p.PLZ),
    text(p.Ort),
    text(p.Leistung),
    text(p.Einsatzart),
    text(p.Wunschtermin),
    gefunden,
    sonstiges,
    text(p.Nachricht),
    text(p.Datenschutz)
  ];

  anhaengen(CONFIG.anfragenBlatt, ANFRAGEN_SPALTEN, zeile);
  anfrageMailen(art, zeile);
}

function anfrageMailen(art, zeile) {
  var empfaenger = CONFIG.benachrichtigungAn || Session.getEffectiveUser().getEmail();
  if (!empfaenger) return;

  var name = [zeile[4], zeile[5]].join(' ').trim();
  var ort = [zeile[9], zeile[10]].join(' ').trim();

  var betreff = 'Neue Anfrage (' + art + ')'
    + (name ? ' – ' + name : '')
    + (ort ? ', ' + ort : '');

  var zeilen = [];
  for (var i = 1; i < ANFRAGEN_SPALTEN.length; i++) {
    if (ANFRAGEN_SPALTEN[i] === 'Status') continue;
    if (String(zeile[i] || '') === '') continue;
    zeilen.push(ANFRAGEN_SPALTEN[i] + ': ' + zeile[i]);
  }

  zeilen.push('');
  zeilen.push('Eingegangen: ' + Utilities.formatDate(zeile[0], 'Europe/Berlin', 'dd.MM.yyyy HH:mm'));

  try {
    MailApp.sendEmail(empfaenger, betreff, zeilen.join('\n'));
  } catch (fehler) {
    console.error('E-Mail fehlgeschlagen: ' + fehler);
  }
}

/* =========================================================
   BLATT-HILFEN
========================================================= */

function anhaengen(blattName, spalten, zeile) {
  var sperre = LockService.getScriptLock();

  try {
    sperre.waitLock(15000);
  } catch (fehler) {
    return;
  }

  try {
    var blatt = blattHolen(blattName, spalten);
    blatt.appendRow(zeile);
  } finally {
    sperre.releaseLock();
  }
}

function blattHolen(name, spalten) {
  var datei = SpreadsheetApp.getActiveSpreadsheet();
  var blatt = datei.getSheetByName(name);

  if (!blatt) {
    blatt = datei.insertSheet(name);
  }

  if (blatt.getLastRow() === 0) {
    blatt.getRange(1, 1, 1, spalten.length).setValues([spalten]);
    blatt.getRange(1, 1, 1, spalten.length)
      .setFontWeight('bold')
      .setBackground('#0e4e2d')
      .setFontColor('#ffffff');
    blatt.setFrozenRows(1);
    blatt.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm:ss');

    if (name === CONFIG.trackingBlatt) {
      blatt.getRange('B:B').setNumberFormat('dd.MM.yyyy');
    }
  }

  return blatt;
}

function nurDatum(zeitpunkt) {
  return new Date(zeitpunkt.getFullYear(), zeitpunkt.getMonth(), zeitpunkt.getDate());
}

function text(wert) {
  return String(wert === 0 ? '0' : (wert || '')).trim();
}

function zahl(wert) {
  var n = Number(wert);
  return isNaN(n) || text(wert) === '' ? '' : n;
}

/* =========================================================
   EINRICHTUNG
   Einmal von Hand ausfuehren. Legt die drei Blaetter an und
   laesst vorhandene Blaetter unberuehrt.
========================================================= */

function einrichten() {
  var archiviert = [];

  [[CONFIG.trackingBlatt, TRACKING_SPALTEN], [CONFIG.anfragenBlatt, ANFRAGEN_SPALTEN]]
    .forEach(function (eintrag) {
      var name = altesBlattArchivieren(eintrag[0], eintrag[1]);
      if (name) archiviert.push(name);
    });

  blattHolen(CONFIG.trackingBlatt, TRACKING_SPALTEN);
  blattHolen(CONFIG.anfragenBlatt, ANFRAGEN_SPALTEN);
  dashboardAufbauen();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    archiviert.length
      ? 'Fertig. Alte Daten liegen jetzt in: ' + archiviert.join(', ')
      : 'Blätter "' + CONFIG.trackingBlatt + '", "' + CONFIG.anfragenBlatt +
        '" und "' + CONFIG.dashboardBlatt + '" sind bereit.',
    'Einrichtung fertig',
    10
  );
}

/* Ein vorhandenes Blatt gleichen Namens, dessen Kopfzeile nicht zu den
   neuen Spalten passt, wird umbenannt statt ueberschrieben. Die alten
   Daten bleiben damit als Archiv erhalten. */
function altesBlattArchivieren(name, spalten) {
  var blatt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!blatt || blatt.getLastRow() === 0) return null;

  var breite = Math.min(Math.max(blatt.getLastColumn(), spalten.length), blatt.getMaxColumns());
  var kopf = blatt.getRange(1, 1, 1, breite).getValues()[0];

  var passt = spalten.every(function (titel, i) {
    return String(kopf[i] || '').trim() === titel;
  });

  if (passt) return null;

  var neuerName = 'Archiv ' + name + ' ' +
    Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');

  blatt.setName(neuerName);
  return neuerName;
}

/* =========================================================
   AUFBEWAHRUNG
   Loescht Tracking-Zeilen, die aelter als CONFIG.aufbewahrungMonate
   sind. Am besten mit einem taeglichen Zeit-Trigger verbinden.
========================================================= */

function altdatenLoeschen() {
  var blatt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.trackingBlatt);
  if (!blatt || blatt.getLastRow() < 2) return;

  var grenze = new Date();
  grenze.setMonth(grenze.getMonth() - CONFIG.aufbewahrungMonate);

  var daten = blatt.getRange(2, 1, blatt.getLastRow() - 1, 1).getValues();
  var zuLoeschen = 0;

  /* Die Zeilen stehen chronologisch, daher reicht das Zaehlen von oben. */
  for (var i = 0; i < daten.length; i++) {
    var zeitpunkt = daten[i][0];
    if (!(zeitpunkt instanceof Date) || zeitpunkt >= grenze) break;
    zuLoeschen++;
  }

  if (zuLoeschen > 0) {
    blatt.deleteRows(2, zuLoeschen);
    console.log(zuLoeschen + ' alte Tracking-Zeilen gelöscht.');
  }
}

/* =========================================================
   DASHBOARD
   Alles ueber Formeln, damit die Zahlen live bleiben und
   das Skript nicht regelmaessig laufen muss.
========================================================= */

function dashboardAufbauen() {
  var datei = SpreadsheetApp.getActiveSpreadsheet();
  var blatt = datei.getSheetByName(CONFIG.dashboardBlatt);

  if (blatt) {
    blatt.getRange(1, 1, blatt.getMaxRows(), blatt.getMaxColumns()).breakApart();
    blatt.clear();
    blatt.getCharts().forEach(function (diagramm) {
      blatt.removeChart(diagramm);
    });
  } else {
    blatt = datei.insertSheet(CONFIG.dashboardBlatt, 0);
  }

  var T = "'" + CONFIG.trackingBlatt + "'";

  /* Hilfsformeln --------------------------------------- */

  function besucher(bedingung) {
    return '=IFERROR(COUNTUNIQUE(FILTER(' + T + '!$C$2:$C,' + bedingung + ',' + T + '!$C$2:$C<>"")),0)';
  }

  function sitzungen(bedingung) {
    return '=IFERROR(COUNTUNIQUE(FILTER(' + T + '!$D$2:$D,' + bedingung + ',' + T + '!$D$2:$D<>"")),0)';
  }

  function ereignisse(bedingung, ereignis) {
    return '=IFERROR(COUNTA(FILTER(' + T + '!$G$2:$G,' + bedingung + ',' + T + '!$G$2:$G="' + ereignis + '")),0)';
  }

  var HEUTE = T + '!$B$2:$B=TODAY()';
  var GESTERN = T + '!$B$2:$B=TODAY()-1';
  var WOCHE = T + '!$B$2:$B>=TODAY()-WEEKDAY(TODAY(),3)';
  var MONAT = T + '!$B$2:$B>=EOMONTH(TODAY(),-1)+1';
  var TAGE30 = T + '!$B$2:$B>=TODAY()-29';

  var zeitraeume = [
    ['Heute', HEUTE],
    ['Gestern', GESTERN],
    ['Diese Woche', WOCHE],
    ['Dieser Monat', MONAT],
    ['Letzte 30 Tage', TAGE30]
  ];

  /* Kopf ------------------------------------------------ */

  blatt.getRange('A1').setValue('AlltagsHilfe Service – Überblick');
  blatt.getRange('A1:G1').merge()
    .setFontSize(16).setFontWeight('bold')
    .setBackground('#0e4e2d').setFontColor('#ffffff')
    .setVerticalAlignment('middle');
  blatt.setRowHeight(1, 42);

  blatt.getRange('A2').setFormula(
    '="Stand: "&TEXT(NOW(),"dd.MM.yyyy HH:mm")&"  ·  Zahlen aktualisieren sich automatisch"'
  );
  blatt.getRange('A2:G2').merge().setFontColor('#6b7280');

  /* Kennzahlen ------------------------------------------ */

  var kopf = ['Zeitraum', 'Besucher', 'Sitzungen', 'Seitenaufrufe', 'Anfragen', 'Kontaktklicks', 'Anfragen je 100 Besucher'];
  blatt.getRange(4, 1, 1, kopf.length).setValues([kopf])
    .setFontWeight('bold').setBackground('#eef4ec');

  zeitraeume.forEach(function (eintrag, index) {
    var reihe = 5 + index;
    var bedingung = eintrag[1];

    blatt.getRange(reihe, 1).setValue(eintrag[0]);
    blatt.getRange(reihe, 2).setFormula(besucher(bedingung));
    blatt.getRange(reihe, 3).setFormula(sitzungen(bedingung));
    blatt.getRange(reihe, 4).setFormula(ereignisse(bedingung, 'page_view'));
    blatt.getRange(reihe, 5).setFormula(ereignisse(bedingung, 'form_submit'));
    blatt.getRange(reihe, 6).setFormula(
      '=IFERROR(COUNTA(FILTER(' + T + '!$G$2:$G,' + bedingung + ',REGEXMATCH(' + T + '!$G$2:$G,"^click_(phone|whatsapp|email)$"))),0)'
    );
    blatt.getRange(reihe, 7).setFormula('=IF(B' + reihe + '=0,0,ROUND(E' + reihe + '/B' + reihe + '*100,1))');
  });

  blatt.getRange(5, 1, zeitraeume.length, 1).setFontWeight('bold');
  blatt.getRange(9, 1, 1, kopf.length).setBorder(true, null, null, null, null, null);

  /* Verlauf der letzten 30 Tage ------------------------- */

  blatt.getRange('A11').setValue('Verlauf – letzte 30 Tage').setFontWeight('bold').setFontSize(12);

  var verlaufKopf = ['Datum', 'Besucher', 'Sitzungen', 'Seitenaufrufe', 'Anfragen'];
  blatt.getRange(12, 1, 1, verlaufKopf.length).setValues([verlaufKopf])
    .setFontWeight('bold').setBackground('#eef4ec');

  blatt.getRange('A13').setFormula('=SEQUENCE(30,1,TODAY()-29,1)');
  blatt.getRange('A13:A42').setNumberFormat('ddd, dd.MM.yyyy');

  for (var t = 0; t < 30; t++) {
    var zeile = 13 + t;
    var tagesBedingung = T + '!$B$2:$B=$A' + zeile;

    blatt.getRange(zeile, 2).setFormula(besucher(tagesBedingung));
    blatt.getRange(zeile, 3).setFormula(sitzungen(tagesBedingung));
    blatt.getRange(zeile, 4).setFormula(ereignisse(tagesBedingung, 'page_view'));
    blatt.getRange(zeile, 5).setFormula(ereignisse(tagesBedingung, 'form_submit'));
  }

  blatt.getRange('G12').setValue('Trend Besucher').setFontWeight('bold');
  blatt.getRange('G13').setFormula('=SPARKLINE(B13:B42,{"charttype","column";"color","#0e4e2d"})');
  blatt.getRange('G13:G16').merge();

  /* Wochen und Monate ----------------------------------- */

  blatt.getRange('A45').setValue('Letzte 12 Wochen').setFontWeight('bold').setFontSize(12);
  blatt.getRange(46, 1, 1, 4).setValues([['Woche ab', 'Besucher', 'Sitzungen', 'Anfragen']])
    .setFontWeight('bold').setBackground('#eef4ec');
  blatt.getRange('A47').setFormula('=SEQUENCE(12,1,TODAY()-WEEKDAY(TODAY(),3)-77,7)');
  blatt.getRange('A47:A58').setNumberFormat('dd.MM.yyyy');

  for (var w = 0; w < 12; w++) {
    var wZeile = 47 + w;
    var wBedingung = T + '!$B$2:$B>=$A' + wZeile + ',' + T + '!$B$2:$B<$A' + wZeile + '+7';

    blatt.getRange(wZeile, 2).setFormula(besucher(wBedingung));
    blatt.getRange(wZeile, 3).setFormula(sitzungen(wBedingung));
    blatt.getRange(wZeile, 4).setFormula(ereignisse(wBedingung, 'form_submit'));
  }

  blatt.getRange('F45').setValue('Letzte 12 Monate').setFontWeight('bold').setFontSize(12);
  blatt.getRange(46, 6, 1, 4).setValues([['Monat', 'Besucher', 'Sitzungen', 'Anfragen']])
    .setFontWeight('bold').setBackground('#eef4ec');
  blatt.getRange('F47:F58').setNumberFormat('MMMM yyyy');

  for (var m = 0; m < 12; m++) {
    var mZeile = 47 + m;
    blatt.getRange(mZeile, 6).setFormula('=EOMONTH(TODAY(),' + (m - 12) + ')+1');

    var mBedingung = T + '!$B$2:$B>=$F' + mZeile + ',' + T + '!$B$2:$B<=EOMONTH($F' + mZeile + ',0)';

    blatt.getRange(mZeile, 7).setFormula(besucher(mBedingung));
    blatt.getRange(mZeile, 8).setFormula(sitzungen(mBedingung));
    blatt.getRange(mZeile, 9).setFormula(ereignisse(mBedingung, 'form_submit'));
  }

  /* Auswertungen ---------------------------------------- */

  function abfrage(zelle, titel, auswahl) {
    blatt.getRange(zelle).setValue(titel).setFontWeight('bold').setFontSize(12);

    var ziel = blatt.getRange(zelle).offset(1, 0).getA1Notation();
    blatt.getRange(ziel).setFormula(
      '=IFERROR(QUERY(' + T + '!$A$2:$AA,"' + auswahl + '",0),"noch keine Daten")'
    );
  }

  abfrage('A61', 'Woher kommen die Besucher',
    "select V, count(A) where G = 'page_view' and V is not null group by V order by count(A) desc limit 10 label V 'Kampagne / Herkunft', count(A) 'Aufrufe'");

  abfrage('D61', 'Geräte und Systeme',
    "select S, T, count(A) where G = 'page_view' group by S, T order by count(A) desc label S 'Gerät', T 'System', count(A) 'Aufrufe'");

  abfrage('K61', 'Browser',
    "select U, count(A) where G = 'page_view' and U is not null group by U order by count(A) desc label U 'Browser', count(A) 'Aufrufe'");

  abfrage('G61', 'Meistbesuchte Seiten',
    "select H, count(A) where G = 'page_view' group by H order by count(A) desc label H 'Seite', count(A) 'Aufrufe'");

  abfrage('A76', 'Meistgelesene Abschnitte',
    "select J, count(A) where G = 'view_section' group by J order by count(A) desc limit 12 label J 'Abschnitt', count(A) 'Aufrufe'");

  abfrage('D76', 'Gefragteste Leistungen',
    "select O, count(A) where G = 'details_open' group by O order by count(A) desc limit 12 label O 'Leistung', count(A) 'Geöffnet'");

  abfrage('G76', 'Kontaktwege',
    "select G, count(A) where G starts with 'click_' group by G order by count(A) desc limit 12 label G 'Klickart', count(A) 'Klicks'");

  /* Formular-Trichter ----------------------------------- */

  blatt.getRange('A93').setValue('Kontaktformular – wo bricht es ab').setFontWeight('bold').setFontSize(12);
  blatt.getRange(94, 1, 1, 3).setValues([['Schritt', 'Anzahl', 'Anteil vom Vorschritt']])
    .setFontWeight('bold').setBackground('#eef4ec');

  var trichter = [
    ['Formular gesehen', 'form_view'],
    ['Ausfüllen begonnen', 'form_start'],
    ['Fehler beim Absenden', 'form_error'],
    ['Abgebrochen', 'form_abandon'],
    ['Abgeschickt', 'form_submit']
  ];

  trichter.forEach(function (schritt, index) {
    var zeile = 95 + index;
    blatt.getRange(zeile, 1).setValue(schritt[0]);
    blatt.getRange(zeile, 2).setFormula('=COUNTIF(' + T + '!$G$2:$G,"' + schritt[1] + '")');
    blatt.getRange(zeile, 3).setFormula(
      index === 0 ? '=""' : '=IF(B' + (zeile - 1) + '=0,"",TEXT(B' + zeile + '/B' + (zeile - 1) + ',"0%"))'
    );
  });

  blatt.getRange('E93').setValue('Letztes Feld vor dem Abbruch').setFontWeight('bold').setFontSize(12);
  blatt.getRange('E94').setFormula(
    '=IFERROR(QUERY(' + T + '!$A$2:$AA,"select Q, count(A) where G = \'form_abandon\' and Q is not null group by Q order by count(A) desc limit 10 label Q \'Feld\', count(A) \'Abbrüche\'",0),"noch keine Daten")'
  );

  /* Herkunft der echten Anfragen ------------------------ */

  var A = "'" + CONFIG.anfragenBlatt + "'";

  blatt.getRange('A108').setValue('Anfragen nach Ort').setFontWeight('bold').setFontSize(12);
  blatt.getRange('A109').setFormula(
    '=IFERROR(QUERY(' + A + '!$A$2:$R,"select K, count(A) where K is not null and K <> \'\' ' +
    'group by K order by count(A) desc limit 15 label K \'Ort\', count(A) \'Anfragen\'",0),"noch keine Anfragen")'
  );

  blatt.getRange('D108').setValue('Anfragen nach PLZ').setFontWeight('bold').setFontSize(12);
  blatt.getRange('D109').setFormula(
    '=IFERROR(QUERY(' + A + '!$A$2:$R,"select J, count(A) where J is not null and J <> \'\' ' +
    'group by J order by count(A) desc limit 15 label J \'PLZ\', count(A) \'Anfragen\'",0),"noch keine Anfragen")'
  );

  blatt.getRange('G108').setValue('Privat oder Firma').setFontWeight('bold').setFontSize(12);
  blatt.getRange('G109').setFormula(
    '=IFERROR(QUERY(' + A + '!$A$2:$R,"select B, count(A) where B is not null ' +
    'group by B order by count(A) desc label B \'Art\', count(A) \'Anfragen\'",0),"noch keine Anfragen")'
  );

  /* Optik ----------------------------------------------- */

  blatt.setColumnWidth(1, 200);
  for (var s = 2; s <= 9; s++) {
    blatt.setColumnWidth(s, 130);
  }
  blatt.setHiddenGridlines(true);

  return blatt;
}
