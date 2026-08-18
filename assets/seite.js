/* Skript fuer Startseite, Privat- und Firmenkunden. Jeder Teil prueft
   selbst, ob es das jeweilige Element gibt, und laeuft daher auf allen
   drei Seiten unveraendert. */
const TRACKING_URL = "https://script.google.com/macros/s/AKfycbz1YPu4Li35oDFT2PgT2KvrZMiKJifDhXhaCYYgxw2u6NItMKRaMivm9UirW2e2hZPQ5A/exec";

/* =========================
   BASIS-FUNKTIONEN
========================= */

const header = document.querySelector('.header');

if(header){
  window.addEventListener('scroll', () => {
    window.scrollY > 20 ? header.classList.add('scrolled') : header.classList.remove('scrolled');
  });
}

const revealItems = document.querySelectorAll('.reveal');

if(revealItems.length){
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('show');
      }else{
        entry.target.classList.remove('show');
      }
    });
  }, { threshold: .12 });

  revealItems.forEach(item => revealObserver.observe(item));
}

document.querySelectorAll('.back-to-top').forEach(button => {
  button.addEventListener('click', () => {
    sendTracking('click_button', {
      target:'Nach oben',
      click_area:detectClickArea(button)
    });

    window.scrollTo({ top:0, left:0, behavior:'smooth' });
  });
});

document.querySelectorAll('.date-field').forEach(field => {
  const today = new Date().toISOString().split('T')[0];
  field.setAttribute('min', today);
});

/* =========================
   DROPDOWN NACH KLICK SCHLIESSEN
========================= */

document.querySelectorAll('.dropdown-content a').forEach(link => {
  link.addEventListener('click', () => {
    const dropdown = link.closest('.dropdown');
    if(!dropdown) return;

    dropdown.classList.add('force-close');

    setTimeout(() => {
      dropdown.classList.remove('force-close');
    }, 700);
  });
});


/* =========================
   BESUCHS-ID
   1 ID bleibt ca. 30 Minuten gültig
========================= */

function getVisitorId(){
  const storageKey = 'ahs_visitor_id';
  const timeKey = 'ahs_visitor_time';
  const maxAgeMinutes = 30;
  const now = Date.now();

  let id = localStorage.getItem(storageKey);
  let savedTime = Number(localStorage.getItem(timeKey) || 0);

  const isExpired = !savedTime || (now - savedTime) > maxAgeMinutes * 60 * 1000;

  if(!id || isExpired){
    const random = Math.random().toString(36).substring(2, 10);
    const time = now.toString(36);
    id = 'V-' + time + '-' + random;
  }

  localStorage.setItem(storageKey, id);
  localStorage.setItem(timeKey, String(now));

  return id;
}

function getDeviceType(){
  const width = window.innerWidth;

  if(width <= 767) return 'Handy';
  if(width <= 1024) return 'Tablet';

  return 'Desktop';
}

function getPageSource(){
  const path = window.location.pathname;

  if(path.includes('/privat')) return 'Privatkunden';
  if(path.includes('/firmen')) return 'Firmenkunden';
  if(path.includes('/impressum')) return 'Impressum';
  if(path.includes('/datenschutz')) return 'Datenschutz';

  return 'Startseite';
}

function cleanText(value){
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function sendTracking(eventName, options){
  options = options || {};

  const data = new FormData();

  data.append('form_type', 'tracking');
  data.append('visitor_id', getVisitorId());
  data.append('event', eventName);
  data.append('page', window.location.pathname || '/');
  data.append('title', document.title || '');
  data.append('source', getPageSource());
  data.append('device', getDeviceType());
  data.append('language', navigator.language || '');
  data.append('screen', window.innerWidth + 'x' + window.innerHeight);
  data.append('referrer', document.referrer || '');
  data.append('target', options.target || '');
  data.append('section', options.section || '');
  data.append('value', options.value || '');
  data.append('duration_seconds', options.duration_seconds || '');
  data.append('click_area', options.click_area || '');
  data.append('detail_name', options.detail_name || '');
  data.append('form_kind', options.form_kind || '');
  data.append('last_field', options.last_field || '');
  data.append('required_filled', options.required_filled || '');

  fetch(TRACKING_URL, {
    method:'POST',
    body:data,
    mode:'no-cors',
    keepalive:true
  }).catch(() => {});
}

/* =========================
   PAGE VIEW
========================= */

sendTracking('page_view');

/* =========================
   ZEIT-STUFEN
========================= */

const visitStart = Date.now();

[
  { seconds:15, value:'15s' },
  { seconds:30, value:'30s' },
  { seconds:60, value:'60s' },
  { seconds:120, value:'120s' }
].forEach(item => {
  setTimeout(() => {
    if(document.visibilityState === 'visible'){
      sendTracking('time_' + item.seconds + 's', {
        value:item.value,
        duration_seconds:item.seconds
      });
    }
  }, item.seconds * 1000);
});

/* =========================
   SEKTIONEN GESEHEN
========================= */

const trackableSections = [
  'ueberblick',
  'ueber-uns',
  'fuer-wen',
  'leistungen',
  'preise',
  'zusammenarbeit',
  'einsatzbereiche',
  'einsatzgebiet',
  'kontakt'
];

const seenSections = new Set();

if('IntersectionObserver' in window){
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const sectionId = entry.target.id;

        if(sectionId && !seenSections.has(sectionId)){
          seenSections.add(sectionId);

          sendTracking('view_section_' + sectionId, {
            section:sectionId
          });
        }
      }
    });
  }, { threshold:.45 });

  trackableSections.forEach(id => {
    const section = document.getElementById(id);
    if(section) sectionObserver.observe(section);
  });
}

/* =========================
   GROBE ZEIT PRO BEREICH
========================= */

let activeSection = '';
let lastSectionTime = Date.now();

function normalizeSection(id){
  if(id === 'fuer-wen' || id === 'einsatzbereiche') return 'ueberblick';
  return id;
}

function detectActiveSection(){
  let bestSection = '';
  let bestDistance = Infinity;

  trackableSections.forEach(id => {
    const section = document.getElementById(id);
    if(!section) return;

    const rect = section.getBoundingClientRect();
    const distance = Math.abs(rect.top - 130);

    if(rect.bottom > 120 && rect.top < window.innerHeight && distance < bestDistance){
      bestDistance = distance;
      bestSection = normalizeSection(id);
    }
  });

  return bestSection;
}

setInterval(() => {
  if(document.visibilityState !== 'visible') return;

  const currentSection = detectActiveSection();
  const now = Date.now();

  if(activeSection && currentSection === activeSection){
    const seconds = Math.round((now - lastSectionTime) / 1000);

    if(seconds >= 10){
      sendTracking('section_time', {
        section:activeSection,
        value:String(seconds),
        duration_seconds:Math.round((Date.now() - visitStart) / 1000)
      });

      lastSectionTime = now;
    }
  }else{
    activeSection = currentSection;
    lastSectionTime = now;
  }
}, 10000);

/* =========================
   KLICK-BEREICH ERKENNEN
========================= */

function detectClickArea(element){
  if(!element) return 'inhalt';

  if(element.closest('.header') || element.closest('.nav')) return 'navigation';
  if(element.closest('.hero')) return 'hero';
  if(element.closest('.contact') || element.closest('.side-contact') || element.closest('.qr-box')) return 'kontakt';
  if(element.closest('.footer')) return 'footer';

  return 'inhalt';
}

/* =========================
   LINK- UND BUTTON-KLICKS TRACKEN
========================= */

document.addEventListener('click', function(event){
  const summary = event.target.closest('summary');

  if(summary){
    const details = summary.closest('details');
    const service = summary.closest('.service');
    const title = service ? cleanText(service.querySelector('h3')?.textContent) : cleanText(summary.textContent);
    const willOpen = details ? !details.open : false;

    if(willOpen){
      sendTracking('details_open', {
        target:title,
        detail_name:title,
        click_area:detectClickArea(summary)
      });
    }

    return;
  }

  const button = event.target.closest('button');

  if(button && !button.closest('form')){
    sendTracking('click_button', {
      target:cleanText(button.textContent || button.getAttribute('aria-label') || 'Button'),
      click_area:detectClickArea(button)
    });
  }

  const link = event.target.closest('a');
  if(!link) return;

  const href = link.getAttribute('href') || '';
  const text = cleanText(link.textContent || href);
  const clickArea = detectClickArea(link);

  if(href.includes('wa.me')){
    sendTracking('click_whatsapp', {
      target:href,
      click_area:clickArea
    });
    return;
  }

  if(href.startsWith('tel:')){
    sendTracking('click_phone', {
      target:href,
      click_area:clickArea
    });
    return;
  }

  if(href.startsWith('mailto:')){
    sendTracking('click_email', {
      target:href,
      click_area:clickArea
    });
    return;
  }

  if(href.includes('/privat') || text.toLowerCase().includes('privat')){
    sendTracking('click_privat', {
      target:href || text,
      click_area:clickArea
    });
    return;
  }

  if(href.includes('/firmen') || text.toLowerCase().includes('firma') || text.toLowerCase().includes('firmen')){
    sendTracking('click_firmen', {
      target:href || text,
      click_area:clickArea
    });
    return;
  }

  sendTracking('click_link', {
    target:href || text,
    click_area:clickArea
  });
});

/* =========================
   ZEICHENZÄHLER
========================= */

document.querySelectorAll('textarea[maxlength]').forEach(textarea => {
  const counter = textarea.closest('.form-field') ? textarea.closest('.form-field').querySelector('.char-counter') : null;

  function updateCounter(){
    if(counter){
      counter.textContent = textarea.value.length + ' / ' + textarea.getAttribute('maxlength') + ' Zeichen';
    }
  }

  textarea.addEventListener('input', updateCounter);
  updateCounter();
});

/* =========================
   SONSTIGES-FELD
========================= */

document.querySelectorAll('.found-select').forEach(select => {
  const form = select.closest('form');
  if(!form) return;

  const sonstigesField = form.querySelector('.found-other-wrap');
  const sonstigesInput = form.querySelector('input[name="GefundenSonstiges"]');

  function toggleOther(){
    if(!sonstigesField || !sonstigesInput) return;

    if(select.value === 'Sonstiges'){
      sonstigesField.style.display = 'block';
      sonstigesInput.required = true;
    }else{
      sonstigesField.style.display = 'none';
      sonstigesInput.required = false;
      sonstigesInput.value = '';
    }
  }

  select.addEventListener('change', toggleOther);
  toggleOther();
});

/* =========================
   FORMULAR-FEHLER
========================= */

function clearFormErrors(form){
  form.querySelectorAll('.form-field').forEach(field => {
    field.classList.remove('invalid');

    const error = field.querySelector('.error-message');
    if(error) error.textContent = '';
  });
}

function setFieldError(input, message){
  const field = input.closest('.form-field');
  if(!field) return;

  field.classList.add('invalid');

  const error = field.querySelector('.error-message');
  if(error) error.textContent = message || 'Bitte dieses Feld ausfüllen.';
}

function isValidEmail(value){
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isValidPhone(value){
  if(!value || value.trim() === '') return true;

  const cleaned = value.trim();
  const onlyAllowedCharacters = /^[0-9+()\/\-\s]+$/.test(cleaned);
  const digitsOnly = cleaned.replace(/\D/g, '');

  return onlyAllowedCharacters && digitsOnly.length >= 6 && digitsOnly.length <= 15;
}

function isValidGermanPlz(value){
  return /^[0-9]{5}$/.test((value || '').trim());
}

function validateCustomForm(form){
  clearFormErrors(form);

  let firstInvalid = null;

  form.querySelectorAll('[required]').forEach(input => {
    if(input.type === 'checkbox'){
      if(!input.checked){
        setFieldError(input, input.dataset.error);
        if(!firstInvalid) firstInvalid = input;
      }
      return;
    }

    if(!input.value || input.value.trim() === ''){
      setFieldError(input, input.dataset.error);
      if(!firstInvalid) firstInvalid = input;
      return;
    }
  });

  const emailInput = form.querySelector('input[name="E-Mail"]');
  if(emailInput && emailInput.value.trim() !== '' && !isValidEmail(emailInput.value.trim())){
    setFieldError(emailInput, emailInput.dataset.error || 'Bitte eine gültige E-Mail-Adresse eingeben.');
    if(!firstInvalid) firstInvalid = emailInput;
  }

  const plzInput = form.querySelector('input[name="PLZ"]');
  if(plzInput && plzInput.value.trim() !== '' && !isValidGermanPlz(plzInput.value.trim())){
    setFieldError(plzInput, plzInput.dataset.error || 'Bitte eine gültige 5-stellige PLZ eingeben.');
    if(!firstInvalid) firstInvalid = plzInput;
  }

  const callbackSelect = form.querySelector('.callback-select');
  const phoneInput = form.querySelector('input[name="Telefon"]');

  if(phoneInput && phoneInput.value.trim() !== '' && !isValidPhone(phoneInput.value.trim())){
    setFieldError(phoneInput, 'Bitte eine gültige Telefonnummer ohne Buchstaben eingeben.');
    if(!firstInvalid) firstInvalid = phoneInput;
  }

  if(callbackSelect && phoneInput && callbackSelect.value === 'Ja' && phoneInput.value.trim() === ''){
    setFieldError(phoneInput, 'Bitte Telefonnummer für den gewünschten Rückruf eingeben.');
    if(!firstInvalid) firstInvalid = phoneInput;
  }

  if(firstInvalid){
    firstInvalid.scrollIntoView({ behavior:'smooth', block:'center' });
    setTimeout(() => firstInvalid.focus(), 350);
    return false;
  }

  return true;
}

/* =========================
   POPUP
========================= */

function showPopup(success, title, message){
  const popup = document.getElementById('formPopup');
  const icon = document.getElementById('popupIcon');
  const popupTitle = document.getElementById('popupTitle');
  const popupMessage = document.getElementById('popupMessage');

  if(!popup || !icon || !popupTitle || !popupMessage) return;

  icon.textContent = success ? '✓' : '!';
  icon.style.background = success ? '#0e4e2d' : '#b42318';
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  popup.classList.add('show');
}

const popupClose = document.getElementById('popupClose');

if(popupClose){
  popupClose.addEventListener('click', () => {
    const popup = document.getElementById('formPopup');
    if(popup) popup.classList.remove('show');
  });
}

/* =========================
   FORMULAR-TRACKING
========================= */

const formStates = new WeakMap();

function getFormType(form){
  const raw = form.querySelector('input[name="form_type"]') ? form.querySelector('input[name="form_type"]').value : '';

  if(raw === 'firmen') return 'firmen';
  return 'privat';
}

function getFormEventName(form, eventPart){
  return 'form_' + eventPart + '_' + getFormType(form);
}

function getFieldLabel(input){
  const field = input.closest('.form-field');
  const label = field ? field.querySelector('label') : null;
  return cleanText(label ? label.textContent : input.name || input.type || 'Feld')
    .replace('*', '')
    .trim();
}

function getRequiredFilled(form){
  const required = Array.from(form.querySelectorAll('[required]'));
  const total = required.length;
  let filled = 0;

  required.forEach(input => {
    if(input.type === 'checkbox'){
      if(input.checked) filled++;
      return;
    }

    if(input.value && input.value.trim() !== ''){
      filled++;
    }
  });

  return filled + '/' + total;
}

function ensureFormState(form){
  if(!formStates.has(form)){
    formStates.set(form, {
      viewed:false,
      started:false,
      submitted:false,
      lastField:'',
      startedAt:0
    });
  }

  return formStates.get(form);
}

document.querySelectorAll('.ajax-form').forEach(form => {
  const state = ensureFormState(form);

  if('IntersectionObserver' in window){
    const formObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting && !state.viewed){
          state.viewed = true;

          sendTracking(getFormEventName(form, 'view'), {
            form_kind:getFormType(form),
            click_area:'kontakt'
          });
        }
      });
    }, { threshold:.25 });

    formObserver.observe(form);
  }else{
    state.viewed = true;
    sendTracking(getFormEventName(form, 'view'), {
      form_kind:getFormType(form),
      click_area:'kontakt'
    });
  }

  form.querySelectorAll('input, select, textarea').forEach(input => {
    if(input.name === 'website') return;

    const markProgress = () => {
      const currentState = ensureFormState(form);
      currentState.lastField = getFieldLabel(input);

      if(!currentState.started){
        currentState.started = true;
        currentState.startedAt = Date.now();

        sendTracking(getFormEventName(form, 'start'), {
          form_kind:getFormType(form),
          last_field:currentState.lastField,
          required_filled:getRequiredFilled(form),
          click_area:'kontakt'
        });
      }else{
        sendTracking(getFormEventName(form, 'progress'), {
          form_kind:getFormType(form),
          last_field:currentState.lastField,
          required_filled:getRequiredFilled(form),
          click_area:'kontakt'
        });
      }
    };

    input.addEventListener('input', markProgress);
    input.addEventListener('change', markProgress);
  });
});

window.addEventListener('pagehide', () => {
  document.querySelectorAll('.ajax-form').forEach(form => {
    const state = ensureFormState(form);

    if(state.started && !state.submitted){
      const seconds = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : '';

      sendTracking(getFormEventName(form, 'abandon'), {
        form_kind:getFormType(form),
        last_field:state.lastField,
        required_filled:getRequiredFilled(form),
        duration_seconds:seconds,
        click_area:'kontakt'
      });
    }
  });
});

/* =========================
   FORMULAR ABSENDEN
========================= */

document.querySelectorAll('.ajax-form').forEach(form => {
  const button = form.querySelector('.submit-btn');
  const defaultButtonText = form.dataset.buttonText || 'Anfrage senden';

  form.addEventListener('submit', async function(event){
    event.preventDefault();

    if(!validateCustomForm(form)){
      return;
    }

    if(button){
      button.disabled = true;
      button.textContent = 'Wird gesendet...';
    }

    const formData = new FormData(form);

    try{
      await fetch(form.action, {
        method:'POST',
        body:formData,
        mode:'no-cors'
      });

      const state = ensureFormState(form);
      state.submitted = true;

      sendTracking(getFormEventName(form, 'submit'), {
        target:getFormType(form) === 'firmen' ? 'Firmenkunden Formular' : 'Privatkunden Formular',
        form_kind:getFormType(form),
        last_field:state.lastField,
        required_filled:getRequiredFilled(form),
        click_area:'kontakt'
      });

      form.reset();
      clearFormErrors(form);

      document.querySelectorAll('textarea[maxlength]').forEach(textarea => {
        textarea.dispatchEvent(new Event('input'));
      });

      document.querySelectorAll('.found-select').forEach(select => {
        select.dispatchEvent(new Event('change'));
      });

      showPopup(
        true,
        'Anfrage gesendet',
        'Vielen Dank. Ihre Anfrage wurde übermittelt. Wir melden uns schnellstmöglich zurück.'
      );
    }catch(error){
      showPopup(
        false,
        'Anfrage konnte nicht gesendet werden',
        'Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt per Telefon oder WhatsApp.'
      );
    }finally{
      if(button){
        button.disabled = false;
        button.textContent = defaultButtonText;
      }
    }
  });
});


/* Mobile-Menü: nur öffnen, wenn man es braucht */
(function(){
  const menuButton = document.querySelector('.mobile-menu-toggle');
  const nav = document.querySelector('.nav');

  if(menuButton && nav){
    menuButton.addEventListener('click', function(){
      const isOpen = nav.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      menuButton.textContent = isOpen ? 'Schließen' : 'Menü';
    });
  }

  document.querySelectorAll('.dropbtn').forEach(button => {
    button.addEventListener('click', function(event){
      if(window.innerWidth > 900) return;

      event.preventDefault();
      event.stopPropagation();

      const currentDropdown = button.closest('.dropdown');
      if(!currentDropdown) return;

      document.querySelectorAll('.dropdown.open').forEach(dropdown => {
        if(dropdown !== currentDropdown){
          dropdown.classList.remove('open');
        }
      });

      currentDropdown.classList.toggle('open');
    });
  });

  document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', function(){
      if(nav) nav.classList.remove('open');
      if(menuButton){
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = 'Menü';
      }
      document.querySelectorAll('.dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));

      /* force-close nur mobil sofort aufheben.
         Auf dem Desktop schliesst es das Dropdown nach dem Klick kurz weg. */
      if(window.innerWidth <= 900){
        document.querySelectorAll('.dropdown.force-close').forEach(dropdown => dropdown.classList.remove('force-close'));
      }
    });
  });

  window.addEventListener('resize', function(){
    if(window.innerWidth > 900){
      if(nav) nav.classList.remove('open');
      if(menuButton){
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = 'Menü';
      }
      document.querySelectorAll('.dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    }
  });
})();

/* =========================
   SAISON-VORMERKUNG
   Laub & Winterdienst
========================= */

(function(){

  /* --- Hier laesst sich die Aktion steuern, ohne Programmierkenntnisse ---
     SAISON_AN         : false schaltet das Fenster komplett ab
     SAISON_START_MONAT: ab welchem Monat es erscheint (8 = August)
     SAISON_ENDE_MONAT : bis einschliesslich welchem Monat (2 = Februar)
     VERZOEGERUNG_MS   : wie lange nach dem Oeffnen der Seite (300 = knapp sofort) */
  const SAISON_AN          = true;
  const SAISON_START_MONAT = 8;
  const SAISON_ENDE_MONAT  = 2;
  const VERZOEGERUNG_MS    = 300;

  const popup = document.getElementById('saisonPopup');
  if(!popup) return;

  const form = popup.querySelector('.season-form');
  function inSaison(){
    const monat = new Date().getMonth() + 1;

    if(SAISON_START_MONAT <= SAISON_ENDE_MONAT){
      return monat >= SAISON_START_MONAT && monat <= SAISON_ENDE_MONAT;
    }

    return monat >= SAISON_START_MONAT || monat <= SAISON_ENDE_MONAT;
  }

  function istGeoeffnet(){
    return popup.classList.contains('show');
  }

  function oeffnen(quelle){
    if(istGeoeffnet()) return;

    popup.classList.add('show');
    document.body.style.overflow = 'hidden';

    const erstesFeld = form ? form.querySelector('input[name="E-Mail"]') : null;
    if(erstesFeld && window.innerWidth > 900) erstesFeld.focus();

    sendTracking('saison_popup_open', {
      target:'Saison-Vormerkung',
      value:quelle,
      click_area:'saison'
    });
  }

  function schliessen(quelle){
    if(!istGeoeffnet()) return;

    popup.classList.remove('show');
    document.body.style.overflow = '';

    if(quelle){
      sendTracking('saison_popup_close', {
        target:'Saison-Vormerkung',
        value:quelle,
        click_area:'saison'
      });
    }
  }

  /* Banner-Button und jeder andere Ausloeser mit der Klasse season-open */
  document.querySelectorAll('.season-open').forEach(button => {
    button.addEventListener('click', function(){
      oeffnen('Banner');
    });
  });

  popup.querySelectorAll('.season-dismiss').forEach(button => {
    button.addEventListener('click', function(){
      schliessen('Später');
    });
  });

  /* Klick auf den Hintergrund schliesst, Klick in die Box nicht */
  popup.addEventListener('click', function(event){
    if(event.target === popup) schliessen('Hintergrund');
  });

  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape') schliessen('Esc');
  });

  /* Nachricht-Feld befuellen, bevor das allgemeine Formular-Skript die Daten einsammelt.
     Laeuft in der Capture-Phase am document und damit garantiert vor dem Absende-Listener. */
  if(form){
    document.addEventListener('submit', function(event){
      if(event.target !== form) return;

      const interesse = form.querySelector('.season-interest');
      const einwilligung = form.querySelector('.season-consent');
      const nachricht = form.querySelector('input[name="Nachricht"]');
      if(!nachricht) return;

      const zeilen = [
        'Vormerkung über das Saison-Fenster (' + getPageSource() + ').',
        'Interesse: ' + (interesse && interesse.value ? interesse.value : 'nicht angegeben') + '.',
        'Zeitpunkt: ' + new Date().toLocaleString('de-DE') + '.'
      ];

      if(einwilligung && einwilligung.checked){
        zeilen.push(
          'Einwilligung für künftige Saison-Angebote erteilt. Wortlaut: "Freiwillig: Ich möchte auch künftig ' +
          'Saison-Angebote per E-Mail erhalten. Diese Einwilligung kann ich jederzeit formlos widerrufen." ' +
          'Hinweis: Vor dem Versand von Werbe-E-Mails ist eine Bestätigung durch den Empfänger einzuholen.'
        );
      }else{
        zeilen.push('Keine Einwilligung für künftige Werbe-E-Mails – nur einmaliges Angebot zulässig.');
      }

      nachricht.value = zeilen.join(' ');
    }, true);

    /* Nach erfolgreichem Absenden das Fenster schliessen, damit die
       gruene Bestaetigung frei liegt, und kuenftig nicht mehr zeigen. */
    form.addEventListener('submit', function(){
      /* Das allgemeine Formular-Skript hat zu diesem Zeitpunkt bereits geprueft.
         Bei Fehlern bleibt das Fenster offen, damit die Meldungen sichtbar sind. */
      if(form.querySelector('.form-field.invalid')) return;

      window.setTimeout(function(){
        schliessen('');
      }, 60);
    });
  }

  /* Automatisches Oeffnen bei jedem Seitenaufruf - so gewuenscht.
     Es wird bewusst nichts im Browser gemerkt, auch nicht nach dem Absenden. */
  if(!SAISON_AN) return;
  if(!inSaison()) return;

  window.setTimeout(function(){
    const aktiv = document.activeElement;
    const tippt = aktiv && ['INPUT','TEXTAREA','SELECT'].indexOf(aktiv.tagName) !== -1;

    /* Niemand wird beim Ausfuellen des Kontaktformulars unterbrochen,
       und die Erfolgsmeldung wird nicht ueberdeckt. */
    if(tippt) return;

    const erfolgsPopup = document.getElementById('formPopup');
    if(erfolgsPopup && erfolgsPopup.classList.contains('show')) return;

    oeffnen('Automatisch');
  }, VERZOEGERUNG_MS);

})();
