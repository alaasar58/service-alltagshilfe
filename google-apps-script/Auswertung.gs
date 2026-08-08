/* =========================================================
   AlltagsHilfe Service – Auswertung
   ---------------------------------------------------------
   Gehoert zu Code.gs und Auswertung.gs. Alle drei Dateien
   teilen sich denselben Namensraum, die Reihenfolge im
   Editor spielt keine Rolle.
========================================================= */

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
