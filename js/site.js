/* =========================================================
   AlltagsHilfe Service – Bedienung der Webseite
   ---------------------------------------------------------
   Navigation, Formularpruefung, Popup und Kleinigkeiten.
   Lag frueher inline in jeder HTML-Datei.

   Die Messung steckt bewusst nicht hier drin. Diese Datei
   meldet nur zwei eigene Ereignisse am Formular:
     ahs:form-invalid    Pruefung fehlgeschlagen
     ahs:form-submitted  erfolgreich uebermittelt
   js/tracking.js hoert darauf, wenn es geladen ist.
========================================================= */

(function (window, document) {
  'use strict';

  /* =========================
     KOPFZEILE UND EINBLENDUNGEN
  ========================= */

  function setupHeader() {
    var header = document.querySelector('.header');
    if (!header) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  function setupReveal() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length || !('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
        } else {
          entry.target.classList.remove('show');
        }
      });
    }, { threshold: 0.12 });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function setupBackToTop() {
    document.querySelectorAll('.back-to-top').forEach(function (button) {
      button.addEventListener('click', function () {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      });
    });
  }

  function setupDateFields() {
    var today = new Date().toISOString().split('T')[0];

    document.querySelectorAll('.date-field').forEach(function (field) {
      field.setAttribute('min', today);
    });
  }

  /* =========================
     NAVIGATION
  ========================= */

  function setupDropdownClose() {
    document.querySelectorAll('.dropdown-content a').forEach(function (link) {
      link.addEventListener('click', function () {
        var dropdown = link.closest('.dropdown');
        if (!dropdown) return;

        dropdown.classList.add('force-close');

        window.setTimeout(function () {
          dropdown.classList.remove('force-close');
        }, 700);
      });
    });
  }

  function setupMobileMenu() {
    var menuButton = document.querySelector('.mobile-menu-toggle');
    var nav = document.querySelector('.nav');

    function closeMenu() {
      if (nav) nav.classList.remove('open');

      if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = 'Menü';
      }

      document.querySelectorAll('.dropdown.open').forEach(function (dropdown) {
        dropdown.classList.remove('open');
      });
    }

    if (menuButton && nav) {
      menuButton.addEventListener('click', function () {
        var isOpen = nav.classList.toggle('open');
        menuButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        menuButton.textContent = isOpen ? 'Schließen' : 'Menü';
      });
    }

    document.querySelectorAll('.dropbtn').forEach(function (button) {
      button.addEventListener('click', function (event) {
        if (window.innerWidth > 900) return;

        event.preventDefault();
        event.stopPropagation();

        var currentDropdown = button.closest('.dropdown');
        if (!currentDropdown) return;

        document.querySelectorAll('.dropdown.open').forEach(function (dropdown) {
          if (dropdown !== currentDropdown) dropdown.classList.remove('open');
        });

        currentDropdown.classList.toggle('open');
      });
    });

    document.querySelectorAll('.nav a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu();

        /* force-close nur mobil sofort aufheben.
           Auf dem Desktop schliesst es das Dropdown nach dem Klick kurz weg. */
        if (window.innerWidth <= 900) {
          document.querySelectorAll('.dropdown.force-close').forEach(function (dropdown) {
            dropdown.classList.remove('force-close');
          });
        }
      });
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  /* =========================
     FORMULARFELDER
  ========================= */

  function updateCounter(textarea) {
    var field = textarea.closest('.form-field');
    var counter = field ? field.querySelector('.char-counter') : null;
    if (!counter) return;

    counter.textContent = textarea.value.length + ' / ' + textarea.getAttribute('maxlength') + ' Zeichen';
  }

  function setupCharCounters(scope) {
    (scope || document).querySelectorAll('textarea[maxlength]').forEach(function (textarea) {
      if (!textarea.dataset.counterReady) {
        textarea.dataset.counterReady = '1';
        textarea.addEventListener('input', function () {
          updateCounter(textarea);
        });
      }

      updateCounter(textarea);
    });
  }

  function toggleFoundOther(select) {
    var form = select.closest('form');
    if (!form) return;

    var wrap = form.querySelector('.found-other-wrap');
    var input = form.querySelector('input[name="GefundenSonstiges"]');
    if (!wrap || !input) return;

    if (select.value === 'Sonstiges') {
      wrap.style.display = 'block';
      input.required = true;
    } else {
      wrap.style.display = 'none';
      input.required = false;
      input.value = '';
    }
  }

  function setupFoundSelects(scope) {
    (scope || document).querySelectorAll('.found-select').forEach(function (select) {
      if (!select.dataset.foundReady) {
        select.dataset.foundReady = '1';
        select.addEventListener('change', function () {
          toggleFoundOther(select);
        });
      }

      toggleFoundOther(select);
    });
  }

  /* =========================
     PRUEFUNG
  ========================= */

  function clearFormErrors(form) {
    form.querySelectorAll('.form-field').forEach(function (field) {
      field.classList.remove('invalid');

      var error = field.querySelector('.error-message');
      if (error) error.textContent = '';
    });
  }

  function setFieldError(input, message) {
    var field = input.closest('.form-field');
    if (!field) return;

    field.classList.add('invalid');

    var error = field.querySelector('.error-message');
    if (error) error.textContent = message || 'Bitte dieses Feld ausfüllen.';
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function isValidPhone(value) {
    if (!value || value.trim() === '') return true;

    var cleaned = value.trim();
    var allowedCharacters = /^[0-9+()\/\-\s]+$/.test(cleaned);
    var digits = cleaned.replace(/\D/g, '');

    return allowedCharacters && digits.length >= 6 && digits.length <= 15;
  }

  function isValidGermanPlz(value) {
    return /^[0-9]{5}$/.test((value || '').trim());
  }

  function validateCustomForm(form) {
    clearFormErrors(form);

    var firstInvalid = null;

    function fail(input, message) {
      setFieldError(input, message);
      if (!firstInvalid) firstInvalid = input;
    }

    form.querySelectorAll('[required]').forEach(function (input) {
      if (input.type === 'checkbox') {
        if (!input.checked) fail(input, input.dataset.error);
        return;
      }

      if (!input.value || input.value.trim() === '') {
        fail(input, input.dataset.error);
      }
    });

    var emailInput = form.querySelector('input[name="E-Mail"]');
    if (emailInput && emailInput.value.trim() !== '' && !isValidEmail(emailInput.value.trim())) {
      fail(emailInput, emailInput.dataset.error || 'Bitte eine gültige E-Mail-Adresse eingeben.');
    }

    var plzInput = form.querySelector('input[name="PLZ"]');
    if (plzInput && plzInput.value.trim() !== '' && !isValidGermanPlz(plzInput.value.trim())) {
      fail(plzInput, plzInput.dataset.error || 'Bitte eine gültige 5-stellige PLZ eingeben.');
    }

    var callbackSelect = form.querySelector('.callback-select');
    var phoneInput = form.querySelector('input[name="Telefon"]');

    if (phoneInput && phoneInput.value.trim() !== '' && !isValidPhone(phoneInput.value.trim())) {
      fail(phoneInput, 'Bitte eine gültige Telefonnummer ohne Buchstaben eingeben.');
    }

    if (callbackSelect && phoneInput && callbackSelect.value === 'Ja' && phoneInput.value.trim() === '') {
      fail(phoneInput, 'Bitte Telefonnummer für den gewünschten Rückruf eingeben.');
    }

    if (firstInvalid) {
      var field = firstInvalid.closest('.form-field');
      var label = field ? field.querySelector('label') : null;

      form.dispatchEvent(new CustomEvent('ahs:form-invalid', {
        detail: { field: (label ? label.textContent : firstInvalid.name || '').replace('*', '').trim() }
      }));

      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(function () {
        firstInvalid.focus();
      }, 350);

      return false;
    }

    return true;
  }

  /* =========================
     POPUP
  ========================= */

  function showPopup(success, title, message) {
    var popup = document.getElementById('formPopup');
    var icon = document.getElementById('popupIcon');
    var popupTitle = document.getElementById('popupTitle');
    var popupMessage = document.getElementById('popupMessage');

    if (!popup || !icon || !popupTitle || !popupMessage) return;

    icon.textContent = success ? '✓' : '!';
    icon.style.background = success ? '#0e4e2d' : '#b42318';
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popup.classList.add('show');
  }

  function setupPopupClose() {
    var popupClose = document.getElementById('popupClose');
    if (!popupClose) return;

    popupClose.addEventListener('click', function () {
      var popup = document.getElementById('formPopup');
      if (popup) popup.classList.remove('show');
    });
  }

  /* =========================
     ABSENDEN
  ========================= */

  function setupForms() {
    document.querySelectorAll('.ajax-form').forEach(function (form) {
      var button = form.querySelector('.submit-btn');
      var defaultButtonText = form.dataset.buttonText || 'Anfrage senden';

      form.addEventListener('submit', function (event) {
        event.preventDefault();

        if (!validateCustomForm(form)) return;

        if (button) {
          button.disabled = true;
          button.textContent = 'Wird gesendet...';
        }

        var formData = new FormData(form);

        window.fetch(form.action, {
          method: 'POST',
          body: formData,
          mode: 'no-cors'
        }).then(function () {
          form.dispatchEvent(new CustomEvent('ahs:form-submitted'));

          form.reset();
          clearFormErrors(form);
          setupCharCounters(form);
          setupFoundSelects(form);

          showPopup(
            true,
            'Anfrage gesendet',
            'Vielen Dank. Ihre Anfrage wurde übermittelt. Wir melden uns schnellstmöglich zurück.'
          );
        }).catch(function () {
          showPopup(
            false,
            'Anfrage konnte nicht gesendet werden',
            'Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt per Telefon oder WhatsApp.'
          );
        }).then(function () {
          if (button) {
            button.disabled = false;
            button.textContent = defaultButtonText;
          }
        });
      });
    });
  }

  /* =========================
     DATENSCHUTZ: MESSUNG ABSCHALTEN
  ========================= */

  function setupTrackingSwitch() {
    var button = document.getElementById('trackingOptOut');
    var status = document.getElementById('trackingStatus');
    if (!button) return;

    function render() {
      var tracking = window.AhsTracking;
      var optedOut = tracking ? tracking.isOptedOut() : false;

      button.textContent = optedOut ? 'Auswertung wieder erlauben' : 'Auswertung deaktivieren';

      if (status) {
        status.textContent = optedOut
          ? 'Die interne Reichweitenmessung ist auf diesem Gerät deaktiviert.'
          : 'Die interne Reichweitenmessung ist auf diesem Gerät aktiv.';
      }
    }

    button.addEventListener('click', function () {
      var tracking = window.AhsTracking;
      if (!tracking) return;

      if (tracking.isOptedOut()) {
        tracking.optIn();
      } else {
        tracking.optOut();
      }

      render();
    });

    render();
  }

  /* =========================
     START
  ========================= */

  function boot() {
    setupHeader();
    setupReveal();
    setupBackToTop();
    setupDateFields();
    setupDropdownClose();
    setupMobileMenu();
    setupCharCounters();
    setupFoundSelects();
    setupPopupClose();
    setupForms();
    setupTrackingSwitch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window, document);
