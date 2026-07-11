// ---------------------------------------------------------------------------------------------- //
// UTILITIES
// ---------------------------------------------------------------------------------------------- //
function title(str) {
  // capitalize first letter of each word
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalize(str) {
  // capitalize first letter
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map(channel => clampByte(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToRgb(hex) {
  const normalized = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbLuma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function lowerColorToMaxLuma(hexColor, maxLuma = 100) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return hexColor;

  const currentLuma = rgbLuma(rgb.r, rgb.g, rgb.b);
  if (currentLuma <= maxLuma) return hexColor;

  const mix = 1 - (maxLuma / currentLuma);
  return rgbToHex(
    rgb.r * (1 - mix),
    rgb.g * (1 - mix),
    rgb.b * (1 - mix),
  );
}

function hslToHex(hue, saturation, lightness) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = normalizedHue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (hp >= 0 && hp < 1) {
    r = c; g = x;
  } else if (hp < 2) {
    r = x; g = c;
  } else if (hp < 3) {
    g = c; b = x;
  } else if (hp < 4) {
    g = x; b = c;
  } else if (hp < 5) {
    r = x; b = c;
  } else {
    r = c; b = x;
  }

  const m = l - c / 2;
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function mixHexColors(fromHex, toHex, amount) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  if (!from || !to) return fromHex;

  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    from.r + (to.r - from.r) * t,
    from.g + (to.g - from.g) * t,
    from.b + (to.b - from.b) * t,
  );
}

const ThemeColor = {
  set(color) {
    if (!color) return;
    document.body.style.backgroundColor = lowerColorToMaxLuma(color);
  }
};

function averageImageColor(image) {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  const cropHeight = Math.min(500, image.naturalHeight || image.height);
  context.drawImage(image, 0, 0, image.naturalWidth || image.width, cropHeight, 0, 0, size, size);

  try {
    const { data } = context.getImageData(0, 0, size, size);
    let red = 0;
    let green = 0;
    let blue = 0;
    let alphaTotal = 0;

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      if (!alpha) continue;

      red += data[index] * alpha;
      green += data[index + 1] * alpha;
      blue += data[index + 2] * alpha;
      alphaTotal += alpha;
    }

    if (!alphaTotal) return null;

    return rgbToHex(red / alphaTotal, green / alphaTotal, blue / alphaTotal);
  } catch (e) {
    return null;
  }
}

// Encryption utilities for Unsplash credentials
const CryptoUtils = {
  // Decrypt password-protected payload using AES-256-GCM with PBKDF2
  async decrypt(encryptedBase64, password) {
    try {
      const combinedBuffer = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

      // Extract components
      const salt = combinedBuffer.slice(0, 16);
      const iv = combinedBuffer.slice(16, 28);
      const authTag = combinedBuffer.slice(28, 44);
      const encryptedData = combinedBuffer.slice(44);

      // Derive key from password
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        passwordKey,
        256
      );

      const key = await crypto.subtle.importKey('raw', derivedBits, 'AES-GCM', false, ['decrypt']);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: new Uint8Array(0),
          tagLength: 128
        },
        key,
        new Uint8Array([...encryptedData, ...authTag])
      );

      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      throw new Error('Invalid password or corrupted data');
    }
  }
};

// ---------------------------------------------------------------------------------------------- //
// PHOTO BLACKLIST MANAGEMENT
// ---------------------------------------------------------------------------------------------- //

const PhotoBlacklist = {
  STORAGE_KEY: 'unsplash-photo-blacklist',
  MAX_SIZE: 30,

  /**
   * Get the current blacklist
   * @returns {string[]} Array of photo IDs
   */
  getList() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to load blacklist:', e);
      return [];
    }
  },

  /**
   * Check if a photo ID is blacklisted
   * @param {string} photoId - The Unsplash photo ID
   * @returns {boolean}
   */
  isBlacklisted(photoId) {
    return this.getList().includes(photoId);
  },

  /**
   * Add a photo ID to the blacklist
   * @param {string} photoId - The Unsplash photo ID
   */
  add(photoId) {
    const list = this.getList();

    // Avoid duplicates
    if (list.includes(photoId)) return;

    // Add to beginning of list
    list.unshift(photoId);

    // Keep only the most recent 30 items
    if (list.length > this.MAX_SIZE) {
      list.pop();
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save blacklist:', e);
    }
  },

  /**
   * Clear the entire blacklist
   */
  clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear blacklist:', e);
    }
  }
};

// ---------------------------------------------------------------------------------------------- //
// UNSPLASH INTEGRATION
// ---------------------------------------------------------------------------------------------- //

const UnsplashBg = {
  ENCRYPTED_CREDS: '0y6Z5ETQz4XPKoWlmPVnY599mr6IfKDfb6SaDtVOat+Q9wI2LpmIDv/DSb78cn/Xoc0DWJKIt9Al7Paf\nEjRhyRJMuwSet9zVGS+x9qojmnnf6HrxUPYZo3gTzN2zlfY+M/KCZd8z0ymjVPfwY9vyg6MVPNiT48TZ\n1gnPJu2r8AKRGDuvJKyAy/pERfz8sY4xrZNOZ/fJsV1wHFDf9cupJBk2Yw=='.replace(/\n/g, ''),

  currentInfo: null,

  setCurrentInfo(info) {
    this.currentInfo = info;
    document.dispatchEvent(new CustomEvent('unsplash:imageInfoChanged', {
      detail: { info },
    }));
  },

  buildImageInfo(image, imageUrl, keyword = '') {
    const description = (image.description || image.alt_description || '').toString().trim();
    const photographer = (image.user?.name || '').toString().trim();

    const queryPart = keyword ? `Searched: ${title(keyword)}. ` : '';
    const descPart = description ? `${capitalize(description)}. ` : '';
    const byPart = photographer ? `By ${photographer}.` : 'From Unsplash.';

    return {
      description: `${queryPart}${descPart}${byPart}`.trim(),
      unsplashUrl: image.links?.html || imageUrl,
      photographer,
      keyword,
      imageUrl,
    };
  },

  async getUnsplashImage(keywords, accessKey) {
    if (!keywords || keywords.length === 0) {
      keywords = ['china', 'japan', 'korea', 'taiwan'];
    }

    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    const params = new URLSearchParams({
      query: keyword,
      client_id: accessKey,
      w: window.innerWidth.toString(),
      h: window.innerHeight.toString(),
      orientation: 'landscape'
    });

    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
        headers: { 'Accept-Version': 'v1' }
      });

      if (!response.ok) throw new Error('Failed to fetch from Unsplash');

      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        throw new Error('No images found');
      }

      // Get the blacklist
      const blacklist = PhotoBlacklist.getList();

      // Filter out blacklisted photos
      const filteredResults = data.results.filter(photo => !blacklist.includes(photo.id));

      // Select from filtered results if available, otherwise from all results
      const selectedResults = filteredResults.length > 0 ? filteredResults : data.results;
      const result = selectedResults[Math.floor(Math.random() * selectedResults.length)];

      result._searchKeyword = keyword;
      return result;
    } catch (e) {
      console.warn('Unsplash fetch failed:', e);
      return null;
    }
  },

  async preloadAndDisplay(imageUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const themeColor = averageImageColor(img);
        if (themeColor) ThemeColor.set(themeColor);

        document.querySelector('.background').style.backgroundImage = `url('${imageUrl}')`;
        document.querySelector('.background').style.backgroundSize = 'cover';
        document.querySelector('.background').style.backgroundPosition = 'center';

        // Fade in with opacity transition
        const bgEl = document.querySelector('.background');
        bgEl.style.opacity = '0';
        bgEl.style.transition = 'opacity 1s ease-in-out';
        setTimeout(() => {
          bgEl.style.opacity = '1';
        }, 10);

        resolve(themeColor);
      };
      img.onerror = resolve;
      img.src = imageUrl;
    });
  },

  async loadDailyImage(accessKey, keywords) {
    const today = new Date().toDateString();
    const cacheKey = `unsplash-bg-${today}`;

    // Check if we already have today's image
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const imageData = JSON.parse(cached);
      if (imageData.info) this.setCurrentInfo(imageData.info);
      if (imageData.themeColor) ThemeColor.set(imageData.themeColor);
      const themeColor = await this.preloadAndDisplay(imageData.url);
      if (themeColor && themeColor !== imageData.themeColor) {
        imageData.themeColor = themeColor;
        localStorage.setItem(cacheKey, JSON.stringify(imageData));
      }
      return;
    }

    // Fetch new image
    const image = await this.getUnsplashImage(keywords, accessKey);
    if (!image) return;

    // Use the full photo URL
    const imageUrl = image.urls.full;
    const info = this.buildImageInfo(image, imageUrl, image._searchKeyword || '');
    const themeColor = await this.preloadAndDisplay(imageUrl);

    // Cache it
    localStorage.setItem(cacheKey, JSON.stringify({
      url: imageUrl,
      date: today,
      info,
      themeColor,
      photoId: image.id,
    }));

    // Add to blacklist to avoid showing it again
    PhotoBlacklist.add(image.id);

    this.setCurrentInfo(info);

    // Display it
    if (themeColor) ThemeColor.set(themeColor);
  }
};

// ---------------------------------------------------------------------------------------------- //
// UPDATER
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const VERSION_KEY = 'current-version';
  const PRECACHE = 'precache-v1';

  let github;
  try {
    // TODO: cache and check every 30m
    const req = await window.fetch('github.json', { cache: 'no-cache' });
    github = await req.json();
  } catch (e) {
    console.warn('Failed to check for update', e);
    return;
  }

  // We are up to date!
  if (github.version === window.localStorage.getItem(VERSION_KEY)) return;

  // We're not... delete the old
  await window.caches.delete(PRECACHE);
  window.localStorage.setItem(VERSION_KEY, github.version);

  const sw = window.navigator.serviceWorker;
  if (!sw || !sw.controller) return;

  sw.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'CACHE_CLEARED') {
      document.querySelector('.update').classList.add('active');
    }
  });

  // And update!
  sw.controller.postMessage({ action: 'CLEAR_CACHE' });
})();

// ---------------------------------------------------------------------------------------------- //
// SETTINGS
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const storageKey = 'home-settings';

  const defaults = {
    showDate: true,
    showQuote: true,
    showWeather: true,
    username: '',
    weatherLocation: '',
    useUnsplash: false,
    unsplashAuthenticated: false,
    unsplashKeywords: 'china;korea;taiwan;taipei;hong kong;seoul;busan;shanghai;guangzhou;chongqing;chengdu;tainan',
  };

  const modal = document.querySelector('.settings-modal');
  const trigger = document.querySelector('.settings-trigger');
  const closeButtons = modal ? modal.querySelectorAll('[data-close-settings]') : [];

  const dateNode = document.querySelector('.calendar')?.parentNode;
  const quoteNode = document.querySelector('.quote')?.parentNode;
  const weatherNode = document.querySelector('.weather')?.parentNode;

  const inputs = {
    showDate: modal?.querySelector('input[name="showDate"]'),
    showQuote: modal?.querySelector('input[name="showQuote"]'),
    showWeather: modal?.querySelector('input[name="showWeather"]'),
    username: modal?.querySelector('input[name="username"]'),
    weatherLocation: modal?.querySelector('input[name="weatherLocation"]'),
    useUnsplash: modal?.querySelector('input[name="useUnsplash"]'),
    unsplashPassword: modal?.querySelector('input[name="unsplashPassword"]'),
    unsplashKeywords: modal?.querySelector('input[name="unsplashKeywords"]'),
  };

  const buttons = {
    unlockUnsplash: modal?.querySelector('[data-unlock-unsplash]'),
    resetUnsplashPhoto: modal?.querySelector('[data-reset-unsplash-photo]'),
  };

  const sections = {
    authSection: modal?.querySelector('[data-auth-section]'),
    keywordsSection: modal?.querySelector('[data-keywords-section]'),
  };

  let settings = { ...defaults };

  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
      settings = {
        ...defaults,
        ...saved,
        username: (saved.username || '').toString().trim(),
        weatherLocation: (saved.weatherLocation || '').toString().trim(),
        unsplashKeywords: (saved.unsplashKeywords || defaults.unsplashKeywords).toString().trim(),
      };
    }
  } catch (e) {
    settings = { ...defaults };
  }

  const save = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  };

  const syncInputs = () => {
    if (!modal) return;
    inputs.showDate.checked = !!settings.showDate;
    inputs.showQuote.checked = !!settings.showQuote;
    inputs.showWeather.checked = !!settings.showWeather;
    inputs.username.value = settings.username || '';
    inputs.weatherLocation.value = settings.weatherLocation || '';
    inputs.useUnsplash.checked = !!settings.useUnsplash;
    inputs.unsplashKeywords.value = settings.unsplashKeywords || defaults.unsplashKeywords;

    // Update UI visibility
    if (sections.authSection) {
      sections.authSection.style.display = settings.useUnsplash && !settings.unsplashAuthenticated ? 'block' : 'none';
    }
    if (sections.keywordsSection) {
      sections.keywordsSection.style.display = settings.useUnsplash ? 'block' : 'none';
    }
    if (buttons.resetUnsplashPhoto) {
      buttons.resetUnsplashPhoto.disabled = !(settings.useUnsplash && settings.unsplashAuthenticated && settings.unsplashAccessKey);
    }
  };

  const applyVisibility = () => {
    if (dateNode) dateNode.classList.toggle('is-hidden', !settings.showDate);
    if (quoteNode) quoteNode.classList.toggle('is-hidden', !settings.showQuote);
    if (weatherNode) weatherNode.classList.toggle('is-hidden', !settings.showWeather);
  };

  const openModal = () => {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  syncInputs();
  applyVisibility();
  save();

  trigger?.addEventListener('click', openModal);
  closeButtons.forEach(button => button.addEventListener('click', closeModal));

  inputs.showDate?.addEventListener('change', () => {
    settings.showDate = inputs.showDate.checked;
    applyVisibility();
    save();
  });

  inputs.showQuote?.addEventListener('change', () => {
    settings.showQuote = inputs.showQuote.checked;
    applyVisibility();
    save();
  });

  inputs.showWeather?.addEventListener('change', () => {
    settings.showWeather = inputs.showWeather.checked;
    applyVisibility();
    save();
  });

  const updateUsername = () => {
    const nextValue = inputs.username.value.trim();
    if (nextValue === settings.username) return;
    settings.username = nextValue;
    save();
    document.dispatchEvent(new CustomEvent('settings:usernameChanged', {
      detail: { username: settings.username },
    }));
  };

  inputs.username?.addEventListener('change', updateUsername);
  inputs.username?.addEventListener('blur', updateUsername);

  const updateWeatherLocation = () => {
    const nextValue = inputs.weatherLocation.value.trim();
    if (nextValue === settings.weatherLocation) return;
    settings.weatherLocation = nextValue;
    save();
    document.dispatchEvent(new CustomEvent('settings:weatherLocationChanged', {
      detail: { weatherLocation: settings.weatherLocation },
    }));
  };

  inputs.weatherLocation?.addEventListener('change', updateWeatherLocation);
  inputs.weatherLocation?.addEventListener('blur', updateWeatherLocation);

  inputs.useUnsplash?.addEventListener('change', () => {
    settings.useUnsplash = inputs.useUnsplash.checked;
    syncInputs();
    save();

    if (settings.useUnsplash && settings.unsplashAuthenticated) {
      // Trigger immediate background update
      document.dispatchEvent(new CustomEvent('settings:unsplashToggled', {
        detail: { enabled: true },
      }));
    }
  });

  buttons.unlockUnsplash?.addEventListener('click', async () => {
    const password = inputs.unsplashPassword.value;
    if (!password) {
      alert('Please enter a password');
      return;
    }

    buttons.unlockUnsplash.disabled = true;
    buttons.unlockUnsplash.textContent = 'Unlocking...';

    try {
      const creds = await CryptoUtils.decrypt(UnsplashBg.ENCRYPTED_CREDS, password);

      // Test the credentials with app-based endpoint
      const testUrl = `https://api.unsplash.com/search/photos?query=test&client_id=${creds.access_key}&per_page=1`;
      const response = await fetch(testUrl);

      if (!response.ok) {
        alert('Invalid password or API key expired');
        buttons.unlockUnsplash.disabled = false;
        buttons.unlockUnsplash.textContent = 'Unlock';
        return;
      }

      // Success! Store encrypted credentials in localStorage
      settings.unsplashAuthenticated = true;
      settings.unsplashAccessKey = creds.access_key;
      save();

      inputs.unsplashPassword.value = '';
      syncInputs();

      alert('✓ Unsplash unlocked! Backgrounds will update with new images each day.');

      // Trigger initial load
      document.dispatchEvent(new CustomEvent('settings:unsplashToggled', {
        detail: { enabled: true },
      }));
    } catch (e) {
      alert('Error: ' + e.message);
      buttons.unlockUnsplash.disabled = false;
      buttons.unlockUnsplash.textContent = 'Unlock';
    }
  });

  const resetBlacklistHistory = async () => {
    if (!(settings.useUnsplash && settings.unsplashAuthenticated && settings.unsplashAccessKey)) return;

    if (buttons.resetUnsplashPhoto) buttons.resetUnsplashPhoto.disabled = true;
    const originalLabel = buttons.resetUnsplashPhoto?.textContent || 'Reset history';
    if (buttons.resetUnsplashPhoto) buttons.resetUnsplashPhoto.textContent = 'Clearing...';

    try {
      // Clear the photo blacklist history
      PhotoBlacklist.clear();

      // Reload today's image with the cleared history
      const keywords = (settings.unsplashKeywords || defaults.unsplashKeywords)
        .split(';')
        .map(k => k.trim())
        .filter(k => k);

      const today = new Date().toDateString();
      const cacheKey = `unsplash-bg-${today}`;
      window.localStorage.removeItem(cacheKey);
      UnsplashBg.setCurrentInfo(null);

      await UnsplashBg.loadDailyImage(settings.unsplashAccessKey, keywords);
    } catch (e) {
      console.warn('Failed to reset blacklist history:', e);
    } finally {
      if (buttons.resetUnsplashPhoto) buttons.resetUnsplashPhoto.textContent = originalLabel;
      syncInputs();
      document.dispatchEvent(new CustomEvent('unsplash:reloadFinished'));
    }
  };

  buttons.resetUnsplashPhoto?.addEventListener('click', async () => {
    await resetBlacklistHistory();
  });

  document.addEventListener('unsplash:reloadToday', async () => {
    await resetBlacklistHistory();
  });

  inputs.unsplashKeywords?.addEventListener('change', () => {
    const nextValue = inputs.unsplashKeywords.value.trim();
    if (nextValue === settings.unsplashKeywords) return;
    settings.unsplashKeywords = nextValue;
    save();
  });

  inputs.unsplashKeywords?.addEventListener('blur', () => {
    const nextValue = inputs.unsplashKeywords.value.trim();
    if (nextValue === settings.unsplashKeywords) return;
    settings.unsplashKeywords = nextValue;
    save();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) {
      e.preventDefault();
      closeModal();
    }
  });

  window.homeSettings = {
    get() {
      return { ...settings };
    },
  };
})();


// ---------------------------------------------------------------------------------------------- //
// BACKGROUND
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const PERIOD = 88500;
  const CYCLE = 60000;

  const background = document.querySelector('.background');

  const gradient = hue => `radial-gradient(ellipse at center -60px, ${[
    `hsl(${hue}, 35%, 50%)`, `hsl(${hue}, 80%, 20%)`,
  ].join(', ')})`;

  const gradientThemeColor = hue => hslToHex(hue, 35, 50);

  let opaqueLayer = null;
  let usingUnsplash = false;
  let themeColorInterval = null;

  const updateGradientThemeColor = () => {
    const from = Date.now() - (Date.now() % CYCLE);
    const to = from + CYCLE;
    const progress = (Date.now() % CYCLE) / CYCLE;
    const fromHex = gradientThemeColor(((from % PERIOD) * 360 / PERIOD).toFixed());
    const toHex = gradientThemeColor(((to % PERIOD) * 360 / PERIOD).toFixed());
    ThemeColor.set(mixHexColors(fromHex, toHex, progress));
  };

  const startGradientThemeColorInterval = () => {
    if (themeColorInterval) return;
    themeColorInterval = setInterval(updateGradientThemeColor, 1000);
  };

  const stopGradientThemeColorInterval = () => {
    if (!themeColorInterval) return;
    clearInterval(themeColorInterval);
    themeColorInterval = null;
  };

  const setUnsplashModeState = (enabled) => {
    usingUnsplash = enabled;
    if (enabled) {
      stopGradientThemeColorInterval();
    }
    document.body.classList.toggle('unsplash-mode', enabled);
    document.dispatchEvent(new CustomEvent('unsplash:modeChanged', {
      detail: { enabled },
    }));
  };

  // Listen for Unsplash toggle
  document.addEventListener('settings:unsplashToggled', async (e) => {
    const settings = window.homeSettings?.get?.() || {};

    if (e.detail.enabled && settings.unsplashAuthenticated && settings.unsplashAccessKey) {
      setUnsplashModeState(true);
      // Stop gradient animation
      if (opaqueLayer) opaqueLayer.remove();

      // Load Unsplash image
      const keywords = (settings.unsplashKeywords || 'china;japan;korea;taiwan')
        .split(';')
        .map(k => k.trim())
        .filter(k => k);

      try {
        await UnsplashBg.loadDailyImage(settings.unsplashAccessKey, keywords);
      } catch (e) {
        console.warn('Failed to load Unsplash image:', e);
        setUnsplashModeState(false);
      }
    } else {
      setUnsplashModeState(false);
      // Resume gradient animation
      render();
    }
  });

  // Check if Unsplash should be enabled on page load
  (async () => {
    const settings = window.homeSettings?.get?.() || {};
    if (settings.useUnsplash && settings.unsplashAuthenticated && settings.unsplashAccessKey) {
      const keywords = (settings.unsplashKeywords || 'china;japan;korea;taiwan')
        .split(';')
        .map(k => k.trim())
        .filter(k => k);

      try {
        setUnsplashModeState(true);
        await UnsplashBg.loadDailyImage(settings.unsplashAccessKey, keywords);
      } catch (e) {
        console.warn('Failed to load initial Unsplash image:', e);
        setUnsplashModeState(false);
      }
    }

    if (!usingUnsplash) {
      render();
    }
  })();

  function render() {
    if (usingUnsplash) return; // Don't render gradient when using Unsplash

    const from = Date.now() - (Date.now() % CYCLE);
    const to = from + CYCLE;
    const progress = (Date.now() % CYCLE) / CYCLE;

    const fromColor = ((from % PERIOD) * 360 / PERIOD).toFixed();
    const toColor = ((to % PERIOD) * 360 / PERIOD).toFixed();
    const fromHex = gradientThemeColor(fromColor);
    const toHex = gradientThemeColor(toColor);

    ThemeColor.set(mixHexColors(fromHex, toHex, progress));
    startGradientThemeColorInterval();

    if (!opaqueLayer) {
      opaqueLayer = document.createElement('div');
      opaqueLayer.classList.add('bg');
      opaqueLayer.style.opacity = 1;
      opaqueLayer.style.background = gradient(fromColor);
      background.appendChild(opaqueLayer);
    }

    const bg = document.createElement('div');
    bg.classList.add('bg');
    bg.style.opacity = progress;
    bg.style.background = gradient(toColor);
    background.appendChild(bg);

    setTimeout(() => {
      bg.style.opacity = 1;
      bg.style.transitionDuration = `${to - Date.now()}ms`;
      bg.addEventListener('transitionend', () => {
      // FIXME: sometimes this event seems to be never fired
        render();
        opaqueLayer.remove();
        opaqueLayer = bg;
      });
    });
  }
})();

// ---------------------------------------------------------------------------------------------- //
// UNSPLASH BADGE
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const container = document.querySelector('.unsplash-info');
  const textNode = container?.querySelector('.unsplash-info-text');
  const linkNode = container?.querySelector('.unsplash-info-link');
  const reloadNode = container?.querySelector('.unsplash-info-reload');

  if (!container || !textNode || !linkNode || !reloadNode) return;

  const setFromInfo = (info) => {
    if (!info) {
      textNode.textContent = 'Image details not yet available...';
      linkNode.href = '#';
      linkNode.setAttribute('aria-disabled', 'true');
      reloadNode.disabled = true;
      return;
    }

    textNode.textContent = info.description || 'Image from Unsplash';
    linkNode.href = info.unsplashUrl || '#';
    linkNode.removeAttribute('aria-disabled');
    reloadNode.disabled = false;
  };

  const syncEnabledState = () => {
    const settings = window.homeSettings?.get?.() || {};
    const enabled = !!(
      document.body.classList.contains('unsplash-mode')
      || (settings.useUnsplash && settings.unsplashAuthenticated && settings.unsplashAccessKey)
    );
    container.classList.toggle('is-enabled', enabled);
    if (!enabled) reloadNode.disabled = true;
  };

  linkNode.addEventListener('click', (e) => {
    if (linkNode.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });

  reloadNode.addEventListener('click', () => {
    if (reloadNode.disabled) return;
    reloadNode.disabled = true;
    document.dispatchEvent(new CustomEvent('unsplash:reloadToday'));
  });

  document.addEventListener('unsplash:imageInfoChanged', (e) => {
    setFromInfo(e.detail?.info || null);
    syncEnabledState();
  });

  document.addEventListener('unsplash:modeChanged', () => {
    syncEnabledState();
    if (UnsplashBg.currentInfo) setFromInfo(UnsplashBg.currentInfo);
  });

  document.addEventListener('unsplash:reloadFinished', () => {
    syncEnabledState();
    if (UnsplashBg.currentInfo) setFromInfo(UnsplashBg.currentInfo);
  });

  setFromInfo(UnsplashBg.currentInfo);
  syncEnabledState();
})();

// ---------------------------------------------------------------------------------------------- //
// PARTICLES
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const particles = document.querySelector('.particles');
  const WEIGHT = [2, 12];
  const OPACITY = [0.01, 0.4];

  const isUnsplashEnabled = () => {
    const settings = window.homeSettings?.get?.() || {};
    return !!(
      document.body.classList.contains('unsplash-mode')
      || (settings.useUnsplash && settings.unsplashAuthenticated && settings.unsplashAccessKey)
    );
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) particles.innerHTML = '';
  });

  setInterval(() => {
    if (document.hidden) return;
    if (isUnsplashEnabled()) {
      particles.innerHTML = '';
      return;
    }

    const weight = WEIGHT[0] + Math.random() * (WEIGHT[1] - WEIGHT[0]);

    const particle = document.createElement('div');
    particle.classList.add('particle');
    const position = Math.random > 0.75 ? Math.random() : Math.random() * 0.8 + 0.1;
    particle.style.left = `${(position * 100).toFixed(2)}%`;

    const size = `${Math.round(weight)}px`;
    particle.style.width = size;
    particle.style.height = size;
    particle.style.transitionDuration = `${(10 + weight * 10).toFixed(2)}s`;
    particle.style.opacity = (
      OPACITY[0]
      + (WEIGHT[1] - weight) / WEIGHT[1] * (OPACITY[1] - OPACITY[0])
    ).toFixed(2);

    particle.addEventListener('transitionend', () => {
      particle.remove();
    });

    setTimeout(() => {
      particle.style.transform = `translateY(${-WEIGHT[1]}px) translateZ(0)`;
    }, 50);

    particles.appendChild(particle);
  }, 5000);
})();

// ---------------------------------------------------------------------------------------------- //
// CLOCK & DATE
// ---------------------------------------------------------------------------------------------- //

(async () => {
  // To render the date only once per day
  let currentDate = -1;

  const clock = document.querySelector('.clock');
  const welcome = document.querySelector('.welcome-text');

  const formatWelcomeText = (hours) => {
    let text;
    if (hours >= 5 && hours < 12) text = 'Good morning';
    else if (hours >= 12 && hours < 18) text = 'Good afternoon';
    else text = 'Good evening';

    const username = (window.homeSettings?.get?.().username || '').toString().trim();
    return username ? `${text}, ${username}` : text;
  };

  // Render the clock digits
  const render = (onlySecond = false) => {
    [...(onlySecond ? [] : ['Hours', 'Minutes']), 'Seconds'].forEach((x) => {
      const text = new Date()[`get${x}`]().toString().padStart(2, '0');
      clock.querySelector(`.${x.toLowerCase()}`).textContent = text;
    });
    const hours = new Date().getHours();
    welcome.textContent = formatWelcomeText(hours);

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
  document.addEventListener('settings:usernameChanged', () => render(false));

  // Show seconds on hover
  let renderNextSecond = false;
  const renderEverySecond = () => {
    // Render again, even if renderNextSecond = false, as mouse may leave few millis before rerender
    // So we want to update second during it's transition to opacity = 0
    render(true);
    if (!renderNextSecond) return;
    setTimeout(renderEverySecond, 1000 - (new Date().getTime() % 1000));
  };

  clock.addEventListener('mouseenter', () => {
    renderNextSecond = true;
    renderEverySecond();
  });

  clock.addEventListener('mouseleave', () => {
    renderNextSecond = false;
  });

  // And some milliseconds stuff
  let shouldRenderMilliseconds = false;
  let stopRenderingTimeout = null;

  const millis = clock.querySelector('.milliseconds');
  const renderMilliseconds = () => {
    if (!shouldRenderMilliseconds) return;
    window.requestAnimationFrame(renderMilliseconds);
    millis.textContent = (Date.now() % 1000).toString().padStart(3, '0');
  };

  clock.querySelector('.show-seconds').addEventListener('mouseenter', () => {
    clearTimeout(stopRenderingTimeout);
    if (shouldRenderMilliseconds) return;
    shouldRenderMilliseconds = true;
    renderMilliseconds();
  });

  clock.querySelector('.show-seconds').addEventListener('mouseleave', () => {
    stopRenderingTimeout = setTimeout(() => {
      shouldRenderMilliseconds = false;
    }, 200);
  });
})();

// ---------------------------------------------------------------------------------------------- //
// SEARCH
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const search = document.querySelector('.search');
  const input = search.querySelector('.search-input');
  const form = search.querySelector('.search-form');
  const suggestions = search.querySelector('.search-suggestions');
  const providerHint = search.querySelector('.search-provider-hint');
  const providerHintText = search.querySelector('.search-provider-text');
  const cancelHintKey = search.querySelector('.search-cancel-key');
  const actionHintKey = search.querySelector('.search-action-key');
  const chatgptButton = search.querySelector('.search-chatgpt-button');

  const GOOGLE_HINT = 'search with Google';
  const CHATGPT_HINT = 'ask ChatGPT';
  const ESCAPE_KEY_HINT = 'Esc';
  const TAB_KEY_HINT = 'Tab';
  const ENTER_KEY_HINT = 'Enter';

  const URL_WITH_PROTOCOL = /^https?:\/\/\S+$/;
  const LOOKS_LIKE_URL = /^\S+\.\S{2,}\/\S*$/;

  const isEditableTarget = (target) => {
    if (!target) return false;
    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!element) return false;
    if (element.isContentEditable) return true;
    return !!element.closest('input, textarea, select, [contenteditable="true"]');
  };

  const updateProviderHint = () => {
    const chatGPTSelected = document.activeElement === chatgptButton;

    providerHintText.textContent = chatGPTSelected ? CHATGPT_HINT : GOOGLE_HINT;
    cancelHintKey.textContent = chatGPTSelected ? TAB_KEY_HINT : ESCAPE_KEY_HINT;
    actionHintKey.textContent = chatGPTSelected ? ENTER_KEY_HINT : TAB_KEY_HINT;
  };

  const askChatGPT = ({ openInNewTab = false } = {}) => {
    const query = encodeURIComponent(input.value.trim());
    const url = `https://chatgpt.com/?q=${query}`;
    if (openInNewTab) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    window.location = url;
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Meta') form.target = '_blank';
    if (e.key === 'Enter') {
      if (document.activeElement !== input && document.activeElement !== chatgptButton) return;

      const shouldOpenInNewTab = e.shiftKey || e.metaKey;

      if (document.activeElement === chatgptButton) {
        e.preventDefault();
        askChatGPT({ openInNewTab: shouldOpenInNewTab });
        return;
      }

      if (shouldOpenInNewTab) form.target = '_blank';
      form.submit();

      if (shouldOpenInNewTab && !e.metaKey) {
        // Shift-triggered new tab should not persist for the next regular submit.
        setTimeout(() => {
          form.target = '';
        }, 0);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Meta') form.target = '';
  });

  input.addEventListener('focus', () => {
    search.classList.add('active');
    updateProviderHint();
  });

  chatgptButton.addEventListener('focus', () => {
    search.classList.add('active');
    updateProviderHint();
  });

  chatgptButton.addEventListener('blur', () => {
    setTimeout(updateProviderHint);
  });

  chatgptButton.addEventListener('click', () => {
    askChatGPT();
  });

  chatgptButton.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      input.focus();
    }
  });

  document.addEventListener('click', (e) => {
    if (!search.contains(e.target)) {
      search.classList.remove('active');
      updateProviderHint();
    }
  });

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    // Loaded from cache, so form is no longer submitted
    search.classList.remove('submitted-from-suggestion');
    search.classList.remove('submitted-from-input');
  });

  form.addEventListener('submit', (e) => {
    const link = suggestions.querySelector('a.search-suggestion.active');
    if (link) {
      // Follow selected suggestion
      e.preventDefault();
      link.click();
      search.classList.add('submitted-from-suggestion');
      return;
    }

    search.classList.add('submitted-from-input');

    if ([URL_WITH_PROTOCOL, LOOKS_LIKE_URL].some(re => re.test(input.value))) {
      // Go to link directly
      e.preventDefault();
      window.location = URL_WITH_PROTOCOL.test(input.value) ? input.value : `http://${input.value}`;
    }
  });

  let cleanup = null;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.blur();
      search.classList.remove('active');
      cleanup = setTimeout(() => {
        // Clear input when it's hidden
        input.value = '';
        cleanup = null;
      }, 150);
    }
  });

  document.addEventListener('paste', (e) => {
    if (isEditableTarget(e.target) && e.target !== input) return;
    // Will paste directly in the search input
    input.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (cleanup && e.key !== 'Escape') {
      // If we press "Escape" then another key, clean input now (before keyup)
      clearTimeout(cleanup);
      input.value = '';
      cleanup = null;
    }

    if (isEditableTarget(e.target) && e.target !== input) return;

    // As length of `A` `É` = 1, and `Meta` `ShiftLeft` > 1
    if (document.activeElement !== input && e.key.length === 1) {
      // But ignore special action
      if (e.metaKey) return;
      input.focus();
    }
  });

  // Autocomplete
  const cacheIcons = {};
  const addFavicon = (container, url) => {
    // This whole thing is about adding favicon right next to the line
    const a = document.createElement('a');
    a.href = url;
    const { hostname } = a;
    if (!hostname) {
      container.classList.add('fallback-icon');
      return;
    }
    // HTTP cache will still take some ms and flicker each time we type a letter
    // So let's cache some DOM
    if (!cacheIcons[hostname]) {
      const img = document.createElement('img');
      img.classList.add('suggest-icon');
      img.src = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
      const cacheIcon = { img, failed: false, clones: [] };
      cacheIcons[hostname] = cacheIcon;
      img.addEventListener('error', () => {
        cacheIcon.failed = true;
        cacheIcon.clones.forEach((clone) => {
          clone.parentNode.classList.add('fallback-icon');
          clone.remove();
        });
      });
    }
    const cacheIcon = cacheIcons[hostname];
    if (cacheIcon.failed) {
      container.classList.add('fallback-icon');
    } else {
      const clone = cacheIcon.img.cloneNode();
      cacheIcon.clones.push(clone);
      container.appendChild(clone);
    }
  };

  let suggestionsData = [];
  let latestDataRendered = [null, null];
  const refreshSuggestions = () => {
    // No change, no render
    if (input.value === latestDataRendered[0] && suggestionsData === latestDataRendered[1]) return;
    latestDataRendered = [input.value, suggestionsData];

    // No input or no suggestion => hide this stuff
    if (input.value.length === 0 || !suggestionsData[1] || !suggestionsData[1].length) {
      search.classList.remove('with-suggestions');
      return;
    }

    // Now let's work
    const suggestionsRows = suggestionsData[1].map((_, ix) => ({
      text: suggestionsData[1][ix],
      title: suggestionsData[2][ix],
      type: suggestionsData[4]['google:suggesttype'][ix],
    }));

    const suggestLines = suggestionsRows.map((suggestion) => {
      const a = document.createElement('a');
      a.classList.add('search-suggestion');
      const div = document.createElement('div');
      div.classList.add('suggestion-inner');
      a.appendChild(div);

      const isLink = suggestion.type === 'NAVIGATION';
      const separator = isLink ? '.' : ' ';
      const suggestLine = isLink
        ? suggestion.text.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
        : suggestion.text;

      // This needs to be re-generated for each suggestion (see REF_INPUT_WORDS)
      const inputWords = input.value.toLowerCase().split(isLink ? /[ .]/ : ' ');
      const nodes = suggestLine.split(separator)
        .map((suggestWord, ix, all) => {
          const prefix = (first, last) => {
            let index = 0;
            while (index < first.length && first[index] === last[index]) index += 1;
            return index;
          };

          const len = inputWords
            .reduce((max, inputWord) => Math.max(max, prefix(inputWord, suggestWord)), 0);

          // Common prefix = normal font
          const span = document.createElement('span');
          span.textContent = suggestWord.slice(0, len);

          // Completion = bold font
          const b = document.createElement('b');
          b.textContent = `${suggestWord.slice(len)}${ix < all.length - 1 ? separator : ''}`;

          if (suggestWord.length === len) {
            // [REF_INPUT_WORDS] Full match! Can't be used for next completions
            inputWords.splice(inputWords.indexOf(suggestWord), 1);
          }

          return [span, b];
        })
        .filter(Boolean)
        .reduce((x, y) => ([...x, ...y]), []);

      if (isLink) {
        a.href = suggestion.text;
        a.classList.add('suggest-navigation');
        addFavicon(a, a.href);
      } else {
        a.href = '#';
        a.classList.add('suggest-query');
        a.addEventListener('click', (e) => {
          e.preventDefault();
          input.value = suggestion.text;
          input.focus();
        });
      }

      nodes.forEach(node => div.appendChild(node));

      return a;
    });

    // Clear previous suggestions
    [...suggestions.children].forEach(node => node.remove());

    // Then add new ones
    suggestLines.forEach(node => suggestions.appendChild(node));

    // And show them to the world
    search.classList.add('with-suggestions');
  };

  let latest = -1;
  const cacheSuggestions = {};
  const askSuggestions = (text) => {
    // Too long text = too precise to be suggested
    if (text.length === 0 || text.length > 32) {
      suggestionsData = [];
      refreshSuggestions();
      return;
    }

    // We may have it in cache already
    if (cacheSuggestions[text]) {
      suggestionsData = cacheSuggestions[text];
      refreshSuggestions();
      return;
    }

    // Let's call Google
    const script = document.createElement('script');
    const q = encodeURIComponent(text);
    const now = Date.now();
    const callback = `_${Math.random().toString(36).slice(2)}_${now}`;
    script.src = `https://www.google.com/complete/search?client=chrome&callback=${callback}&q=${q}`;
    document.body.appendChild(script);
    // And handle response
    window[callback] = (args) => {
      script.remove();
      cacheSuggestions[text] = args;
      if (now < latest) return; // Already outdated
      latest = now;
      suggestionsData = args;
      refreshSuggestions();
    };
  };

  const updateSearchIcon = (value) => {
    const isLink = [URL_WITH_PROTOCOL, LOOKS_LIKE_URL].some(re => re.test(value));

    const wrapper = document.querySelector('.search-input-wrapper');
    wrapper.classList.toggle('has-icon', isLink);
    wrapper.classList.remove('fallback-icon');
    [...wrapper.querySelectorAll('.suggest-icon')].forEach(x => x.remove());

    if (isLink) {
      addFavicon(wrapper, URL_WITH_PROTOCOL.test(value) ? value : `http://${value}`);
    }
  };

  let lastValue = '';
  const inputChanged = () => {
    setTimeout(() => {
      if (lastValue === input.value) return;
      lastValue = input.value;
      askSuggestions(lastValue.toLowerCase());
      // Immediate feedback
      refreshSuggestions();
      // Show whether we gonna search or open that link
      updateSearchIcon(lastValue);
    });
  };

  input.addEventListener('keypress', (e) => {
    // Exclude Enter key, we don't want to change suggestions when submitting
    if (e.key !== 'Enter' && !e.metaKey && !e.ctrlKey) inputChanged();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') inputChanged();
  });

  input.addEventListener('mousedown', inputChanged);

  input.addEventListener('cut', inputChanged);

  // As paste won't trigger input.change or such
  document.addEventListener('paste', inputChanged);

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    // Loaded from cache, so input may be empty now
    inputChanged();
  });

  // We can choose autocomplete suggestion using arrows
  const unactive = () => {
    const selected = suggestions.querySelector('.search-suggestion.active');
    if (selected) selected.classList.remove('active');
    return selected;
  };

  let selected = -1;
  document.addEventListener('keydown', (e) => {
    let move = 0;
    if (e.key === 'ArrowUp') move = -1;
    if (e.key === 'ArrowDown') move = +1;
    if (!move) return;

    // We can go back to input, so it is selectable
    const selectables = [
      input,
      ...suggestions.querySelectorAll('.search-suggestion'),
    ];

    selected = unactive() || input;
    selected = selectables.indexOf(selected);
    if (selected === -1) selected = 0;

    const toSelect = selectables[(selectables.length + selected + move) % selectables.length];
    if (toSelect.classList.contains('search-suggestion')) {
      toSelect.classList.add('active');
      input.value = toSelect.textContent;
    } else {
      input.value = lastValue;
    }
    e.preventDefault();

    updateSearchIcon(toSelect.classList.contains('suggest-navigation')
      ? toSelect.href
      : input.value);
  });

  suggestions.addEventListener('mouseout', unactive);

  suggestions.addEventListener('mouseover', (e) => {
    const toSelect = [...suggestions.querySelectorAll('.search-suggestion')]
      .find(s => s.contains(e.target));
    if (!toSelect) return;
    unactive();
    toSelect.classList.add('active');
  });

  updateProviderHint();
})();

// ---------------------------------------------------------------------------------------------- //
// WEATHER
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const weather = document.querySelector('.weather');
  const storageKey = 'weather-forecast';

  const getWeatherLocation = () => window.homeSettings?.get?.().weatherLocation || '';

  const cacheKey = (location) => [storageKey, location || 'auto'].join(':');

  const renderForecast = (forecast) => {
    weather.textContent = [
      forecast[2],
      forecast[3].replace(/(^\+|C$)/g, ''),
      '–',
      forecast[1].split(',')[0],
    ].join(' ');
  };

  const fetchForecast = async (location) => {
    const target = location ? encodeURIComponent(location) : '';
    const endpoint = `https://wttr.in/${target}?format=osef|%l|%c|%t|`;
    const res = await window.fetch(endpoint);
    if (!res.ok) throw new Error('Weather API error');
    const text = await res.text();
    const forecast = text.split('|');
    if (forecast.length < 4) {
      throw new Error(`Invalid weather format, got ${forecast.length} parts`);
    }
    return forecast;
  };

  const loadWeather = async () => {
    const location = getWeatherLocation().trim();
    const key = cacheKey(location);

    let forecast = window.localStorage.getItem(key);
    if (forecast) {
      try {
        forecast = JSON.parse(forecast);
        if (forecast.expire < Date.now()) {
          forecast = null;
        } else {
          ({ forecast } = forecast);
        }
      } catch (e) {
        forecast = null;
      }
    }

    if (!forecast) {
      try {
        forecast = await fetchForecast(location);
        window.localStorage.setItem(key, JSON.stringify({
          forecast,
          expire: Date.now() + 15 * 60 * 1000,
        }));
      } catch (e) {
        console.warn('Failed to fetch weather', e);
        window.localStorage.removeItem(key);
        weather.textContent = '';
        return;
      }
    }

    renderForecast(forecast);
  };

  document.addEventListener('settings:weatherLocationChanged', () => {
    loadWeather();
  });

  loadWeather();
})();

// ---------------------------------------------------------------------------------------------- //
// QUOTE
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const quote = document.querySelector('.quote');
  const quoteText = quote.querySelector('.text');
  const quoteAuthor = quote.querySelector('.author');
  const storageKey = 'quote-of-the-day';

  let qotd = window.localStorage.getItem(storageKey);
  if (qotd) {
    qotd = JSON.parse(qotd);
    if (qotd.expire < Date.now()) qotd = null;
    else ({ qotd } = qotd);
  }

  if (!qotd) {
    // TODO: handle errors
    qotd = (await (
      await window.fetch('https://raw.githubusercontent.com/dwyl/quotes/master/quotes.json')
    ).json());
    qotd = qotd.filter(({ text, author }) => author && text.length < 90);
    qotd = qotd[Math.floor(qotd.length * Math.random())];
    window.localStorage.setItem(storageKey, JSON.stringify({
      qotd,
      expire: Date.now() + 12 * 3600 * 1000,
    }));
  }

  quoteText.textContent = /\w$/.test(qotd.text) ? `${qotd.text}.` : qotd.text;
  quoteAuthor.textContent = qotd.author;
})();
