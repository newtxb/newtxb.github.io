// settings

const SHOW_SECONDS = false;

// clock

if (SHOW_SECONDS) document.querySelector('.clock .show-seconds').style.display = '';

const draw = () => {
  ['Hours', 'Minutes', ...(SHOW_SECONDS ? ['Seconds'] : [])].forEach((x) => {
    document.querySelector(`.clock .${x.toLowerCase()}`).textContent = new Date()[`get${x}`]().toString().padStart(2, '0');
  });
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
