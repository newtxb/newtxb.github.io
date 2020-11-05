// ---------------------------------------------------------------------------------------------- //
// CLOCK & DATE
// ---------------------------------------------------------------------------------------------- //

(() => {
  // To render the date only once per day
  let currentDate = -1;

  // Render the clock digits
  const render = (onlySecond = false) => {
    [...(onlySecond ? [] : ['Hours', 'Minutes']), 'Seconds'].forEach((x) => {
      const text = new Date()[`get${x}`]().toString().padStart(2, '0');
      document.querySelector(`.clock .${x.toLowerCase()}`).textContent = text;
    });
    const hours = new Date().getHours();
    let text;
    if (hours >= 5 && hours < 12) text = 'Good morning';
    else if (hours >= 12 && hours < 18) text = 'Good afternoon';
    else text = 'Good evening';
    document.querySelector('.welcome-text').textContent = text;

    if (!onlySecond) {
      if (new Date().getDate() === currentDate) return;
      currentDate = new Date().getDate();
      document.querySelector('.calendar').textContent = new Date()
        .toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  };

  // Keep it sync with real time
  const renderEveryMinute = () => {
    render(false);
    const nextMinute = new Date().setSeconds(60, 0) - Date.now();
    // Big timeout can be unprecise, so we will adjust to the millisecond one second before
    setTimeout(renderEveryMinute, nextMinute > 1500 ? nextMinute - 1000 : nextMinute);
  };

  renderEveryMinute();
  window.addEventListener('focus', render);

  // Show seconds on hover
  let renderNextSecond = false;
  const renderEverySecond = () => {
    // Render again, even if renderNextSecond = false, as mouse may leave few millis before rerender
    // So we want to update second during it's transition to opacity = 0
    render(true);
    if (!renderNextSecond) return;
    setTimeout(renderEverySecond, 1000 - (new Date().getTime() % 1000));
  };

  document.querySelector('.clock').addEventListener('mouseenter', () => {
    renderNextSecond = true;
    renderEverySecond();
  });

  document.querySelector('.clock').addEventListener('mouseleave', () => {
    renderNextSecond = false;
  });
})();

// ---------------------------------------------------------------------------------------------- //
// SEARCH
// ---------------------------------------------------------------------------------------------- //

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
    // As length of `A` `É` = 1, and `Meta` `ShiftLeft` > 1
    if (e.key.length === 1) {
      // But ignore special action
      if (e.metaKey) return;
      input.focus();
    }
  });
})();
