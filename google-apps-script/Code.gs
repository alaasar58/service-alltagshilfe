/* =========================================================
   AlltagsHilfe Service – Google Apps Script
   ---------------------------------------------------------
   Die Verarbeitung der Kontaktformulare ist unveraendert
   uebernommen: gleiche Blaetter, gleiche Anfrage-IDs, gleicher
   E-Mail-Text. Neu ist nur die Messung.

   Blaetter:
     Privatkunden          wie bisher
     Firmenkunden          wie bisher
     Tracking              ALT, wird eingefroren und nur noch gelesen
     Dashboard             ALT, bleibt als Archiv stehen
     Dashboard_Daten       ALT, bleibt als Archiv stehen
     Tracking_Ereignisse   NEU, eine Zeile pro Ereignis
     Auswertung            NEU, Kennzahlen und Tabellen

   Reihenfolge beim Umstieg:
     1. einrichten()
     2. altdatenUebernehmen()     einmalig, holt das alte Tracking rein
     3. Bereitstellung aktualisieren
========================================================= */

var CONFIG = {
  recipientEmail: 'Alaasarhan@web.de',
  spreadsheetId: '1-dvKngPGE0_RYitwQUz69yCT9F7tbnpdkbiludX04RU',

  privateSheetName: 'Privatkunden',
  businessSheetName: 'Firmenkunden',

  /* Das alte Tracking-Blatt. Es wird nicht mehr beschrieben, nur
     einmalig fuer die Uebernahme gelesen. */
  altesTrackingBlatt: 'Tracking',

  ereignisBlatt: 'Tracking_Ereignisse',
  auswertungBlatt: 'Auswertung',

  /* Ereigniszeilen, die aelter sind, entfernt altdatenLoeschen(). */
  aufbewahrungMonate: 14
};

var ALTE_TRACKING_SPALTEN = 42;

var EREIGNIS_SPALTEN = [
  'Zeitstempel', 'Datum', 'Besucher-ID', 'Sitzungs-ID', 'Besuch-Nr', 'Reihenfolge',
  'Ereignis', 'Seite', 'Pfad', 'Abschnitt', 'Ziel', 'Wert', 'Sekunden', 'Bereich',
  'Detail', 'Formular', 'Letztes Feld', 'Pflichtfelder', 'Gerät', 'Betriebssystem',
  'Browser', 'Kampagne', 'Verweis', 'Sprache', 'Bildschirm', 'Titel', 'Client-Zeit',
  'Herkunft'
];

/* =========================================================
   HAUPTEINGANG
========================================================= */

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return jsonResponse(false, 'Keine Daten empfangen.');
    }

    var data = e.parameter;

    /* Honeypot gegen einfache Bots */
    if (data.website && data.website.trim() !== '') {
      return jsonResponse(true, 'OK');
    }

    var formType = sanitize(data.form_type || '');

    if (formType === 'privat') return handlePrivateRequest(data);
    if (formType === 'firmen') return handleBusinessRequest(data);
    if (formType === 'tracking') return ereignisSpeichern(data);

    return jsonResponse(false, 'Unbekannter Formulartyp.');
  } catch (error) {
    return jsonResponse(false, 'Fehler: ' + error.message);
  }
}

/* =========================================================
   PRIVATKUNDEN – unveraendert
========================================================= */

function handlePrivateRequest(data) {
  var sheet = SpreadsheetApp
    .openById(CONFIG.spreadsheetId)
    .getSheetByName(CONFIG.privateSheetName);

  if (!sheet) {
    return jsonResponse(false, 'Tabellenblatt Privatkunden wurde nicht gefunden.');
  }

  var timestamp = new Date();
  var requestId = createRequestId('P', sheet);
  var status = 'Neu';

  var vorname = sanitize(data.Vorname);
  var nachname = sanitize(data.Nachname);
  var telefon = sanitize(data.Telefon);
  var rueckruf = sanitize(data.Rueckruf);
  var email = sanitize(data['E-Mail']);
  var plz = sanitize(data.PLZ);
  var ort = sanitize(data.Ort);
  var leistung = sanitize(data.Leistung);
  var wunschtermin = sanitize(data.Wunschtermin);

  var gefunden = sanitize(
    data.Gefunden === 'Sonstiges' && data.GefundenSonstiges
      ? 'Sonstiges: ' + data.GefundenSonstiges
      : data.Gefunden
  );

  var nachricht = sanitize(data.Nachricht);
  var datenschutz = sanitize(data.Datenschutz);
  var quelle = 'Website Privatkunden';

  if (!nachname || !email || !plz || !ort || !leistung || !nachricht || !datenschutz) {
    return jsonResponse(false, 'Pflichtfelder fehlen.');
  }

  if (rueckruf === 'Ja' && !telefon) {
    return jsonResponse(false, 'Telefonnummer fehlt für den gewünschten Rückruf.');
  }

  sheet.appendRow([
    timestamp, requestId, status, vorname, nachname, telefon, rueckruf, email,
    plz, ort, leistung, wunschtermin, gefunden, nachricht, datenschutz, quelle
  ]);

  var subject = 'Neue Privatkunden-Anfrage | ' + requestId;

  var body =
    'Neue Anfrage über die Website\n\n' +
    'Anfrage-ID: ' + requestId + '\n' +
    'Bereich: Privatkunden\n' +
    'Status: ' + status + '\n\n' +
    'Vorname: ' + vorname + '\n' +
    'Nachname: ' + nachname + '\n' +
    'Telefon: ' + telefon + '\n' +
    'Rückruf gewünscht: ' + rueckruf + '\n' +
    'E-Mail: ' + email + '\n' +
    'PLZ: ' + plz + '\n' +
    'Ort: ' + ort + '\n' +
    'Leistung: ' + leistung + '\n' +
    'Wunschtermin: ' + wunschtermin + '\n' +
    'Wie gefunden: ' + gefunden + '\n\n' +
    'Nachricht:\n' + nachricht + '\n\n' +
    'Datenschutz: ' + datenschutz + '\n' +
    'Quelle: ' + quelle + '\n\n' +
    'Google Sheet wurde automatisch aktualisiert.';

  MailApp.sendEmail({
    to: CONFIG.recipientEmail,
    subject: subject,
    body: body,
    name: 'AlltagsHilfe Service Website',
    replyTo: email
  });

  return jsonResponse(true, 'Anfrage erfolgreich gesendet.');
}

/* =========================================================
   FIRMENKUNDEN – unveraendert
========================================================= */

function handleBusinessRequest(data) {
  var sheet = SpreadsheetApp
    .openById(CONFIG.spreadsheetId)
    .getSheetByName(CONFIG.businessSheetName);

  if (!sheet) {
    return jsonResponse(false, 'Tabellenblatt Firmenkunden wurde nicht gefunden.');
  }

  var timestamp = new Date();
  var requestId = createRequestId('F', sheet);
  var status = 'Neu';

  var firma = sanitize(data.Firma);
  var vorname = sanitize(data.Vorname);
  var nachname = sanitize(data.Nachname);
  var telefon = sanitize(data.Telefon);
  var rueckruf = sanitize(data.Rueckruf);
  var email = sanitize(data['E-Mail']);
  var plz = sanitize(data.PLZ);
  var ort = sanitize(data.Ort);
  var bereich = sanitize(data.Leistung);
  var einsatzart = sanitize(data.Einsatzart);
  var wunschtermin = sanitize(data.Wunschtermin);

  var gefunden = sanitize(
    data.Gefunden === 'Sonstiges' && data.GefundenSonstiges
      ? 'Sonstiges: ' + data.GefundenSonstiges
      : data.Gefunden
  );

  var nachricht = sanitize(data.Nachricht);
  var datenschutz = sanitize(data.Datenschutz);
  var quelle = 'Website Firmenkunden';

  if (!firma || !nachname || !email || !plz || !ort || !bereich || !nachricht || !datenschutz) {
    return jsonResponse(false, 'Pflichtfelder fehlen.');
  }

  if (rueckruf === 'Ja' && !telefon) {
    return jsonResponse(false, 'Telefonnummer fehlt für den gewünschten Rückruf.');
  }

  sheet.appendRow([
    timestamp, requestId, status, firma, vorname, nachname, telefon, rueckruf,
    email, plz, ort, bereich, einsatzart, wunschtermin, gefunden, nachricht,
    datenschutz, quelle
  ]);

  var subject = 'Neue Firmenanfrage | ' + requestId;

  var body =
    'Neue Anfrage über die Website\n\n' +
    'Anfrage-ID: ' + requestId + '\n' +
    'Bereich: Firmenkunden\n' +
    'Status: ' + status + '\n\n' +
    'Firma: ' + firma + '\n' +
    'Vorname: ' + vorname + '\n' +
    'Nachname: ' + nachname + '\n' +
    'Telefon: ' + telefon + '\n' +
    'Rückruf gewünscht: ' + rueckruf + '\n' +
    'E-Mail: ' + email + '\n' +
    'PLZ: ' + plz + '\n' +
    'Ort: ' + ort + '\n' +
    'Gewünschter Bereich: ' + bereich + '\n' +
    'Einsatzart: ' + einsatzart + '\n' +
    'Wunschtermin: ' + wunschtermin + '\n' +
    'Wie gefunden: ' + gefunden + '\n\n' +
    'Nachricht:\n' + nachricht + '\n\n' +
    'Datenschutz: ' + datenschutz + '\n' +
    'Quelle: ' + quelle + '\n\n' +
    'Google Sheet wurde automatisch aktualisiert.';

  MailApp.sendEmail({
    to: CONFIG.recipientEmail,
    subject: subject,
    body: body,
    name: 'AlltagsHilfe Service Website',
    replyTo: email
  });

  return jsonResponse(true, 'Anfrage erfolgreich gesendet.');
}

/* =========================================================
   MESSUNG – eine Zeile pro Ereignis
   Das alte Verfahren suchte fuer jedes Ereignis die Zeile des
   Besuchers, las 42 Zellen und schrieb sie zurueck. Das wurde
   mit jeder Zeile langsamer. Jetzt wird nur angehaengt.
========================================================= */

function ereignisSpeichern(data) {
  var visitorId = sanitize(data.visitor_id);
  var eventName = sanitize(data.event);

  if (!visitorId || !eventName) {
    return jsonResponse(false, 'Tracking-Daten unvollständig.');
  }

  var jetzt = new Date();

  var zeile = [
    jetzt,
    nurDatum(jetzt),
    visitorId,
    sanitize(data.session_id),
    numberOrEmpty(data.visit_number),
    numberOrEmpty(data.sequence),
    eventName,
    sanitize(data.source),
    sanitize(data.page),
    sanitize(data.section),
    sanitize(data.target),
    sanitize(data.value),
    numberOrEmpty(data.duration_seconds),
    sanitize(data.click_area),
    sanitize(data.detail_name),
    sanitize(data.form_kind),
    sanitize(data.last_field),
    sanitize(data.required_filled),
    sanitize(data.device),
    sanitize(data.os),
    sanitize(data.browser),
    sanitize(data.campaign),
    sanitize(data.referrer),
    sanitize(data.language),
    sanitize(data.screen),
    sanitize(data.title),
    sanitize(data.client_time),
    'Live'
  ];

  var sperre = LockService.getScriptLock();

  try {
    sperre.waitLock(15000);
  } catch (fehler) {
    return jsonResponse(false, 'Tabelle war belegt.');
  }

  try {
    blattHolen(CONFIG.ereignisBlatt, EREIGNIS_SPALTEN).appendRow(zeile);
    return jsonResponse(true, 'Tracking gespeichert.');
  } finally {
    sperre.releaseLock();
  }
}

/* =========================================================
   UEBERNAHME DER ALTDATEN
   Das alte Blatt hielt eine Zeile je Besucher mit Summen und
   Listen. Daraus werden hier einzelne Ereignisse gebaut, damit
   die bisherigen Zahlen in der neuen Auswertung mitzaehlen.

   Einmalig ausfuehren. Ein zweiter Lauf wird erkannt und
   abgebrochen, es entstehen also keine Doppel.
========================================================= */

function altdatenUebernehmen() {
  var datei = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var altesBlatt = datei.getSheetByName(CONFIG.altesTrackingBlatt);

  if (!altesBlatt || altesBlatt.getLastRow() < 2) {
    return meldung('Kein altes Tracking-Blatt mit Daten gefunden.');
  }

  var ziel = blattHolen(CONFIG.ereignisBlatt, EREIGNIS_SPALTEN);

  if (bereitsUebernommen(ziel)) {
    return meldung('Die Altdaten wurden bereits übernommen. Kein zweiter Lauf nötig.');
  }

  var breite = Math.min(ALTE_TRACKING_SPALTEN, altesBlatt.getLastColumn());
  var alteZeilen = altesBlatt.getRange(2, 1, altesBlatt.getLastRow() - 1, breite).getValues();

  var neueZeilen = [];

  alteZeilen.forEach(function (alt) {
    neueZeilen = neueZeilen.concat(zeileUmwandeln(alt));
  });

  if (!neueZeilen.length) {
    return meldung('Im alten Blatt standen keine verwertbaren Zeilen.');
  }

  /* In Bloecken schreiben, das ist deutlich schneller als appendRow. */
  var block = 500;

  for (var start = 0; start < neueZeilen.length; start += block) {
    var teil = neueZeilen.slice(start, start + block);
    ziel.getRange(ziel.getLastRow() + 1, 1, teil.length, EREIGNIS_SPALTEN.length).setValues(teil);
    SpreadsheetApp.flush();
  }

  ziel.sort(1);

  return meldung(
    alteZeilen.length + ' alte Besuche übernommen, daraus wurden ' +
    neueZeilen.length + ' Ereignisse. Das Blatt "' + CONFIG.altesTrackingBlatt +
    '" bleibt unverändert als Archiv erhalten.'
  );
}

function bereitsUebernommen(blatt) {
  if (blatt.getLastRow() < 2) return false;

  var spalte = EREIGNIS_SPALTEN.indexOf('Herkunft') + 1;
  var werte = blatt.getRange(2, spalte, blatt.getLastRow() - 1, 1).getValues();

  return werte.some(function (zelle) {
    return String(zelle[0]).trim() === 'Import';
  });
}

/* Baut aus einer alten Sammelzeile die einzelnen Ereignisse. */
function zeileUmwandeln(alt) {
  var start = alt[0] instanceof Date ? alt[0] : new Date(alt[0]);
  if (isNaN(start.getTime())) return [];

  var besucher = sanitize(alt[2]);
  if (!besucher) return [];

  var geraet = sanitize(alt[3]);
  var sprache = sanitize(alt[4]);
  var bildschirm = sanitize(alt[5]);
  var verweis = sanitize(alt[6]);
  var einstieg = sanitize(alt[7]);
  var quelle = sanitize(alt[41]) || seiteAusPfad(einstieg);
  var dauer = numberValue(alt[12]);

  var zeilen = [];
  var lauf = { wert: 0 };

  function ereignis(name, felder) {
    lauf.wert = lauf.wert + 1;
    felder = felder || {};

    var istSeitenaufruf = name === 'page_view';

    zeilen.push([
      start,
      nurDatum(start),
      besucher,
      /* Die alte Besuchs-ID lief nach 30 Minuten ab, entsprach also
         einer Sitzung. Sie dient hier fuer beides. */
      besucher,
      1,
      lauf.wert,
      name,
      quelle,
      felder.pfad || einstieg,
      felder.abschnitt || '',
      felder.ziel || '',
      felder.wert || '',
      felder.sekunden === undefined ? '' : felder.sekunden,
      felder.bereich || '',
      felder.detail || '',
      felder.formular || '',
      felder.letztesFeld || '',
      felder.pflichtfelder || '',
      geraet,
      '',
      '',
      istSeitenaufruf ? kampagneAusVerweis(verweis) : '',
      istSeitenaufruf ? verweis : '',
      istSeitenaufruf ? sprache : '',
      istSeitenaufruf ? bildschirm : '',
      '',
      '',
      'Import'
    ]);
  }

  /* 1. Der Besuch selbst */
  ereignis('page_view', { wert: 'Import' });

  /* 2. Weitere aufgerufene Seiten */
  liste(alt[9]).forEach(function (pfad) {
    if (pfad && pfad !== einstieg) {
      ereignis('page_view', { pfad: pfad, wert: 'Import' });
    }
  });

  /* 3. Gesehene Abschnitte */
  liste(alt[10]).forEach(function (abschnitt) {
    ereignis('view_section', { abschnitt: abschnitt, pfad: einstieg });
  });

  /* 4. Geoeffnete Leistungen */
  liste(alt[11]).forEach(function (detail) {
    ereignis('details_open', { ziel: detail, detail: detail, bereich: 'inhalt' });
  });

  /* 5. Verweildauer */
  if (dauer > 0) {
    ereignis('page_leave', { sekunden: dauer });
  }

  var stufe = sanitize(alt[13]).replace('s', '');
  if (stufe) {
    ereignis('time_on_page', { wert: stufe, sekunden: numberValue(stufe) });
  }

  /* 6. Zeit je Bereich */
  [
    [14, 'ueberblick'],
    [15, 'leistungen'],
    [16, 'preise'],
    [17, 'einsatzgebiet'],
    [18, 'kontakt']
  ].forEach(function (eintrag) {
    var sekunden = numberValue(alt[eintrag[0]]);
    if (sekunden <= 0) return;

    ereignis('section_time', {
      abschnitt: eintrag[1],
      wert: String(sekunden),
      sekunden: sekunden
    });
  });

  /* 7. Klicks */
  [
    [19, 'click_privat'],
    [20, 'click_firmen'],
    [21, 'click_whatsapp'],
    [22, 'click_phone'],
    [23, 'click_email']
  ].forEach(function (eintrag) {
    var anzahl = numberValue(alt[eintrag[0]]);

    for (var i = 0; i < anzahl; i++) {
      ereignis(eintrag[1], { bereich: 'kontakt' });
    }
  });

  /* 8. Formular */
  [
    [29, 'form_view', 'privat'],
    [30, 'form_start', 'privat'],
    [31, 'form_submit', 'privat'],
    [32, 'form_abandon', 'privat'],
    [33, 'form_view', 'firmen'],
    [34, 'form_start', 'firmen'],
    [35, 'form_submit', 'firmen'],
    [36, 'form_abandon', 'firmen']
  ].forEach(function (eintrag) {
    var anzahl = numberValue(alt[eintrag[0]]);

    for (var i = 0; i < anzahl; i++) {
      ereignis(eintrag[1], {
        formular: eintrag[2],
        bereich: 'kontakt',
        letztesFeld: sanitize(alt[37]),
        pflichtfelder: sanitize(alt[38])
      });
    }
  });

  return zeilen;
}

function liste(wert) {
  return sanitize(wert)
    .split('|')
    .map(function (teil) { return teil.trim(); })
    .filter(function (teil) { return teil !== ''; });
}

function seiteAusPfad(pfad) {
  var p = String(pfad || '');
  if (p.indexOf('/privat') !== -1) return 'Privatkunden';
  if (p.indexOf('/firmen') !== -1) return 'Firmenkunden';
  if (p.indexOf('/impressum') !== -1) return 'Impressum';
  if (p.indexOf('/datenschutz') !== -1) return 'Datenschutz';
  return 'Startseite';
}

function kampagneAusVerweis(verweis) {
  var v = sanitize(verweis);
  if (!v) return 'direkt';

  var treffer = v.match(/^https?:\/\/([^\/]+)/i);
  return treffer ? 'referrer=' + treffer[1] : 'referrer=' + v;
}

/* =========================================================
   EINRICHTUNG
========================================================= */

function einrichten() {
  blattHolen(CONFIG.ereignisBlatt, EREIGNIS_SPALTEN);
  auswertungAufbauen();

  return meldung(
    'Fertig. Neu sind "' + CONFIG.ereignisBlatt + '" und "' + CONFIG.auswertungBlatt +
    '". Die Blätter Privatkunden, Firmenkunden, Tracking, Dashboard und ' +
    'Dashboard_Daten wurden nicht angefasst. Jetzt altdatenUebernehmen() ausführen.'
  );
}

function altdatenLoeschen() {
  var blatt = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.ereignisBlatt);
  if (!blatt || blatt.getLastRow() < 2) return;

  var grenze = new Date();
  grenze.setMonth(grenze.getMonth() - CONFIG.aufbewahrungMonate);

  var daten = blatt.getRange(2, 1, blatt.getLastRow() - 1, 1).getValues();
  var zuLoeschen = 0;

  for (var i = 0; i < daten.length; i++) {
    var zeitpunkt = daten[i][0];
    if (!(zeitpunkt instanceof Date) || zeitpunkt >= grenze) break;
    zuLoeschen++;
  }

  if (zuLoeschen > 0) {
    blatt.deleteRows(2, zuLoeschen);
    console.log(zuLoeschen + ' alte Ereigniszeilen gelöscht.');
  }
}

/* =========================================================
   HELFER
========================================================= */

function blattHolen(name, spalten) {
  var datei = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var blatt = datei.getSheetByName(name);

  if (!blatt) blatt = datei.insertSheet(name);

  if (blatt.getLastRow() === 0) {
    blatt.getRange(1, 1, 1, spalten.length).setValues([spalten])
      .setFontWeight('bold')
      .setBackground('#0e4e2d')
      .setFontColor('#ffffff');

    blatt.setFrozenRows(1);
    blatt.getRange('A:A').setNumberFormat('dd.MM.yyyy HH:mm:ss');
    blatt.getRange('B:B').setNumberFormat('dd.MM.yyyy');
  }

  return blatt;
}

function nurDatum(zeitpunkt) {
  return new Date(zeitpunkt.getFullYear(), zeitpunkt.getMonth(), zeitpunkt.getDate());
}

function sanitize(value) {
  if (value === undefined || value === null) return '';

  return String(value)
    .replace(/<[^>]*>?/gm, '')
    .replace(/[{}[\]\\]/g, '')
    .trim()
    .slice(0, 900);
}

function numberValue(value) {
  var number = Number(value);
  return isNaN(number) ? 0 : number;
}

function numberOrEmpty(value) {
  if (value === undefined || value === null || String(value).trim() === '') return '';

  var number = Number(value);
  return isNaN(number) ? '' : number;
}

function createRequestId(prefix, sheet) {
  var today = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyyMMdd');
  var lastRow = sheet.getLastRow();
  var requestCount = Math.max(lastRow - 1, 0) + 1;
  var runningNumber = String(requestCount).padStart(3, '0');

  return 'ANF-' + prefix + '-' + today + '-' + runningNumber;
}

function jsonResponse(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: success, message: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function meldung(text) {
  console.log(text);

  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(text, 'AlltagsHilfe', 12);
  } catch (fehler) {
    /* Ohne geoeffnete Tabelle gibt es kein Toast, das ist in Ordnung. */
  }

  return text;
}

function testEmail() {
  MailApp.sendEmail({
    to: CONFIG.recipientEmail,
    subject: 'Test E-Mail AlltagsHilfe Formular',
    body: 'Das ist eine Testmail aus Google Apps Script.',
    name: 'AlltagsHilfe Service Website'
  });
}

/* =========================================================
   AUSWERTUNG
   Reine Formeln, damit die Zahlen ohne Skriptlauf aktuell sind.
========================================================= */

function auswertungAufbauen() {
  var datei = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var blatt = datei.getSheetByName(CONFIG.auswertungBlatt);

  if (blatt) {
    blatt.getRange(1, 1, blatt.getMaxRows(), blatt.getMaxColumns()).breakApart();
    blatt.clear();
    blatt.getCharts().forEach(function (diagramm) { blatt.removeChart(diagramm); });
  } else {
    blatt = datei.insertSheet(CONFIG.auswertungBlatt, 0);
  }

  var E = "'" + CONFIG.ereignisBlatt + "'";
  var P = "'" + CONFIG.privateSheetName + "'";
  var F = "'" + CONFIG.businessSheetName + "'";

  function besucher(bedingung) {
    return '=IFERROR(COUNTUNIQUE(FILTER(' + E + '!$C$2:$C,' + bedingung + ',' + E + '!$C$2:$C<>"")),0)';
  }

  function sitzungen(bedingung) {
    return '=IFERROR(COUNTUNIQUE(FILTER(' + E + '!$D$2:$D,' + bedingung + ',' + E + '!$D$2:$D<>"")),0)';
  }

  function ereignisse(bedingung, name) {
    return '=IFERROR(COUNTA(FILTER(' + E + '!$G$2:$G,' + bedingung + ',' + E + '!$G$2:$G="' + name + '")),0)';
  }

  /* Echte Anfragen kommen aus den beiden Kundenblaettern, nicht aus
     der Messung. Das ist die verlaessliche Zahl. */
  function anfragen(von, bis) {
    return '=COUNTIFS(' + P + '!$A$2:$A,">="&' + von + ',' + P + '!$A$2:$A,"<"&' + bis + ')' +
           '+COUNTIFS(' + F + '!$A$2:$A,">="&' + von + ',' + F + '!$A$2:$A,"<"&' + bis + ')';
  }

  var zeitraeume = [
    ['Heute', E + '!$B$2:$B=TODAY()', 'TODAY()', 'TODAY()+1'],
    ['Gestern', E + '!$B$2:$B=TODAY()-1', 'TODAY()-1', 'TODAY()'],
    ['Diese Woche', E + '!$B$2:$B>=TODAY()-WEEKDAY(TODAY(),3)', 'TODAY()-WEEKDAY(TODAY(),3)', 'TODAY()+1'],
    ['Dieser Monat', E + '!$B$2:$B>=EOMONTH(TODAY(),-1)+1', 'EOMONTH(TODAY(),-1)+1', 'TODAY()+1'],
    ['Letzte 30 Tage', E + '!$B$2:$B>=TODAY()-29', 'TODAY()-29', 'TODAY()+1']
  ];

  /* Kopf */
  blatt.getRange('A1').setValue('AlltagsHilfe Service – Auswertung');
  blatt.getRange('A1:H1').merge()
    .setFontSize(16).setFontWeight('bold')
    .setBackground('#0e4e2d').setFontColor('#ffffff')
    .setVerticalAlignment('middle');
  blatt.setRowHeight(1, 42);

  blatt.getRange('A2').setFormula('="Stand: "&TEXT(NOW(),"dd.MM.yyyy HH:mm")');
  blatt.getRange('A2:H2').merge().setFontColor('#6b7280');

  /* Kennzahlen */
  var kopf = ['Zeitraum', 'Besucher', 'Sitzungen', 'Seitenaufrufe', 'Anfragen',
              'Kontaktklicks', 'Anfragen je 100 Besucher'];

  blatt.getRange(4, 1, 1, kopf.length).setValues([kopf])
    .setFontWeight('bold').setBackground('#eef4ec');

  zeitraeume.forEach(function (eintrag, index) {
    var reihe = 5 + index;

    blatt.getRange(reihe, 1).setValue(eintrag[0]);
    blatt.getRange(reihe, 2).setFormula(besucher(eintrag[1]));
    blatt.getRange(reihe, 3).setFormula(sitzungen(eintrag[1]));
    blatt.getRange(reihe, 4).setFormula(ereignisse(eintrag[1], 'page_view'));
    blatt.getRange(reihe, 5).setFormula(anfragen(eintrag[2], eintrag[3]));
    blatt.getRange(reihe, 6).setFormula(
      '=IFERROR(COUNTA(FILTER(' + E + '!$G$2:$G,' + eintrag[1] +
      ',REGEXMATCH(' + E + '!$G$2:$G,"^click_(phone|whatsapp|email)$"))),0)'
    );
    blatt.getRange(reihe, 7).setFormula('=IF(B' + reihe + '=0,0,ROUND(E' + reihe + '/B' + reihe + '*100,1))');
  });

  blatt.getRange(5, 1, zeitraeume.length, 1).setFontWeight('bold');

  /* Verlauf 30 Tage */
  blatt.getRange('A11').setValue('Verlauf – letzte 30 Tage').setFontWeight('bold').setFontSize(12);
  blatt.getRange(12, 1, 1, 5).setValues([['Datum', 'Besucher', 'Sitzungen', 'Seitenaufrufe', 'Anfragen']])
    .setFontWeight('bold').setBackground('#eef4ec');

  blatt.getRange('A13').setFormula('=SEQUENCE(30,1,TODAY()-29,1)');
  blatt.getRange('A13:A42').setNumberFormat('ddd, dd.MM.yyyy');

  for (var t = 0; t < 30; t++) {
    var zeile = 13 + t;
    var tag = E + '!$B$2:$B=$A' + zeile;

    blatt.getRange(zeile, 2).setFormula(besucher(tag));
    blatt.getRange(zeile, 3).setFormula(sitzungen(tag));
    blatt.getRange(zeile, 4).setFormula(ereignisse(tag, 'page_view'));
    blatt.getRange(zeile, 5).setFormula(anfragen('$A' + zeile, '$A' + zeile + '+1'));
  }

  blatt.getRange('G12').setValue('Trend Besucher').setFontWeight('bold');
  blatt.getRange('G13').setFormula('=SPARKLINE(B13:B42,{"charttype","column";"color","#0e4e2d"})');

  /* Wochen */
  blatt.getRange('A45').setValue('Letzte 12 Wochen').setFontWeight('bold').setFontSize(12);
  blatt.getRange(46, 1, 1, 4).setValues([['Woche ab', 'Besucher', 'Sitzungen', 'Anfragen']])
    .setFontWeight('bold').setBackground('#eef4ec');
  blatt.getRange('A47').setFormula('=SEQUENCE(12,1,TODAY()-WEEKDAY(TODAY(),3)-77,7)');
  blatt.getRange('A47:A58').setNumberFormat('dd.MM.yyyy');

  for (var w = 0; w < 12; w++) {
    var wZeile = 47 + w;
    var woche = E + '!$B$2:$B>=$A' + wZeile + ',' + E + '!$B$2:$B<$A' + wZeile + '+7';

    blatt.getRange(wZeile, 2).setFormula(besucher(woche));
    blatt.getRange(wZeile, 3).setFormula(sitzungen(woche));
    blatt.getRange(wZeile, 4).setFormula(anfragen('$A' + wZeile, '$A' + wZeile + '+7'));
  }

  /* Monate */
  blatt.getRange('F45').setValue('Letzte 12 Monate').setFontWeight('bold').setFontSize(12);
  blatt.getRange(46, 6, 1, 4).setValues([['Monat', 'Besucher', 'Sitzungen', 'Anfragen']])
    .setFontWeight('bold').setBackground('#eef4ec');
  blatt.getRange('F47:F58').setNumberFormat('MMMM yyyy');

  for (var m = 0; m < 12; m++) {
    var mZeile = 47 + m;
    blatt.getRange(mZeile, 6).setFormula('=EOMONTH(TODAY(),' + (m - 12) + ')+1');

    var monat = E + '!$B$2:$B>=$F' + mZeile + ',' + E + '!$B$2:$B<=EOMONTH($F' + mZeile + ',0)';

    blatt.getRange(mZeile, 7).setFormula(besucher(monat));
    blatt.getRange(mZeile, 8).setFormula(sitzungen(monat));
    blatt.getRange(mZeile, 9).setFormula(anfragen('$F' + mZeile, 'EOMONTH($F' + mZeile + ',0)+1'));
  }

  /* Tabellen */
  function abfrage(zelle, titel, auswahl) {
    blatt.getRange(zelle).setValue(titel).setFontWeight('bold').setFontSize(12);

    var ziel = blatt.getRange(zelle).offset(1, 0).getA1Notation();
    blatt.getRange(ziel).setFormula(
      '=IFERROR(QUERY(' + E + '!$A$2:$AB,"' + auswahl + '",0),"noch keine Daten")'
    );
  }

  abfrage('A61', 'Woher kommen die Besucher',
    "select V, count(A) where G = 'page_view' and V is not null group by V order by count(A) desc limit 10 label V 'Kampagne / Herkunft', count(A) 'Aufrufe'");

  abfrage('D61', 'Geräte und Systeme',
    "select S, T, count(A) where G = 'page_view' group by S, T order by count(A) desc label S 'Gerät', T 'System', count(A) 'Aufrufe'");

  abfrage('H61', 'Browser',
    "select U, count(A) where G = 'page_view' and U is not null and U <> '' group by U order by count(A) desc label U 'Browser', count(A) 'Aufrufe'");

  abfrage('K61', 'Meistbesuchte Seiten',
    "select H, count(A) where G = 'page_view' group by H order by count(A) desc label H 'Seite', count(A) 'Aufrufe'");

  abfrage('A76', 'Meistgelesene Abschnitte',
    "select J, count(A) where G = 'view_section' group by J order by count(A) desc limit 12 label J 'Abschnitt', count(A) 'Aufrufe'");

  abfrage('D76', 'Gefragteste Leistungen',
    "select O, count(A) where G = 'details_open' and O is not null group by O order by count(A) desc limit 12 label O 'Leistung', count(A) 'Geöffnet'");

  abfrage('H76', 'Kontaktwege',
    "select G, count(A) where G starts with 'click_' group by G order by count(A) desc limit 12 label G 'Klickart', count(A) 'Klicks'");

  abfrage('K76', 'Zeit je Abschnitt in Sekunden',
    "select J, sum(M) where G = 'section_time' and J is not null group by J order by sum(M) desc limit 12 label J 'Abschnitt', sum(M) 'Sekunden'");

  /* Formular-Trichter */
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
    blatt.getRange(zeile, 2).setFormula('=COUNTIF(' + E + '!$G$2:$G,"' + schritt[1] + '")');
    blatt.getRange(zeile, 3).setFormula(
      index === 0 ? '=""' : '=IF(B' + (zeile - 1) + '=0,"",TEXT(B' + zeile + '/B' + (zeile - 1) + ',"0%"))'
    );
  });

  blatt.getRange('E93').setValue('Letztes Feld vor dem Abbruch').setFontWeight('bold').setFontSize(12);
  blatt.getRange('E94').setFormula(
    '=IFERROR(QUERY(' + E + '!$A$2:$AB,"select Q, count(A) where G = \'form_abandon\' and Q is not null and Q <> \'\' group by Q order by count(A) desc limit 10 label Q \'Feld\', count(A) \'Abbrüche\'",0),"noch keine Daten")'
  );

  /* Anfragen aus den Kundenblaettern */
  blatt.getRange('A108').setValue('Anfragen nach Ort').setFontWeight('bold').setFontSize(12);
  blatt.getRange('A109').setFormula(
    '=IFERROR(QUERY({' + P + '!$I$2:$J;' + F + '!$J$2:$K},' +
    '"select Col2, count(Col2) where Col2 is not null and Col2 <> \'\' group by Col2 order by count(Col2) desc limit 15 ' +
    'label Col2 \'Ort\', count(Col2) \'Anfragen\'",0),"noch keine Anfragen")'
  );

  blatt.getRange('D108').setValue('Anfragen nach PLZ').setFontWeight('bold').setFontSize(12);
  blatt.getRange('D109').setFormula(
    '=IFERROR(QUERY({' + P + '!$I$2:$J;' + F + '!$J$2:$K},' +
    '"select Col1, count(Col1) where Col1 is not null and Col1 <> \'\' group by Col1 order by count(Col1) desc limit 15 ' +
    'label Col1 \'PLZ\', count(Col1) \'Anfragen\'",0),"noch keine Anfragen")'
  );

  blatt.getRange('G108').setValue('Anfragen je Bereich').setFontWeight('bold').setFontSize(12);
  blatt.getRange(109, 7, 3, 2).setValues([
    ['Bereich', 'Anfragen'],
    ['Privatkunden', ''],
    ['Firmenkunden', '']
  ]);
  blatt.getRange('H110').setFormula('=COUNTA(' + P + '!$B$2:$B)');
  blatt.getRange('H111').setFormula('=COUNTA(' + F + '!$B$2:$B)');
  blatt.getRange('G109:H109').setFontWeight('bold').setBackground('#eef4ec');

  /* Hinweis zu den uebernommenen Zeilen */
  blatt.getRange('A115').setFormula(
    '="Davon aus dem alten Tracking übernommen: "&COUNTIF(' + E + '!$AB$2:$AB,"Import")&" Ereignisse."'
  );
  blatt.getRange('A115:F115').merge().setFontColor('#6b7280');

  /* Optik */
  blatt.setColumnWidth(1, 210);
  for (var s = 2; s <= 12; s++) blatt.setColumnWidth(s, 125);
  blatt.setHiddenGridlines(true);

  return blatt;
}
