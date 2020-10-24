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
  const input = search.querySelector('.search-input');

  input.addEventListener('keypress', (e) => {
    search.classList.add('active');
    const code = e.code || e.key;
    if (code === 'Escape') {
      input.value = '';
      search.classList.remove('active');
    } else if (code === 'Enter') {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(input.value)}`;
    }
  });
})();
