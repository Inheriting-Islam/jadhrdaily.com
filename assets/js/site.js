/* ============================================================================
   JADHR — jadhrapp.com
   Reveal-on-scroll, day one of the game, and the waitlist form. No trackers
   and no third-party requests; the only network call this page can make is the
   one the visitor starts by submitting their own email address.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reveal on scroll ---------------------------------------------
     Classes are added here rather than in the markup, so a visitor with
     JavaScript off gets the whole page rather than a blank one. */
  if (!reduced && 'IntersectionObserver' in window) {
    var targets = document.querySelectorAll(
      '.hero-lead, .hero-act, .hero-art, .shead, .step, .stat, .nevers li, .status-in > *, .wait-copy, .signup-lg'
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

  /* ---- day one ------------------------------------------------------
     The real first move of the real game, for one root, with no account and
     nothing to install. The markup already contains the answer — this takes
     it away, asks for it back, and gives it up either way after three tries:
     losing the puzzle must never cost you the root. That is a promise made
     further down this page, so the page had better keep it. */
  var hunt = document.getElementById('hunt');
  var bloom = document.getElementById('bloom');

  if (hunt && bloom) {
    var ANSWER = ['ص', 'ب', 'ر'];
    var TRIES = 3;

    var slots = [].slice.call(document.querySelectorAll('.slot'));
    var keys = [].slice.call(document.querySelectorAll('.key'));
    var slotBox = document.getElementById('slots');
    var lock = document.getElementById('hunt-lock');
    var clear = document.getElementById('hunt-clear');
    var say = document.getElementById('hunt-say');
    var triesEl = document.getElementById('hunt-tries');
    var picked = [null, null, null];
    var left = TRIES;
    var ORDINAL = ['First', 'Second', 'Third'];

    bloom.hidden = true;
    hunt.hidden = false;

    var paint = function () {
      slots.forEach(function (s, i) {
        s.textContent = picked[i] || '';
        s.classList.toggle('filled', !!picked[i]);
        s.setAttribute('aria-label', ORDINAL[i] + ' radical, ' + (picked[i] || 'empty'));
      });
      keys.forEach(function (k) {
        k.classList.toggle('used', picked.indexOf(k.dataset.letter) > -1);
      });
      lock.disabled = picked.indexOf(null) > -1;
    };

    var reveal = function (won) {
      hunt.hidden = true;
      bloom.hidden = false;
      document.getElementById('bloom-cap').textContent = won ? 'You found it' : 'Here it is anyway';
      document.getElementById('bloom-next').hidden = false;
      if (!won) {
        var foot = document.querySelector('.xray-foot');
        if (foot) foot.textContent = 'Losing the puzzle never costs you the root.';
      }
      /* Nothing is stored and nothing is sent. The state of a puzzle played on
         a landing page is not information worth keeping about a person. */
    };

    keys.forEach(function (k) {
      k.addEventListener('click', function () {
        var slot = picked.indexOf(null);
        if (slot < 0) return;
        picked[slot] = k.dataset.letter;
        say.textContent = '';
        say.classList.remove('bad');
        paint();
      });
    });

    slots.forEach(function (s, i) {
      s.addEventListener('click', function () {
        if (!picked[i]) return;
        picked[i] = null;
        paint();
      });
    });

    clear.addEventListener('click', function () {
      picked = [null, null, null];
      say.textContent = '';
      say.classList.remove('bad');
      paint();
    });

    lock.addEventListener('click', function () {
      if (picked.indexOf(null) > -1) return;

      if (picked.join('') === ANSWER.join('')) { reveal(true); return; }

      left -= 1;
      triesEl.textContent = left === 1 ? '1 attempt' : left + ' attempts';
      if (left <= 0) { reveal(false); return; }

      slotBox.classList.add('wrong');
      setTimeout(function () { slotBox.classList.remove('wrong'); }, 420);
      say.textContent = 'Not those three. Read the words again — what survives every change?';
      say.classList.add('bad');
      picked = [null, null, null];
      paint();
    });

    paint();
  }

  /* ---- the waitlist -------------------------------------------------
     Posts to whatever `data-endpoint` names. Left empty it falls back to
     composing the message in the visitor's own mail client, which works from
     the first minute and is honest about being manual — but it converts
     badly, so it is a stopgap, not the design. See the README. */
  var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.querySelectorAll('form.signup').forEach(function (form) {
    var note = form.querySelector('.formnote');
    var button = form.querySelector('button[type=submit]');
    var emailEl = form.querySelector('[name=email]');
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();

    var complain = function (msg) {
      note.textContent = msg;
      note.classList.add('err');
      if (emailEl) emailEl.focus();
    };

    var done = function () {
      form.innerHTML =
        '<p class="signed"><b>You are on the list.</b> The first root lands on Friday. ' +
        'When the app opens you will get one note, and that is the last thing I will ask of you.</p>';
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (emailEl && emailEl.value || '').trim();

      if (!valid.test(email)) {
        complain('That email does not look right — check it and try again.');
        return;
      }
      note.classList.remove('err');

      /* No endpoint configured yet: compose the mail instead of pretending. */
      if (!endpoint) {
        var body = [
          'Assalamu alaikum,', '',
          'Please add me to the Jadhr list — a root a week, and a note when the app opens.',
          '', 'Email: ' + email, '', '— sent from jadhrapp.com'
        ].join('\r\n');
        window.location.href = 'mailto:' + form.getAttribute('data-to') +
          '?subject=' + encodeURIComponent(form.getAttribute('data-subject') || 'Jadhr') +
          '&body=' + encodeURIComponent(body);
        note.textContent = 'Your mail app is opening with the message written — send it and you are on the list.';
        return;
      }

      button.disabled = true;
      var label = button.textContent;
      button.textContent = 'Adding you…';
      note.textContent = '';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: 'jadhrapp.com' })
      }).then(function (res) {
        if (!res.ok && res.status !== 409) throw new Error(res.status);
        done();
      }).catch(function () {
        button.disabled = false;
        button.textContent = label;
        complain('That did not go through. Try again, or write to hamza@inheritingislam.com.');
      });
    });
  });
})();
