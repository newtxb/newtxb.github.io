// settings

const SHOW_SECONDS = false;

// clock

(() => {
  if (SHOW_SECONDS) document.querySelector('.clock .show-seconds').style.display = '';

  const draw = () => {
    ['Hours', 'Minutes', ...(SHOW_SECONDS ? ['Seconds'] : [])].forEach((x) => {
      const text = new Date()[`get${x}`]().toString().padStart(2, '0');
      document.querySelector(`.clock .${x.toLowerCase()}`).textContent = text;
    });
    const hours = new Date().getHours();
    let text;
    if (hours >= 5 && hours < 12) text = 'Good morning';
    else if (hours >= 12 && hours < 18) text = 'Good afternoon';
    else text = 'Good evening';
    document.querySelector('.welcome-text').textContent = text;
  };

  draw();
  window.addEventListener('focus', draw);

  // sync

  const redraw = () => {
    draw();
    const nextDraw = SHOW_SECONDS
      ? 1000 - (new Date().getTime() % 1000)
      : new Date().setSeconds(60, 0) - Date.now();
    // "big" timeout can be unprecise
    setTimeout(redraw, nextDraw > 1500 ? nextDraw - 1000 : nextDraw);
  };

  redraw();
})();

// calendar

(() => {
  const draw = () => {
    document.querySelector('.calendar').textContent = new Date()
      .toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });
  };
  draw();

  setInterval(draw, 60000);
})();

// search

(() => {
  const search = document.querySelector('.search');
  const input = search.querySelector('.search-input');
  const form = search.querySelector('.search-form');

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Meta') form.target = '_blank';
    if (e.key === 'Enter') form.submit();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Meta') form.target = '';
  });

  let cleanup = null;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.blur();
      cleanup = setTimeout(() => {
        // Clear input when it's hidden
        input.value = '';
        cleanup = null;
      }, 150);
    }
    e.stopPropagation();
  });

  document.addEventListener('paste', () => {
    // Will paste directly in the search input
    input.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (cleanup) {
      // If we press "Escape" then another key, clean input now (before keyup)
      clearTimeout(cleanup);
      input.value = '';
      cleanup = null;
    }
    if (e.key.length === 1) {
      // As length of `A` `É` = 1, and `Meta` `ShiftLeft` > 1
      input.focus();
    }
  });
})();
