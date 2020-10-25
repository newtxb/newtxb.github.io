// settings

const SHOW_SECONDS = false;

// clock

(() => {
  if (SHOW_SECONDS) document.querySelector('.clock .show-seconds').style.display = '';

  const draw = () => {
    ['Hours', 'Minutes', ...(SHOW_SECONDS ? ['Seconds'] : [])].forEach((x) => {
      document.querySelector(`.clock .${x.toLowerCase()}`).textContent = new Date()[`get${x}`]().toString().padStart(2, '0');
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
    document.querySelector('.calendar').textContent = new Date().toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });
  };
  draw();

  setInterval(draw, 60000);
})();

// search

(() => {
  const search = document.querySelector('.search');
  const label = search.querySelector('.search-label');
  const input = search.querySelector('.search-input');
  const form = search.querySelector('.search-form');

  let cmdPressed = false;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Meta') {
      cmdPressed = true;
      form.target = '_blank';
    }
    if (e.key === 'Enter') form.submit();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Meta') {
      cmdPressed = false;
      form.target = '';
    }
  });

  label.addEventListener('click', (e) => {
    search.classList.add('active');
    e.preventDefault();
    input.focus();
  });

  input.addEventListener('blur', () => {
    if (input.value === '') {
      search.classList.remove('active');
    }
  });

  input.addEventListener('keypress', (e) => {
    search.classList.add('active');
    if (e.key === 'Escape') {
      input.value = '';
      search.classList.remove('active');
    }
    e.stopPropagation();
  });

  document.addEventListener('keypress', () => {
    if (cmdPressed) return;
    input.focus();
    search.classList.add('active');
  });
})();
