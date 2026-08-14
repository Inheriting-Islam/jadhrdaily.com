/* ============================================================================
   JADHR — jadhrapp.com
   Three small things: a reveal-on-scroll pass, the hero's root x-ray, and a
   mailto composer. No trackers, no third-party requests, no form server —
   nothing on this page phones anywhere.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reveal on scroll ---------------------------------------------
     Classes are added here rather than in the markup, so a visitor with
     JavaScript off gets the whole page rather than a blank one. */
  if (!reduced && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll(
      '.hero-copy, .hero-art, .shead, .step, .stat, .nevers li, .status-in > *, .wait-copy, .signup-lg'
    );
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });

    targets.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (Math.min(i % 6, 5) * 60) + 'ms';
      io.observe(el);
    });

    /* Failsafe. A hidden-until-observed page is one broken observer away from
       being a blank page, which is not a trade worth making for a fade. */
    setTimeout(function () {
      targets.forEach(function (el) { el.classList.add('in'); });
    }, 4000);
  }

  /* ---- the root x-ray -----------------------------------------------
     Walks the word family so the three radicals stay put while everything
     around them changes. Pauses when it is off screen or under the pointer:
     an animation nobody is watching is just battery. */
  var xray = document.getElementById('xray');
  if (xray && !reduced) {
    var forms = Array.prototype.slice.call(xray.querySelectorAll('.form'));
    if (forms.length > 1) {
      var at = 0, timer = null, held = false;

      var show = function (i) {
        at = (i + forms.length) % forms.length;
        forms.forEach(function (f, n) { f.classList.toggle('is-on', n === at); });
      };
      var start = function () { if (!timer && !held) timer = setInterval(function () { show(at + 1); }, 2600); };
      var stop = function () { clearInterval(timer); timer = null; };

      forms.forEach(function (f, n) {
        f.addEventListener('mouseenter', function () { held = true; stop(); show(n); });
        f.addEventListener('mouseleave', function () { held = false; start(); });
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries[0].isIntersecting ? start() : stop();
        }, { threshold: .25 }).observe(xray);
      } else {
        start();
      }
      document.addEventListener('visibilitychange', function () {
        document.hidden ? stop() : start();
      });
    }
  }

  /* ---- mailto composer ----------------------------------------------
     There is no form backend, and rather than fake a subscription we open a
     complete message in the visitor's own mail app and say plainly what just
     happened. Swapping in a real endpoint later means replacing this one
     handler; the markup does not change. */
  var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.querySelectorAll('form[data-to]').forEach(function (form) {
    var note = form.querySelector('.formnote');
    var to = form.getAttribute('data-to');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var emailEl = form.querySelector('[name=email]');
      var email = (emailEl && emailEl.value || '').trim();
      var name = ((form.querySelector('[name=name]') || {}).value || '').trim();

      if (!valid.test(email)) {
        if (note) { note.textContent = 'That email does not look right — check it and try again.'; note.classList.add('err'); }
        if (emailEl) emailEl.focus();
        return;
      }
      if (note) note.classList.remove('err');

      var body = [
        'Assalamu alaikum,',
        '',
        'Please add me to the Jadhr waitlist. Write to me once, when it opens.',
        '',
        'Name:  ' + (name || '—'),
        'Email: ' + email,
        '',
        '— sent from jadhrapp.com'
      ].join('\r\n');

      var href = 'mailto:' + to +
        '?subject=' + encodeURIComponent(form.getAttribute('data-subject') || 'Jadhr waitlist') +
        '&body=' + encodeURIComponent(body);

      window.location.href = href;

      if (note) {
        note.textContent = 'Your mail app is opening with the message written — send it and you are on the list.';
      }
    });
  });
})();
