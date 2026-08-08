/* =========================================================
   AlltagsHilfe Service – Uebernahme der Altdaten
   ---------------------------------------------------------
   Gehoert zu Code.gs und Auswertung.gs. Alle drei Dateien
   teilen sich denselben Namensraum, die Reihenfolge im
   Editor spielt keine Rolle.
========================================================= */

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
