/* =========================================================
   AlltagsHilfe Service – interne Reichweitenmessung
   ---------------------------------------------------------
   Eine gemeinsame Datei fuer alle Seiten. Frueher lag dieser
   Code drei Mal inline in den HTML-Dateien.

   Grundsaetze:
   - So wenige Requests wie moeglich (Ereignisse werden
     entprellt, zusammengefasst und doppelte verworfen).
   - Kein Versand ohne Speicher-/Datenschutz-Check
     (Opt-out, Do-Not-Track, Bots, lokale Tests).
   - Stabile Ereignisnamen + eigene Spalten statt
     "view_section_kontakt", "time_15s" usw.

   Oeffentliche API (z. B. fuer die Datenschutzseite):
     AhsTracking.optOut()      Messung dauerhaft deaktivieren
     AhsTracking.optIn()       Messung wieder erlauben
     AhsTracking.isOptedOut()  aktueller Zustand
     AhsTracking.isActive()    misst die Seite gerade?
     AhsTracking.track(name, options)
========================================================= */

(function (window, document) {
  'use strict';

  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1YPu4Li35oDFT2PgT2KvrZMiKJifDhXhaCYYgxw2u6NItMKRaMivm9UirW2e2hZPQ5A/exec';

  var SESSION_MINUTES = 30;   /* Leerlauf bis eine neue Sitzung beginnt */
  var TICK_MS = 5000;         /* ein einziger Timer fuer die ganze Datei */
  var FLUSH_MS = 1200;        /* Sammelfenster vor dem Senden */
  var SECTION_MIN_SECONDS = 10;
  var TIME_STAGES = [15, 30, 60, 120];
  var SCROLL_STAGES = [25, 50, 75, 100];
  var IGNORED_SECTION_IDS = ['oben'];

  var KEYS = {
    visitor: 'ahs_visitor_id',
    visits: 'ahs_visit_count',
    session: 'ahs_session_id',
    seen: 'ahs_session_seen',
    campaign: 'ahs_session_campaign',
    optOut: 'ahs_tracking_optout',
    legacyTime: 'ahs_visitor_time'
  };

  /* =========================
     SPEICHER (faellt lautlos auf den Arbeitsspeicher zurueck)
     Im privaten Modus wirft localStorage eine Ausnahme. Frueher
     ist dadurch der komplette Klick-Handler abgebrochen.
  ========================= */

  var memory = {};

  var storage = (function () {
    try {
      var probe = '__ahs_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (error) {
      return null;
    }
  })();

  function read(key) {
    if (storage) {
      try {
        var stored = storage.getItem(key);
        if (stored !== null) return stored;
      } catch (error) { /* ignorieren */ }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function write(key, value) {
    memory[key] = String(value);
    if (storage) {
      try { storage.setItem(key, String(value)); } catch (error) { /* ignorieren */ }
    }
  }

  function drop(key) {
    delete memory[key];
    if (storage) {
      try { storage.removeItem(key); } catch (error) { /* ignorieren */ }
    }
  }

  /* =========================
     DARF GEMESSEN WERDEN?
  ========================= */

  function readParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return null;
    }
  }

  function applyOptOutParam() {
    var wish = (readParam('tracking') || '').toLowerCase();
    if (wish === 'off' || wish === 'aus') write(KEYS.optOut, '1');
    if (wish === 'on' || wish === 'ein') drop(KEYS.optOut);
  }

  function isOptedOut() {
    return read(KEYS.optOut) === '1';
  }

  function respectsDoNotTrack() {
    if (window.navigator.globalPrivacyControl === true) return true;
    var flag = window.navigator.doNotTrack || window.doNotTrack || window.navigator.msDoNotTrack;
    return flag === '1' || flag === 'yes';
  }

  function isAutomated() {
    if (window.navigator.webdriver === true) return true;
    return /bot|crawler|spider|slurp|headless|lighthouse|pingdom|gtmetrix|preview/i
      .test(window.navigator.userAgent || '');
  }

  function isLocalTest() {
    var host = window.location.hostname;
    return !host || host === 'localhost' || host === '127.0.0.1' || host === '::1' || /\.local$/.test(host);
  }

  applyOptOutParam();

  var active = !isOptedOut() && !respectsDoNotTrack() && !isAutomated() && !isLocalTest();

  /* =========================
     BESUCHER UND SITZUNG
     Besucher-ID bleibt dauerhaft, Sitzungs-ID laeuft nach
     30 Minuten Leerlauf ab. Frueher gab es nur eine ID, damit
     liessen sich wiederkehrende Besucher nicht erkennen.
  ========================= */

  function randomId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  var identity = { visitor: '', session: '', visits: 0, newVisitor: false, newSession: false };

  function refreshIdentity() {
    var now = Date.now();

    var visitor = read(KEYS.visitor);
    if (!visitor) {
      visitor = randomId('V');
      identity.newVisitor = true;
    }
    write(KEYS.visitor, visitor);
    drop(KEYS.legacyTime);

    var lastSeen = Number(read(KEYS.seen) || 0);
    var expired = !lastSeen || (now - lastSeen) > SESSION_MINUTES * 60 * 1000;
    var session = read(KEYS.session);
    var visits = Number(read(KEYS.visits) || 0);

    if (!session || expired) {
      session = randomId('S');
      visits = visits + 1;
      identity.newSession = true;
      write(KEYS.session, session);
      write(KEYS.visits, visits);
      drop(KEYS.campaign);
    }

    write(KEYS.seen, now);

    identity.visitor = visitor;
    identity.session = session;
    identity.visits = visits;
  }

  /* =========================
     KAMPAGNE / HERKUNFT
     Wichtig fuer QR-Codes und Flyer: ohne utm-Parameter sieht
     jeder Scan wie Direktzugriff aus.
  ========================= */

  function detectCampaign() {
    var stored = read(KEYS.campaign);
    if (stored) return stored;

    var parts = [];
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (name) {
      var value = readParam(name);
      if (value) parts.push(name.replace('utm_', '') + '=' + value);
    });

    var shortRef = readParam('ref') || readParam('q');
    if (!parts.length && shortRef) parts.push('source=' + shortRef);

    if (!parts.length && document.referrer) {
      try {
        var host = new URL(document.referrer).hostname;
        if (host && host !== window.location.hostname) parts.push('referrer=' + host);
      } catch (error) { /* ignorieren */ }
    }

    var campaign = parts.join(' | ').slice(0, 180) || 'direkt';
    write(KEYS.campaign, campaign);
    return campaign;
  }

  /* =========================
     KONTEXT
  ========================= */

  function getDeviceType() {
    var width = window.innerWidth;
    if (width <= 767) return 'Handy';
    if (width <= 1024) return 'Tablet';
    return 'Desktop';
  }

  function getPageSource() {
    var path = window.location.pathname;
    if (path.indexOf('/privat') !== -1) return 'Privatkunden';
    if (path.indexOf('/firmen') !== -1) return 'Firmenkunden';
    if (path.indexOf('/impressum') !== -1) return 'Impressum';
    if (path.indexOf('/datenschutz') !== -1) return 'Datenschutz';
    return 'Startseite';
  }

  function cleanText(value) {
    return String(value === 0 ? '0' : (value || ''))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  function textOf(value) {
    if (value === 0) return '0';
    return value ? String(value) : '';
  }

  /* =========================
     WARTESCHLANGE UND VERSAND
     Ein Ereignis geht weiterhin als ein Formular-POST raus,
     damit das bestehende Apps Script unveraendert bleibt.
     Neu sind: Entprellung, Doppel-Erkennung und sendBeacon
     beim Verlassen der Seite.
  ========================= */

  var queue = [];
  var flushTimer = null;
  var sequence = 0;
  var recent = {};

  var IMMEDIATE_EVENTS = /^(page_view|click_|form_submit|form_error)/;

  function buildPayload(name, options) {
    refreshIdentity();
    sequence = sequence + 1;

    var isPageView = name === 'page_view';

    return {
      form_type: 'tracking',
      visitor_id: identity.visitor,
      session_id: identity.session,
      visit_number: String(identity.visits),
      sequence: String(sequence),
      client_time: new Date().toISOString(),
      event: name,
      page: window.location.pathname || '/',
      title: isPageView ? (document.title || '') : '',
      source: getPageSource(),
      device: getDeviceType(),
      campaign: isPageView ? detectCampaign() : '',
      language: isPageView ? (window.navigator.language || '') : '',
      screen: isPageView ? (window.innerWidth + 'x' + window.innerHeight) : '',
      referrer: isPageView ? (document.referrer || '') : '',
      target: cleanText(options.target),
      section: textOf(options.section),
      value: textOf(options.value),
      duration_seconds: textOf(options.duration_seconds),
      click_area: textOf(options.click_area),
      detail_name: cleanText(options.detail_name),
      form_kind: textOf(options.form_kind),
      last_field: cleanText(options.last_field),
      required_filled: textOf(options.required_filled)
    };
  }

  function send(payload) {
    var data = new FormData();

    Object.keys(payload).forEach(function (key) {
      data.append(key, payload[key]);
    });

    if (window.navigator.sendBeacon && document.visibilityState === 'hidden') {
      try {
        if (window.navigator.sendBeacon(ENDPOINT, data)) return;
      } catch (error) { /* auf fetch zurueckfallen */ }
    }

    try {
      window.fetch(ENDPOINT, {
        method: 'POST',
        body: data,
        mode: 'no-cors',
        keepalive: true
      }).catch(function () { /* Messung darf die Seite nie stoeren */ });
    } catch (error) { /* ignorieren */ }
  }

  function flush() {
    if (flushTimer) {
      window.clearTimeout(flushTimer);
      flushTimer = null;
    }

    var pending = queue;
    queue = [];
    pending.forEach(send);
  }

  function scheduleFlush(immediate) {
    if (immediate) {
      flush();
      return;
    }
    if (flushTimer) return;
    flushTimer = window.setTimeout(flush, FLUSH_MS);
  }

  function isDuplicate(name, options) {
    var key = [
      name,
      options.section || '',
      options.target || '',
      options.value || '',
      options.last_field || '',
      options.required_filled || ''
    ].join('#');

    var now = Date.now();

    if (recent[key] && (now - recent[key]) < 1000) return true;

    recent[key] = now;
    return false;
  }

  function track(name, options) {
    if (!active || !name) return;

    options = options || {};
    if (isDuplicate(name, options)) return;

    queue.push(buildPayload(name, options));
    scheduleFlush(IMMEDIATE_EVENTS.test(name));
  }

  /* =========================
     SEITENAUFRUF
  ========================= */

  function start() {
    track('page_view', {
      value: identity.newVisitor ? 'neuer Besucher' : 'wiederkehrend',
      duration_seconds: 0
    });
  }

  /* =========================
     ABSCHNITTE
     Die Liste kommt jetzt aus dem Dokument. Frueher war sie
     fest verdrahtet: auf der Startseite passte kein einziger
     Eintrag, auf der Privatseite fehlten alle Leistungen.
  ========================= */

  var sections = [];

  function collectSections() {
    sections = Array.prototype.slice
      .call(document.querySelectorAll('section[id]'))
      .filter(function (section) {
        return IGNORED_SECTION_IDS.indexOf(section.id) === -1;
      });
  }

  function watchSections() {
    if (!sections.length || !('IntersectionObserver' in window)) return;

    var seen = {};

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        var id = entry.target.id;
        if (!id || seen[id]) return;

        seen[id] = true;
        track('view_section', { section: id });
      });
    }, {
      /* Kein Prozentwert, sondern das mittlere Drittel des Bildschirms.
         Ein fester Schwellwert wie 0.45 wird bei sehr langen
         Abschnitten (z. B. "Leistungen") nie erreicht. */
      rootMargin: '-33% 0px -33% 0px',
      threshold: 0
    });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* =========================
     VERWEILDAUER
     Ein Timer fuer Zeitstufen und Abschnittszeiten. Gezaehlt
     wird nur, solange der Tab wirklich sichtbar ist.
  ========================= */

  var engagedSeconds = 0;
  var pendingStages = TIME_STAGES.slice();
  var sectionSeconds = {};

  function detectActiveSection() {
    var best = '';
    var bestDistance = Infinity;

    sections.forEach(function (section) {
      var rect = section.getBoundingClientRect();
      var distance = Math.abs(rect.top - 130);

      if (rect.bottom > 120 && rect.top < window.innerHeight && distance < bestDistance) {
        bestDistance = distance;
        best = section.id;
      }
    });

    return best;
  }

  function flushSectionSeconds() {
    Object.keys(sectionSeconds).forEach(function (id) {
      var seconds = sectionSeconds[id];
      if (seconds < SECTION_MIN_SECONDS) return;

      sectionSeconds[id] = 0;
      track('section_time', {
        section: id,
        value: String(seconds),
        duration_seconds: engagedSeconds
      });
    });
  }

  function tick() {
    if (document.visibilityState !== 'visible') return;

    engagedSeconds = engagedSeconds + TICK_MS / 1000;

    var current = detectActiveSection();
    if (current) {
      sectionSeconds[current] = (sectionSeconds[current] || 0) + TICK_MS / 1000;
    }

    while (pendingStages.length && engagedSeconds >= pendingStages[0]) {
      var stage = pendingStages.shift();
      track('time_on_page', { value: String(stage), duration_seconds: stage });
    }
  }

  /* =========================
     SCROLLTIEFE
  ========================= */

  var pendingScroll = SCROLL_STAGES.slice();

  function checkScrollDepth() {
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;

    var percent = Math.round(((window.scrollY || window.pageYOffset || 0) / scrollable) * 100);

    while (pendingScroll.length && percent >= pendingScroll[0]) {
      var stage = pendingScroll.shift();
      track('scroll_depth', { value: String(stage), duration_seconds: Math.round(engagedSeconds) });
    }
  }

  /* =========================
     KLICKS
  ========================= */

  function detectClickArea(element) {
    if (!element) return 'inhalt';
    if (element.closest('.header') || element.closest('.nav')) return 'navigation';
    if (element.closest('.hero')) return 'hero';
    if (element.closest('.contact') || element.closest('.side-contact') || element.closest('.qr-box')) return 'kontakt';
    if (element.closest('footer') || element.closest('.footer')) return 'footer';
    return 'inhalt';
  }

  function isInternalLink(href) {
    if (/^(#|\/)/.test(href)) return true;
    if (/^https?:/i.test(href)) {
      try {
        return new URL(href, window.location.href).hostname === window.location.hostname;
      } catch (error) {
        return false;
      }
    }
    return !/^[a-z]+:/i.test(href);
  }

  function watchClicks() {
    document.addEventListener('click', function (event) {
      var summary = event.target.closest('summary');

      if (summary) {
        var details = summary.closest('details');
        var service = summary.closest('.service');
        var heading = service ? service.querySelector('h3') : null;
        var title = cleanText(heading ? heading.textContent : summary.textContent);

        if (details && !details.open) {
          track('details_open', {
            target: title,
            detail_name: title,
            click_area: detectClickArea(summary)
          });
        }
        return;
      }

      var button = event.target.closest('button');

      if (button && !button.closest('form')) {
        track('click_button', {
          target: cleanText(button.textContent || button.getAttribute('aria-label') || 'Button'),
          click_area: detectClickArea(button)
        });
        return;
      }

      var link = event.target.closest('a');
      if (!link) return;

      var href = link.getAttribute('href') || '';
      var text = cleanText(link.textContent || href);
      var area = detectClickArea(link);

      if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp.com') !== -1) {
        track('click_whatsapp', { target: href, click_area: area });
        return;
      }

      if (href.indexOf('tel:') === 0) {
        track('click_phone', { target: href, click_area: area });
        return;
      }

      if (href.indexOf('mailto:') === 0) {
        track('click_email', { target: href, click_area: area });
        return;
      }

      if (href.indexOf('/privat') !== -1) {
        track('click_privat', { target: href, click_area: area });
        return;
      }

      if (href.indexOf('/firmen') !== -1) {
        track('click_firmen', { target: href, click_area: area });
        return;
      }

      track(isInternalLink(href) ? 'click_link' : 'click_extern', {
        target: href || text,
        value: text,
        click_area: area
      });
    });
  }

  /* =========================
     FORMULARE
     Frueher ging bei jedem Tastendruck ein Request raus. Jetzt
     meldet sich das Formular nur, wenn sich der Fortschritt
     tatsaechlich aendert.
  ========================= */

  var formStates = new WeakMap();

  function getFormType(form) {
    var hidden = form.querySelector('input[name="form_type"]');
    return hidden && hidden.value === 'firmen' ? 'firmen' : 'privat';
  }

  function getFormEventName(part) {
    return 'form_' + part;
  }

  function getFieldLabel(input) {
    var field = input.closest('.form-field');
    var label = field ? field.querySelector('label') : null;
    return cleanText(label ? label.textContent : (input.name || input.type || 'Feld')).replace('*', '').trim();
  }

  function getRequiredFilled(form) {
    var required = Array.prototype.slice.call(form.querySelectorAll('[required]'));
    var filled = 0;

    required.forEach(function (input) {
      if (input.type === 'checkbox') {
        if (input.checked) filled++;
        return;
      }
      if (input.value && input.value.trim() !== '') filled++;
    });

    return filled + '/' + required.length;
  }

  function ensureFormState(form) {
    if (!formStates.has(form)) {
      formStates.set(form, {
        viewed: false,
        started: false,
        submitted: false,
        lastField: '',
        lastProgress: '',
        abandoned: false,
        startedAt: 0
      });
    }
    return formStates.get(form);
  }

  function watchForms() {
    var forms = Array.prototype.slice.call(document.querySelectorAll('.ajax-form'));
    if (!forms.length) return;

    forms.forEach(function (form) {
      var state = ensureFormState(form);
      var kind = getFormType(form);

      function reportView() {
        if (state.viewed) return;
        state.viewed = true;
        track(getFormEventName('view'), { form_kind: kind, click_area: 'kontakt' });
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) reportView();
          });
        }, { threshold: 0.25 });
        observer.observe(form);
      } else {
        reportView();
      }

      function markProgress(event) {
        var input = event.target;
        if (!input.name || input.name === 'website') return;

        state.lastField = getFieldLabel(input);

        if (!state.started) {
          state.started = true;
          state.startedAt = Date.now();
          state.lastProgress = getRequiredFilled(form);

          track(getFormEventName('start'), {
            form_kind: kind,
            last_field: state.lastField,
            required_filled: state.lastProgress,
            click_area: 'kontakt'
          });
          return;
        }

        var progress = getRequiredFilled(form);
        if (progress === state.lastProgress) return;

        state.lastProgress = progress;

        track(getFormEventName('progress'), {
          form_kind: kind,
          last_field: state.lastField,
          required_filled: progress,
          click_area: 'kontakt'
        });
      }

      form.addEventListener('input', markProgress);
      form.addEventListener('change', markProgress);

      form.addEventListener('ahs:form-invalid', function (event) {
        track(getFormEventName('error'), {
          form_kind: kind,
          last_field: (event.detail && event.detail.field) || state.lastField,
          required_filled: getRequiredFilled(form),
          click_area: 'kontakt'
        });
      });

      form.addEventListener('ahs:form-submitted', function () {
        state.submitted = true;

        track(getFormEventName('submit'), {
          target: kind === 'firmen' ? 'Firmenkunden Formular' : 'Privatkunden Formular',
          form_kind: kind,
          last_field: state.lastField,
          required_filled: state.lastProgress,
          duration_seconds: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : '',
          click_area: 'kontakt'
        });
      });
    });
  }

  function reportAbandonedForms() {
    document.querySelectorAll('.ajax-form').forEach(function (form) {
      var state = ensureFormState(form);
      if (!state.started || state.submitted || state.abandoned) return;

      state.abandoned = true;

      track(getFormEventName('abandon'), {
        form_kind: getFormType(form),
        last_field: state.lastField,
        required_filled: getRequiredFilled(form),
        duration_seconds: state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : '',
        click_area: 'kontakt'
      });
    });
  }

  /* =========================
     SEITE WIRD VERLASSEN
  ========================= */

  var finished = false;

  /* Tabwechsel: nur sichern, was sonst verloren geht. */
  function pause() {
    flushSectionSeconds();
    flush();
  }

  /* Seite wird wirklich verlassen. */
  function finish() {
    if (finished) return;
    finished = true;

    flushSectionSeconds();
    reportAbandonedForms();

    track('page_leave', { duration_seconds: Math.round(engagedSeconds) });
    flush();
  }

  /* =========================
     START
  ========================= */

  function boot() {
    collectSections();

    if (!active) return;

    refreshIdentity();   /* muss vor start() laufen, sonst ist newVisitor noch false */
    start();
    watchSections();
    watchClicks();
    watchForms();

    window.setInterval(tick, TICK_MS);
    window.addEventListener('scroll', checkScrollDepth, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') pause();
    });

    window.addEventListener('pagehide', finish);
  }

  window.AhsTracking = {
    track: track,
    isActive: function () { return active; },
    isOptedOut: isOptedOut,
    optOut: function () {
      write(KEYS.optOut, '1');
      active = false;
      queue = [];
      [KEYS.visitor, KEYS.visits, KEYS.session, KEYS.seen, KEYS.campaign, KEYS.legacyTime].forEach(drop);
      return true;
    },
    optIn: function () {
      drop(KEYS.optOut);
      active = !respectsDoNotTrack() && !isAutomated() && !isLocalTest();
      return active;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
