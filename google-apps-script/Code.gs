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

