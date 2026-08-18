/* Skript fuer Impressum und Datenschutz: nur Kopfzeile, Menue und
   "Nach oben". Bewusst ohne Reichweitenmessung - diese beiden Seiten
   haben noch nie Daten gesendet, und dabei bleibt es. */
const header = document.querySelector('.header');

if(header){
  window.addEventListener('scroll', () => {
    window.scrollY > 20 ? header.classList.add('scrolled') : header.classList.remove('scrolled');
  });
}

document.querySelectorAll('.back-to-top').forEach(button => {
  button.addEventListener('click', () => {
    window.scrollTo({ top:0, left:0, behavior:'smooth' });
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
      document.querySelectorAll('.dropdown.force-close').forEach(dropdown => dropdown.classList.remove('force-close'));
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
