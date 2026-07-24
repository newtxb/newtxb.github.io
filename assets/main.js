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

function keywordStringToArray(keywords) {
  return (keywords || '')
    .toString()
    .split(/[;,]/)
    .map(keyword => keyword.trim())
    .filter(Boolean);
}

function formatKeywordString(keywords) {
  return keywordStringToArray(keywords).join(', ');
}

const DEFAULT_UNSPLASH_KEYWORDS = [
  'china',
  'korea',
  'taiwan',
  'taipei',
  'keelung',
  'hong kong',
  'seoul',
  'hongdae',
  'myeongdong',
  'busan',
  'shanghai',
  'guangzhou',
  'chongqing',
  'chengdu',
  'tainan',
  'yunnan',
  'lijang',
  'dali',
  'kunming',
  'shangri la',
  'guilin',
  'yangshuo',
  'zhangjiajie',
  'shenzhen',
];

const DEFAULT_UNSPLASH_KEYWORDS_TEXT = DEFAULT_UNSPLASH_KEYWORDS.join(', ');

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map(channel => clampByte(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
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

async function sha1Hex(text) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
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
  THEME_COLOR_KEY: 'unsplash-theme-color',

  currentInfo: null,

  setStoredThemeColor(color) {
    if (!color) return;
    try {
      localStorage.setItem(this.THEME_COLOR_KEY, color);
    } catch (e) {
      console.warn('Failed to store Unsplash theme color:', e);
    }
  },

  getStoredThemeColor() {
    try {
      return localStorage.getItem(this.THEME_COLOR_KEY);
    } catch (e) {
      return null;
    }
  },

  applyStoredThemeColor() {
    const storedColor = this.getStoredThemeColor();
    if (storedColor) ThemeColor.set(storedColor);
  },

  notifySwCacheImage(url) {
    if (!url) return;
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ action: 'CACHE_UNSPLASH_IMAGE', url });
    }
  },

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
    const cleanedKeywords = Array.isArray(keywords)
      ? keywords.map(keyword => (keyword || '').toString().trim()).filter(Boolean)
      : [];

    if (cleanedKeywords.length === 0) {
      cleanedKeywords.push(...DEFAULT_UNSPLASH_KEYWORDS);
    }

    const keyword = cleanedKeywords[Math.floor(Math.random() * cleanedKeywords.length)];
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
      const bgEl = document.querySelector('.background');
      if (bgEl) {
        // Keep background hidden while the new image is loading.
        bgEl.style.transition = 'none';
        bgEl.style.opacity = '0';
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const themeColor = averageImageColor(img);
        if (themeColor) {
          ThemeColor.set(themeColor);
          this.setStoredThemeColor(themeColor);
        }

        if (bgEl) {
          bgEl.style.backgroundImage = `url('${imageUrl}')`;
          bgEl.style.backgroundSize = 'cover';
          bgEl.style.backgroundPosition = 'center';

          // Force a style flush before re-enabling transition so fade-in always runs.
          void bgEl.offsetHeight;

          setTimeout(() => {
            bgEl.style.opacity = '0.1';
            requestAnimationFrame(() => {
              bgEl.style.transition = 'opacity 0.67s ease-in-out';
              bgEl.style.opacity = '1';
            });
          }, 100);
        }

        resolve(themeColor);
      };
      img.onerror = resolve;
      img.src = imageUrl;
    });
  },

  async loadDailyImage(accessKey, keywords) {
    const today = new Date().toDateString();
    const cacheKey = `unsplash-bg-${today}`;

    // Drop previous days' entries so localStorage doesn't grow forever
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('unsplash-bg-') && key !== cacheKey) {
        localStorage.removeItem(key);
      }
    }

    // Check if we already have today's image
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const imageData = JSON.parse(cached);
      if (imageData.info) this.setCurrentInfo(imageData.info);
      if (imageData.themeColor) {
        ThemeColor.set(imageData.themeColor);
        this.setStoredThemeColor(imageData.themeColor);
      }
      this.notifySwCacheImage(imageData.url);
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
    this.notifySwCacheImage(imageUrl);
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
    if (themeColor) {
      ThemeColor.set(themeColor);
      this.setStoredThemeColor(themeColor);
    }
  }
};

// ---------------------------------------------------------------------------------------------- //
// UPDATER
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const VERSION_KEY = 'current-version';
  const PRECACHE = 'precache-v1';
  const CHECK_INTERVAL = 30 * 60 * 1000;

  const sw = window.navigator.serviceWorker;
  sw?.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'CACHE_CLEARED') {
      document.querySelector('.update').classList.add('active');
    }
  });

  let checking = false;
  let updateApplied = false;
  let lastCheck = 0;

  const checkForUpdate = async () => {
    if (checking || updateApplied) return;
    checking = true;
    lastCheck = Date.now();

    try {
      const req = await window.fetch('github.json', { cache: 'no-cache' });
      const github = await req.json();

      // We are up to date!
      if (github.version === window.localStorage.getItem(VERSION_KEY)) return;

      // We're not... delete the old
      updateApplied = true;
      await window.caches.delete(PRECACHE);
      window.localStorage.setItem(VERSION_KEY, github.version);

      if (!sw || !sw.controller) return;

      // And update! (the toast shows once the SW confirms the fresh cache)
      sw.controller.postMessage({ action: 'CLEAR_CACHE' });
    } catch (e) {
      console.warn('Failed to check for update', e);
    } finally {
      checking = false;
    }
  };

  checkForUpdate();

  setInterval(() => {
    if (!document.hidden) checkForUpdate();
  }, CHECK_INTERVAL);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastCheck > CHECK_INTERVAL) checkForUpdate();
  });
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
    unsplashKeywords: DEFAULT_UNSPLASH_KEYWORDS_TEXT,
    unsplashKeywordsOverridden: false,
    sonosBearerToken: '',
  };

  const modal = document.querySelector('.settings-modal');
  const trigger = document.querySelector('.settings-trigger');
  const closeButtons = modal ? modal.querySelectorAll('[data-close-settings]') : [];

  const dateNode = document.querySelector('.calendar')?.parentNode;
  const quoteNode = document.querySelector('.row-quote')?.parentNode;
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
      const savedKeywords = formatKeywordString(saved.unsplashKeywords || '');
      const inferredOverridden = (
        savedKeywords.length > 0
        && savedKeywords !== defaults.unsplashKeywords
      );
      settings = {
        ...defaults,
        ...saved,
        username: (saved.username || '').toString().trim(),
        weatherLocation: (saved.weatherLocation || '').toString().trim(),
        unsplashKeywords: savedKeywords,
        unsplashKeywordsOverridden: typeof saved.unsplashKeywordsOverridden === 'boolean'
          ? saved.unsplashKeywordsOverridden
          : inferredOverridden,
      };
    }
  } catch (e) {
    settings = { ...defaults };
  }

  const save = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  };

  const isUnsplashReady = () => (
    settings.useUnsplash && settings.unsplashAuthenticated && settings.unsplashAccessKey
  );

  const syncInputs = () => {
    if (!modal) return;
    inputs.showDate.checked = !!settings.showDate;
    inputs.showQuote.checked = !!settings.showQuote;
    inputs.showWeather.checked = !!settings.showWeather;
    inputs.username.value = settings.username || '';
    inputs.weatherLocation.value = settings.weatherLocation || '';
    inputs.useUnsplash.checked = !!settings.useUnsplash;
    if (inputs.unsplashKeywords) {
      inputs.unsplashKeywords.placeholder = defaults.unsplashKeywords;
      inputs.unsplashKeywords.value = settings.unsplashKeywordsOverridden
        ? settings.unsplashKeywords
        : '';
    }

    // Update UI visibility
    if (sections.authSection) {
      sections.authSection.style.display = settings.useUnsplash && !settings.unsplashAuthenticated ? 'block' : 'none';
    }
    if (sections.keywordsSection) {
      sections.keywordsSection.style.display = settings.useUnsplash && settings.unsplashAuthenticated ? 'block' : 'none';
    }
    if (buttons.resetUnsplashPhoto) {
      if (settings.useUnsplash) {
        buttons.resetUnsplashPhoto.style.display = '';
        buttons.resetUnsplashPhoto.textContent = 'Reset history';
        buttons.resetUnsplashPhoto.disabled = !isUnsplashReady();
      } else {
        buttons.resetUnsplashPhoto.style.display = 'none';
      }
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
    const wasUnsplashEnabled = !!settings.useUnsplash;
    settings.useUnsplash = inputs.useUnsplash.checked;
    syncInputs();
    save();

    if (wasUnsplashEnabled && !settings.useUnsplash) {
      document.dispatchEvent(new CustomEvent('settings:unsplashToggled', {
        detail: { enabled: false },
      }));
      window.location.reload();
      return;
    }

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
      settings.sonosBearerToken = await sha1Hex(password);
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

  inputs.unsplashPassword?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    buttons.unlockUnsplash?.click();
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
      const keywords = keywordStringToArray(settings.unsplashKeywords || defaults.unsplashKeywords);

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
    if (!settings.useUnsplash) {
      window.location.reload();
      return;
    }
    await resetBlacklistHistory();
  });

  document.addEventListener('unsplash:reloadToday', async () => {
    await resetBlacklistHistory();
  });

  const commitUnsplashKeywords = () => {
    const nextValue = formatKeywordString(inputs.unsplashKeywords.value);
    const nextOverridden = nextValue.length > 0;
    inputs.unsplashKeywords.value = nextValue;
    if (
      nextValue === settings.unsplashKeywords
      && nextOverridden === settings.unsplashKeywordsOverridden
    ) return;
    settings.unsplashKeywords = nextValue;
    settings.unsplashKeywordsOverridden = nextOverridden;
    save();
  };

  inputs.unsplashKeywords?.addEventListener('change', commitUnsplashKeywords);
  inputs.unsplashKeywords?.addEventListener('blur', commitUnsplashKeywords);

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
      UnsplashBg.applyStoredThemeColor();
      // Stop gradient animation
      if (opaqueLayer) opaqueLayer.remove();

      // Load Unsplash image
      const keywords = keywordStringToArray(settings.unsplashKeywords || DEFAULT_UNSPLASH_KEYWORDS_TEXT);

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
      const keywords = keywordStringToArray(settings.unsplashKeywords || DEFAULT_UNSPLASH_KEYWORDS_TEXT);

      try {
        setUnsplashModeState(true);
        UnsplashBg.applyStoredThemeColor();
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
    const position = Math.random() > 0.75 ? Math.random() : Math.random() * 0.8 + 0.1;
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
  let currentMonthKey = '';
  let currentMonthOffset = 0;

  const clock = document.querySelector('.clock');
  const welcome = document.querySelector('.welcome-text');
  const calendar = document.querySelector('.calendar');

  let calendarSummary = null;
  let calendarMenu = null;
  let calendarPrevButton = null;
  let calendarNextButton = null;

  const getViewedMonth = (baseDate, offset) => {
    const viewedMonth = new Date(baseDate);
    viewedMonth.setDate(1);
    viewedMonth.setHours(0, 0, 0, 0);
    viewedMonth.setMonth(viewedMonth.getMonth() + offset);
    return viewedMonth;
  };

  const renderCalendar = (offset = currentMonthOffset, direction = null, force = false) => {
    const now = new Date();
    const viewedMonth = getViewedMonth(now, offset);
    const monthKey = `${viewedMonth.getFullYear()}-${viewedMonth.getMonth()}`;

    if (!force && monthKey === currentMonthKey) {
      return;
    }

    currentMonthOffset = offset;
    currentMonthKey = monthKey;

    renderMonthGrid(viewedMonth, direction);
  };

  const buildCalendarMenu = () => {
    if (!calendar) return;

    calendar.textContent = '';

    calendarSummary = document.createElement('div');
    calendarSummary.className = 'calendar-current';
    calendarSummary.setAttribute('tabindex', '0');

    calendarMenu = document.createElement('div');
    calendarMenu.className = 'panel-menu calendar-menu';
    calendarMenu.setAttribute('role', 'group');
    calendarMenu.setAttribute('aria-label', 'Current month calendar');

    calendarPrevButton = document.createElement('button');
    calendarPrevButton.type = 'button';
    calendarPrevButton.className = 'calendar-menu-nav';
    calendarPrevButton.setAttribute('aria-label', 'Show previous month');
    calendarPrevButton.textContent = '‹';

    calendarNextButton = document.createElement('button');
    calendarNextButton.type = 'button';
    calendarNextButton.className = 'calendar-menu-nav';
    calendarNextButton.setAttribute('aria-label', 'Show next month');
    calendarNextButton.textContent = '›';

    const calendarMenuWrapper = document.createElement('div');
    calendarMenuWrapper.className = 'calendar-menu-wrapper';
    calendarMenuWrapper.appendChild(calendarMenu);

    calendar.append(calendarSummary, calendarMenuWrapper);
  };

  const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const easterSunday = (year) => {
    // Meeus/Jones/Butcher algorithm for Gregorian Easter.
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  const frenchHolidays = (year) => {
    const holidays = new Map();
    const addHoliday = (date, name) => {
      holidays.set(toDateKey(date), name);
    };

    addHoliday(new Date(year, 0, 1), 'New Year\'s Day');
    addHoliday(new Date(year, 4, 1), 'Labour Day');
    addHoliday(new Date(year, 4, 8), 'Victory in Europe Day');
    addHoliday(new Date(year, 6, 14), 'Bastille Day');
    addHoliday(new Date(year, 7, 15), 'Assumption of Mary');
    addHoliday(new Date(year, 10, 1), 'All Saints\' Day');
    addHoliday(new Date(year, 10, 11), 'Armistice Day');
    addHoliday(new Date(year, 11, 25), 'Christmas Day');

    const easter = easterSunday(year);
    addHoliday(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 1), 'Easter Monday');
    addHoliday(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 39), 'Ascension Day');
    addHoliday(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + 50), 'Whit Monday');

    return holidays;
  };

  const renderMonthGrid = (now, direction = null) => {
    if (!calendarMenu) return;

    calendarMenu.textContent = '';

    const today = new Date();

    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstDayOffset = (firstDay.getDay() + 6) % 7;
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellsCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
    const holidaysThisYear = frenchHolidays(year);
    const holidaysPrevYear = frenchHolidays(year - 1);
    const holidaysNextYear = frenchHolidays(year + 1);

    const titleBar = document.createElement('div');
    titleBar.className = 'calendar-menu-header';

    const title = document.createElement('div');
    title.className = 'calendar-menu-title';
    title.textContent = now.toLocaleDateString('default', { month: 'long', year: 'numeric' });

    const navButtons = document.createElement('div');
    navButtons.className = 'calendar-menu-navs';

    if (calendarPrevButton) navButtons.appendChild(calendarPrevButton);
    navButtons.appendChild(title);
    if (calendarNextButton) navButtons.appendChild(calendarNextButton);

    titleBar.appendChild(navButtons);

    const weekdays = document.createElement('div');
    weekdays.className = 'calendar-menu-weekdays';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((name) => {
      const node = document.createElement('span');
      node.textContent = name;
      weekdays.appendChild(node);
    });

    const days = document.createElement('div');
    days.className = 'calendar-menu-days';

    for (let index = 0; index < cellsCount; index += 1) {
      const dayOfMonth = index - firstDayOffset + 1;
      const cell = document.createElement('span');
      cell.className = 'calendar-menu-day';

      if (index % 7 >= 5) {
        cell.classList.add('is-weekend');
      }

      if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
        const neighborDay = dayOfMonth < 1
          ? daysInPrevMonth + dayOfMonth
          : dayOfMonth - daysInMonth;
        cell.classList.add('is-neighbor');
        cell.textContent = String(neighborDay);
      } else {
        cell.textContent = String(dayOfMonth);
        if (dayOfMonth === today.getDate() && year === today.getFullYear() && month === today.getMonth()) {
          cell.classList.add('is-today');
        }
      }

      const cellDate = new Date(year, month, dayOfMonth);
      const holidayKey = toDateKey(cellDate);
      const holidayName = holidaysThisYear.get(holidayKey)
        || holidaysPrevYear.get(holidayKey)
        || holidaysNextYear.get(holidayKey);
      if (holidayName) {
        cell.classList.add('is-holiday');
        cell.title = holidayName;
      }

      days.appendChild(cell);
    }

    const body = document.createElement('div');
    body.className = 'calendar-menu-body';
    if (direction === 'prev') body.classList.add('is-slide-prev');
    else if (direction === 'next') body.classList.add('is-slide-next');

    body.append(titleBar, weekdays, days);
    calendarMenu.appendChild(body);

    if (calendarPrevButton) {
      calendarPrevButton.onclick = () => {
        renderCalendar(currentMonthOffset - 1, 'prev');
      };
    }

    if (calendarNextButton) {
      calendarNextButton.onclick = () => {
        renderCalendar(currentMonthOffset + 1, 'next');
      };
    }
  };

  buildCalendarMenu();

  const teddyFaces = [
    'ʕ´❛ᴥ❛`ʔ',
    'ʕ ·ᴥ· ʔ',
    'ʕ•ᴥ•ʔ',
    'ʕᵕᴥᵕʔ',
    '◝ʕ •ᴥ• ʔ◜',
    'ʕ•ᴗ•ʔ',
    'ʕᵔᴥᵔʔ',
    '◝ʕ •ᴥ• ʔ◜',
    'ʕ•ᴥ•ʔ',
    'ʕ´•ᴥ•`ʔ',
    'ʕ ᵔᴥᵔ ʔ',
    'ʕ •ᴥ•ʔ',
    'ʕっ•ᴥ•ʔっ',
    'ʕ⁀ᴥ⁀ʔ',
    'ʕ•ᴥ•ʔ',
  ];

  const getDailyTeddyFace = () => {
    const dayNumber = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
    const index = ((dayNumber % teddyFaces.length) + teddyFaces.length) % teddyFaces.length;
    return teddyFaces[index];
  };

  const formatWelcomeText = (hours) => {
    let text;
    if (hours >= 5 && hours < 12) text = 'Good morning';
    else if (hours >= 12 && hours < 18) text = 'Good afternoon';
    else text = 'Good evening';

    const username = (window.homeSettings?.get?.().username || '').toString().trim();
    const displayName = username || getDailyTeddyFace();
    return `${text}, ${displayName}`;
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
      const now = new Date();
      const dateChanged = now.getDate() !== currentDate;

      if (calendarSummary && dateChanged) {
        currentDate = now.getDate();
        calendarSummary.textContent = now
          .toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric' });
      }

      renderCalendar(currentMonthOffset, null, dateChanged && currentMonthOffset === 0);
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
      delete window[callback];
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
  if (!weather) return;

  const storageKey = 'weather-forecast-v3';

  // Drop entries from previous storage versions
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith('weather-forecast-') && !key.startsWith(storageKey)) {
      localStorage.removeItem(key);
    }
  }

  const getWeatherLocation = () => window.homeSettings?.get?.().weatherLocation || '';

  const cacheKey = (location) => [storageKey, location || 'auto'].join(':');
  const PERIOD_ORDER = ['Morning', 'Afternoon', 'Evening', 'Night'];

  const weatherLabel = (entry) => {
    const hourly = Array.isArray(entry?.hourly) ? entry.hourly : [];
    const sample = hourly[Math.floor(hourly.length / 2)] || hourly[0] || {};
    return (sample?.weatherDesc?.[0]?.value || '').toString().trim() || 'Unknown';
  };

  const parseTemp = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseNumber = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const weatherEmoji = (label = '') => {
    const text = label.toLowerCase();
    if (!text) return '🌤️';
    if (/thunder|storm|lightning/.test(text)) return '⛈️';
    if (/snow|blizzard|sleet|ice/.test(text)) return '❄️';
    if (/rain|drizzle|shower/.test(text)) return '🌧️';
    if (/fog|mist|haze|smoke/.test(text)) return '🌫️';
    if (/wind|gust/.test(text)) return '💨';
    if (/cloud|overcast/.test(text)) return '☁️';
    if (/sun|clear/.test(text)) return '☀️';
    return '🌤️';
  };

  const windArrow = (degrees) => {
    if (!Number.isFinite(degrees)) return '';
    // wttr.in reports where the wind comes from; point the arrow where it blows to
    const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    return arrows[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
  };

  const toPartName = (timeValue) => {
    if (timeValue <= 300) return 'Night';
    if (timeValue <= 900) return 'Morning';
    if (timeValue <= 1500) return 'Afternoon';
    return 'Evening';
  };

  const formatPartTime = (timeValue) => {
    const normalized = Number.isFinite(timeValue) ? timeValue : 0;
    const hours = Math.max(0, Math.min(23, Math.floor(normalized / 100)));
    const minutes = Math.max(0, Math.min(59, normalized % 100));
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const currentDayPercent = () => {
    const CHART_START_MINUTES = 9 * 60;
    const CHART_END_MINUTES = (24 + 3) * 60;
    const CHART_LEFT_PERCENT = 12.5;
    const CHART_RIGHT_PERCENT = 87.5;
    const now = new Date();
    let minutes = (now.getHours() * 60) + now.getMinutes();

    if (minutes < 3 * 60) minutes += 24 * 60;

    const clamped = Math.max(CHART_START_MINUTES, Math.min(CHART_END_MINUTES, minutes));
    const domainPercent = (clamped - CHART_START_MINUTES) / (CHART_END_MINUTES - CHART_START_MINUTES);
    return CHART_LEFT_PERCENT + (domainPercent * (CHART_RIGHT_PERCENT - CHART_LEFT_PERCENT));
  };

  const dayParts = (entry) => {
    const hourly = Array.isArray(entry?.hourly) ? entry.hourly : [];
    const parts = hourly
      .map((slot) => {
        const timeValue = Number.parseInt(slot?.time || '0', 10);
        const safeTimeValue = Number.isNaN(timeValue) ? 0 : timeValue;
        return {
          name: toPartName(safeTimeValue),
          timeValue: safeTimeValue,
          timeLabel: formatPartTime(safeTimeValue),
          temp: parseTemp(slot?.tempC),
          label: (slot?.weatherDesc?.[0]?.value || '').toString().trim() || '',
        };
      })
      .filter((part) => part.temp != null);

    const merged = {};
    parts.forEach((part) => {
      if (!merged[part.name]) merged[part.name] = part;
      else merged[part.name] = { ...merged[part.name], temp: part.temp, timeValue: part.timeValue, timeLabel: part.timeLabel };
    });

    return PERIOD_ORDER
      .map((name) => merged[name])
      .filter(Boolean);
  };

  const dayMetrics = (entry) => {
    const hourly = Array.isArray(entry?.hourly) ? entry.hourly : [];
    const sample = hourly[Math.floor(hourly.length / 2)] || hourly[0] || {};

    return {
      rainMm: parseNumber(sample?.precipMM),
      rainChancePct: parseTemp(sample?.chanceofrain),
      feelsLikeC: parseTemp(sample?.FeelsLikeC),
      humidityPct: parseTemp(sample?.humidity),
      windKmph: parseTemp(sample?.windspeedKmph),
      windDirDeg: parseTemp(sample?.winddirDegree),
      uvIndex: parseNumber(sample?.uvIndex ?? sample?.UVIndex),
    };
  };

  const normalizeWeather = (payload) => {
    const current = payload?.current_condition?.[0] || {};
    const currentTemp = Number.parseInt(current?.temp_C, 10);
    const currentLabel = (current?.weatherDesc?.[0]?.value || '').toString().trim() || 'Unknown';
    const nearestArea = payload?.nearest_area?.[0] || {};
    const currentLocation = (nearestArea?.areaName?.[0]?.value || '').toString().trim();
    const latitude = (nearestArea?.latitude || '').toString().trim().replace(/([.,]\d{3})\d+/, '$1');
    const longitude = (nearestArea?.longitude || '').toString().trim().replace(/([.,]\d{3})\d+/, '$1');
    const coordinates = latitude && longitude ? `${latitude}, ${longitude}` : null;
    const days = Array.isArray(payload?.weather) ? payload.weather : [];
    const todayMetrics = days[0] ? dayMetrics(days[0]) : {};
    const todayAstronomy = days[0]?.astronomy?.[0] || {};

    return {
      current: {
        tempC: Number.isNaN(currentTemp) ? null : currentTemp,
        label: currentLabel,
        emoji: weatherEmoji(currentLabel),
        location: currentLocation,
        metrics: {
          rainMm: parseNumber(current?.precipMM),
          rainChancePct: todayMetrics.rainChancePct ?? null,
          feelsLikeC: parseTemp(current?.FeelsLikeC),
          humidityPct: parseTemp(current?.humidity),
          windKmph: parseTemp(current?.windspeedKmph),
          windDirDeg: parseTemp(current?.winddirDegree),
          uvIndex: parseNumber(current?.uvIndex ?? current?.UVIndex),
          coordinates,
          sunrise: (todayAstronomy?.sunrise || '').toString().trim() || null,
          sunset: (todayAstronomy?.sunset || '').toString().trim() || null,
          moonPhase: (todayAstronomy?.moon_phase || '').toString().trim() || null,
        },
      },
      today: days[0]
        ? {
            day: 'Today',
            label: weatherLabel(days[0]),
            emoji: weatherEmoji(weatherLabel(days[0])),
            min: parseTemp(days[0]?.mintempC),
            max: parseTemp(days[0]?.maxtempC),
            parts: dayParts(days[0]),
            metrics: dayMetrics(days[0]),
          }
        : null,
      nextDays: days.slice(1, 4).map((day) => {
        const max = parseTemp(day?.maxtempC);
        const min = parseTemp(day?.mintempC);
        const date = new Date(`${day?.date || ''}T12:00:00`);
        const weekday = Number.isNaN(date.getTime())
          ? (day?.date || '').toString()
          : date.toLocaleDateString('default', { weekday: 'long' });

        const label = weatherLabel(day);

        return {
          day: weekday,
          label,
          emoji: weatherEmoji(label),
          min,
          max,
          parts: dayParts(day),
          metrics: dayMetrics(day),
        };
      }),
    };
  };

  const renderForecast = (forecast) => {
    weather.textContent = '';

    const current = document.createElement('div');
    current.className = 'weather-current';
    current.setAttribute('tabindex', '0');

    const temp = forecast.current?.tempC;
    const location = forecast.current?.location || 'Local weather';
    const label = forecast.current?.label || 'Unknown';
    const emoji = forecast.current?.emoji || '🌤️';

    current.textContent = `${emoji} ${temp == null ? '--' : `${temp}°`} – ${location}`;
    current.title = label;

    const menu = document.createElement('div');
    menu.className = 'panel-menu weather-menu';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Next days weather');

    const menuWrapper = document.createElement('div');
    menuWrapper.className = 'weather-menu-wrapper';

    const header = document.createElement('div');
    header.className = 'weather-menu-title';
    const feelsLike = forecast.current?.metrics?.feelsLikeC;
    const currentText = `Currently ${temp == null ? '--' : `${temp}°`}`;
    const feelsText = `, feels like ${feelsLike == null ? '--' : `${feelsLike}°`}`;
    const feels = document.createElement('span');
    feels.className = 'weather-menu-title-subtle';
    feels.textContent = feelsText;
    header.append(currentText, feels);
    menu.appendChild(header);

    const formatMetricValue = (metric) => {
      if (metric.value == null) return '--';
      if (metric.key === 'rain') {
        const amount = `${metric.value.rainMm == null ? '--' : metric.value.rainMm.toFixed(1)} mm`;
        const chance = metric.value.rainChancePct == null ? '--%' : `${metric.value.rainChancePct}%`;
        return `${amount} (${chance})`;
      }
      if (metric.key === 'feels') return `${metric.value}°`;
      if (metric.key === 'humidity') return `${metric.value}%`;
      if (metric.key === 'wind') {
        const arrow = windArrow(metric.value.windDirDeg);
        return `${arrow ? `${arrow} ` : ''}${metric.value.windKmph} km/h`;
      }
      if (metric.key === 'uv') return `${metric.value}`;
      return String(metric.value);
    };

    const toMetricList = (
      metrics = {},
      options = { includeFeels: true, includeAstronomy: false, includeUv: true, includeGps: false },
    ) => {
      const list = [
        {
          key: 'rain',
          label: 'Rain',
          value: {
            rainMm: metrics.rainMm ?? null,
            rainChancePct: metrics.rainChancePct ?? null,
          },
        },
      ];

      if (options.includeFeels !== false) {
        list.push({ key: 'feels', label: 'Feels', value: metrics.feelsLikeC ?? null });
      }

      list.push(
        { key: 'humidity', label: 'Humidity', value: metrics.humidityPct ?? null },
      );

      if (options.includeAstronomy) {
        list.push(
          { key: 'sunrise', label: 'Sunrise', value: metrics.sunrise ?? null },
          { key: 'sunset', label: 'Sunset', value: metrics.sunset ?? null },
        );
      }

      list.push({
        key: 'wind',
        label: 'Wind',
        value: metrics.windKmph == null
          ? null
          : { windKmph: metrics.windKmph, windDirDeg: metrics.windDirDeg ?? null },
      });

      if (options.includeUv !== false) {
        list.push({ key: 'uv', label: 'UV', value: metrics.uvIndex ?? null });
      }

      if (options.includeAstronomy) {
        list.push(
          { key: 'moon', label: 'Moon', value: metrics.moonPhase ?? null },
        );
      }

      if (options.includeGps) {
        list.push({ key: 'gps', label: 'GPS', value: metrics.coordinates ?? null });
      }

      return list;
    };

    const createMetricRow = (
      metrics = {},
      className = 'weather-menu-metrics',
      options = { includeFeels: true, includeUv: true, includeGps: false },
    ) => {
      const node = document.createElement('div');
      node.className = className;

      toMetricList(metrics, options).forEach((metric) => {
        const item = document.createElement('div');
        item.className = 'weather-menu-metric';
        if (metric.wide) item.classList.add('is-wide');
        if (metric.key === 'moon') item.classList.add('is-moon');

        const key = document.createElement('span');
        key.className = 'weather-menu-metric-key';
        key.textContent = metric.label;

        const value = document.createElement('span');
        value.className = 'weather-menu-metric-value';
        value.textContent = formatMetricValue(metric);

        item.append(key, value);
        node.appendChild(item);
      });

      return node;
    };

    menu.appendChild(createMetricRow(
      forecast.current?.metrics,
      'weather-menu-current-metrics',
      { includeFeels: false, includeAstronomy: true, includeUv: true, includeGps: true },
    ));

    const forecastHeader = document.createElement('div');
    forecastHeader.className = 'weather-menu-title';
    forecastHeader.textContent = '3 days forecast';
    menu.appendChild(forecastHeader);

    const rows = document.createElement('div');
    rows.className = 'weather-menu-rows';

    const makePartRow = (parts = [], options = {}) => {
      const chart = document.createElement('div');
      chart.className = 'weather-menu-temp-chart';

      const SVG_NS = 'http://www.w3.org/2000/svg';
      const VIEW_W = 100;
      const VIEW_H = 100;
      const TOP = 20;
      const BOTTOM = 82;
      const gradientId = `temp-grad-${Math.random().toString(36).slice(2)}`;

      const byName = Object.fromEntries(parts.map((part) => [part.name, part]));
      const columnCenter = (index) => (VIEW_W / PERIOD_ORDER.length) * (index + 0.5);

      const allPoints = PERIOD_ORDER.map((name, index) => ({
        name,
        temp: byName[name]?.temp,
        label: byName[name]?.label || '',
        x: columnCenter(index),
      }));

      const availableTemps = allPoints
        .map((point) => point.temp)
        .filter((temp) => Number.isFinite(temp));

      const minTemp = availableTemps.length ? Math.min(...availableTemps) : null;
      const maxTemp = availableTemps.length ? Math.max(...availableTemps) : null;
      const tempRange = minTemp != null && maxTemp != null
        ? Math.max(1, maxTemp - minTemp)
        : 1;

      const points = allPoints
        .filter((point) => Number.isFinite(point.temp))
        .map((point) => ({
          ...point,
          y: minTemp == null
            ? (TOP + BOTTOM) / 2
            : BOTTOM - ((point.temp - minTemp) / tempRange) * (BOTTOM - TOP),
        }));

      const smoothPath = (pathPoints) => {
        if (!pathPoints.length) return '';
        if (pathPoints.length === 1) return `M ${pathPoints[0].x} ${pathPoints[0].y}`;

        let d = `M ${pathPoints[0].x} ${pathPoints[0].y}`;
        for (let i = 0; i < pathPoints.length - 1; i += 1) {
          const current = pathPoints[i];
          const next = pathPoints[i + 1];
          const midX = (current.x + next.x) / 2;
          d += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
        }
        return d;
      };

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'weather-menu-temp-svg');
      svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
      svg.setAttribute('preserveAspectRatio', 'none');

      const plot = document.createElement('div');
      plot.className = 'weather-menu-temp-plot';
      plot.appendChild(svg);

      if (options.showCurrentTime) {
        const nowMarker = document.createElement('span');
        nowMarker.className = 'weather-menu-temp-now';
        nowMarker.style.left = `${currentDayPercent()}%`;
        nowMarker.title = 'Current time';
        plot.appendChild(nowMarker);
      }

      if (points.length) {
        const defs = document.createElementNS(SVG_NS, 'defs');
        const gradient = document.createElementNS(SVG_NS, 'linearGradient');
        gradient.setAttribute('id', gradientId);
        gradient.setAttribute('x1', '0');
        gradient.setAttribute('y1', '0');
        gradient.setAttribute('x2', '0');
        gradient.setAttribute('y2', '1');
        [
          ['0%', 'rgba(74, 132, 216, 0.32)'],
          ['100%', 'rgba(74, 132, 216, 0)'],
        ].forEach(([offset, color]) => {
          const stop = document.createElementNS(SVG_NS, 'stop');
          stop.setAttribute('offset', offset);
          stop.setAttribute('stop-color', color);
          gradient.appendChild(stop);
        });
        defs.appendChild(gradient);
        svg.appendChild(defs);

        const linePath = smoothPath(points);

        const area = document.createElementNS(SVG_NS, 'path');
        area.setAttribute('class', 'weather-menu-temp-area');
        area.setAttribute(
          'd',
          `${linePath} L ${points[points.length - 1].x} ${VIEW_H} L ${points[0].x} ${VIEW_H} Z`,
        );
        area.setAttribute('fill', `url(#${gradientId})`);
        svg.appendChild(area);

        const line = document.createElementNS(SVG_NS, 'path');
        line.setAttribute('class', 'weather-menu-temp-line');
        line.setAttribute('d', linePath);
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(line);

        points.forEach((point) => {
          const dot = document.createElement('span');
          dot.className = 'weather-menu-temp-dot';
          dot.style.left = `${point.x}%`;
          dot.style.top = `${(point.y / VIEW_H) * 100}%`;
          if (point.label) dot.title = point.label;
          plot.appendChild(dot);
        });
      }

      const values = document.createElement('div');
      values.className = 'weather-menu-temp-values';
      const captions = document.createElement('div');
      captions.className = 'weather-menu-temp-labels';

      PERIOD_ORDER.forEach((name) => {
        const part = byName[name];
        const hasTemp = part && Number.isFinite(part.temp);

        const value = document.createElement('span');
        value.className = 'weather-menu-temp-value';
        if (!hasTemp) value.classList.add('is-empty');
        value.textContent = hasTemp ? `${part.temp}°` : '--';
        if (part?.label) value.title = part.label;
        values.appendChild(value);

        const caption = document.createElement('span');
        caption.className = 'weather-menu-temp-caption';
        if (!hasTemp) caption.classList.add('is-empty');
        caption.textContent = hasTemp ? (part.timeLabel || name) : '--';
        captions.appendChild(caption);
      });

      chart.append(values, plot, captions);

      return chart;
    };

    const addDayBlock = (day, extraClass = '') => {
      const block = document.createElement('div');
      block.className = `weather-menu-day-block${extraClass ? ` ${extraClass}` : ''}`;

      const row = document.createElement('div');
      row.className = 'weather-menu-row';

      const dayNode = document.createElement('span');
      dayNode.className = 'weather-menu-day';
      dayNode.textContent = day.day || '--';

      const labelNode = document.createElement('span');
      labelNode.className = 'weather-menu-label';
      labelNode.textContent = `${day.emoji || '🌤️'} ${day.label || 'Unknown'}`;

      const tempNode = document.createElement('span');
      tempNode.className = 'weather-menu-temp';
      const min = day.min == null ? '--' : `${day.min}°`;
      const max = day.max == null ? '--' : `${day.max}°`;
      tempNode.textContent = `${min} / ${max}`;

      row.append(dayNode, labelNode, tempNode);
      block.append(
        row,
        createMetricRow(day.metrics, 'weather-menu-metrics', { includeFeels: false, includeAstronomy: false }),
        makePartRow(day.parts, { showCurrentTime: extraClass.includes('is-today') }),
      );
      rows.appendChild(block);
    };

    if (forecast.today) {
      addDayBlock(forecast.today, 'is-today');
    }

    if (!forecast.nextDays.length) {
      const empty = document.createElement('div');
      empty.className = 'weather-menu-empty';
      empty.textContent = 'Forecast unavailable';
      rows.appendChild(empty);
    } else {
      forecast.nextDays.forEach((day) => addDayBlock(day));
    }

    menu.appendChild(rows);
    menuWrapper.appendChild(menu);
    weather.append(current, menuWrapper);
  };

  const fetchForecast = async (location) => {
    const target = location ? encodeURIComponent(location) : '';
    const endpoint = `https://wttr.in/${target}?format=j1`;
    const res = await window.fetch(endpoint);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();
    return normalizeWeather(data);
  };

  let renderedForecastJson = '';
  let loading = false;

  const loadWeather = async () => {
    if (loading) return;
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
      loading = true;
      try {
        forecast = await fetchForecast(location);
        window.localStorage.setItem(key, JSON.stringify({
          forecast,
          expire: Date.now() + 15 * 60 * 1000,
        }));
      } catch (e) {
        console.warn('Failed to fetch weather', e);
        window.localStorage.removeItem(key);
        // Keep showing the previous forecast until a refresh succeeds
        return;
      } finally {
        loading = false;
      }
    }

    // Only rebuild the DOM when the forecast actually changed
    const serialized = JSON.stringify(forecast);
    if (serialized === renderedForecastJson) return;
    renderedForecastJson = serialized;
    renderForecast(forecast);
  };

  document.addEventListener('settings:weatherLocationChanged', () => {
    loadWeather();
  });

  // Refresh at interval while the tab is open (fetches only once the cache expires)
  setInterval(() => {
    if (!document.hidden) loadWeather();
  }, 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadWeather();
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

  const readCache = () => {
    try {
      const cached = JSON.parse(window.localStorage.getItem(storageKey));
      if (cached && cached.expire > Date.now()) return cached.qotd;
    } catch (e) {
      // Corrupted cache, fetch a fresh one
    }
    return null;
  };

  const fetchQuote = async () => {
    const res = await window.fetch('https://raw.githubusercontent.com/dwyl/quotes/master/quotes.json');
    if (!res.ok) throw new Error('Quotes fetch error');
    const quotes = (await res.json()).filter(({ text, author }) => author && text.length < 90);
    return quotes[Math.floor(quotes.length * Math.random())];
  };

  let renderedText = null;
  let loading = false;

  const loadQuote = async () => {
    if (loading) return;

    let qotd = readCache();
    if (!qotd) {
      loading = true;
      try {
        qotd = await fetchQuote();
        window.localStorage.setItem(storageKey, JSON.stringify({
          qotd,
          expire: Date.now() + 12 * 3600 * 1000,
        }));
      } catch (e) {
        console.warn('Failed to fetch quote', e);
        // Keep showing the previous quote until a refresh succeeds
        return;
      } finally {
        loading = false;
      }
    }

    if (!qotd || qotd.text === renderedText) return;
    renderedText = qotd.text;
    quoteText.textContent = /\w$/.test(qotd.text) ? `${qotd.text}.` : qotd.text;
    quoteAuthor.textContent = qotd.author;
  };

  // Refresh at interval while the tab is open (fetches only once the cache expires)
  setInterval(() => {
    if (!document.hidden) loadQuote();
  }, 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadQuote();
  });

  loadQuote();
})();

// ---------------------------------------------------------------------------------------------- //
// SONOS
// ---------------------------------------------------------------------------------------------- //

(async () => {
  const container = document.querySelector('.sonos-info');
  const roomsEl = document.querySelector('.sonos-rooms');
  const menu = document.querySelector('.sonos-menu');
  if (!container || !roomsEl || !menu) return;

  const API_BASE = 'https://sonos-api.proxy.cloud.jclerc.com/';
  const POLL_MS = 4000;
  const VOLUME_SEND_DEBOUNCE_MS = 150;

  // Room names to hide entirely, as SHA-1 hashes rather than plaintext so the
  // actual names aren't visible in the public source.
  const BLACKLISTED_ROOM_NAME_HASHES = [
    '2ae4087c9f06d9d6403fbe2fe484e6570f4f4065',
    'ccd02caf5ce6d1286b7f92c24c2d7827ee698ab6',
  ];

  const getToken = () => window.homeSettings?.get?.().sonosBearerToken || '';

  const apiUrl = (path) => new URL(path.replace(/^\//, ''), API_BASE).toString();

  const api = async (path) => {
    const token = getToken();
    let res;
    try {
      res = await fetch(apiUrl(path), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (e) {
      throw new Error('Network error — the Sonos API may be unreachable, or blocking this origin (CORS)');
    }
    if (!res.ok) {
      const err = new Error(`Sonos API error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('json') ? res.json() : null;
  };

  // currentTrack.absoluteAlbumArtUri and favorites' albumArtUri are already
  // full, directly-loadable URLs — no proxying/auth needed, just an <img>.
  const setArtImage = (container, url) => {
    if (!url) {
      container.textContent = '♪';
      return;
    }
    container.textContent = ''; // clear any prior placeholder before adding the image
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.onerror = () => { container.textContent = '♪'; };
    container.appendChild(img);
  };

  const normalizeTrack = (track) => {
    const title = (track?.title || '').trim();
    if (!title) return null;
    return {
      title,
      artist: (track.artist || '').trim(),
      album: (track.album || '').trim(),
      art: track.absoluteAlbumArtUri || null,
    };
  };

  const parseBattery = (state) => {
    const info = (state?.moreInfo || '').toString();
    const pctMatch = info.match(/BattPct:(\d+)/);
    if (!pctMatch) return null;
    const chargingMatch = info.match(/BattChg:(\w+)/);
    return {
      pct: Number.parseInt(pctMatch[1], 10),
      charging: !!chargingMatch && chargingMatch[1] === 'CHARGING',
    };
  };

  // repeat can be a string enum ("none" | "one" | "all") rather than boolean.
  const isModeActive = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      return normalized !== '' && normalized !== 'off' && normalized !== 'none' && normalized !== 'false';
    }
    return !!value;
  };

  const normalizeGroup = (raw) => {
    const coordinator = raw?.coordinator || raw || {};
    const rawMembers = Array.isArray(raw?.members) && raw.members.length ? raw.members : [coordinator];
    const unsortedMembers = rawMembers.map(member => ({
      roomName: member?.roomName || member?.name || coordinator.roomName || 'Room',
      state: member?.state || {},
    }));
    const id = raw?.uuid || coordinator.roomName || unsortedMembers[0].roomName;
    const coordinatorName = coordinator.roomName || unsortedMembers[0].roomName;
    const members = [...unsortedMembers].sort((a, b) => a.roomName.localeCompare(b.roomName));

    const coordinatorState = coordinator.state || {};
    const playMode = coordinatorState.playMode || {};

    return {
      id,
      coordinatorName,
      members,
      isPlaying: (coordinatorState.playbackState || '').toString().toUpperCase() === 'PLAYING',
      track: normalizeTrack(coordinatorState.currentTrack),
      elapsedTime: coordinatorState.elapsedTime ?? null,
      duration: coordinatorState.currentTrack?.duration ?? null,
      volume: coordinator.groupState?.volume ?? coordinatorState.volume ?? null,
      mute: coordinator.groupState?.mute ?? !!coordinatorState.mute,
      playMode: {
        shuffle: isModeActive(playMode.shuffle),
        repeat: isModeActive(playMode.repeat),
        repeatRaw: (playMode.repeat || '').toString().toLowerCase(),
        crossfade: isModeActive(playMode.crossfade),
      },
    };
  };

  // Playing rooms first, then alphabetical.
  // Sort by each group's alphabetically-first member (not the API's chosen
  // coordinator, which can be any member) — members are already sorted, so
  // that's simply members[0].
  const normalizeZones = (raw) => (Array.isArray(raw) ? raw.map(normalizeGroup) : [])
    .sort((a, b) => a.members[0].roomName.localeCompare(b.members[0].roomName));

  // Removes blacklisted rooms so they never show up at all, as if they
  // didn't exist. A group loses just the blacklisted member(s); if that
  // leaves it with none, the whole group is dropped.
  const isBlacklistedName = async (name) => BLACKLISTED_ROOM_NAME_HASHES.includes(await sha1Hex(name));

  const filterBlacklistedGroups = async (groupsToFilter) => {
    const filtered = [];
    for (const group of groupsToFilter) {
      const keepFlags = await Promise.all(group.members.map(member => isBlacklistedName(member.roomName).then(b => !b)));
      const keptMembers = group.members.filter((_, index) => keepFlags[index]);
      if (keptMembers.length) filtered.push({ ...group, members: keptMembers });
    }
    return filtered;
  };

  // --- State ---
  let groups = [];
  let loaded = false;
  let expandedId = null;
  let expandedMode = null; // 'controls' | 'grouping'
  const expandedFavoritesIds = new Set();
  const expandedQueueIds = new Set();
  const expandedSleepIds = new Set();
  let draggedRoom = null;
  let draggedFromGroupId = null;
  let ungroupZoneAfter = null;
  let favoritesCache = null;
  let favoritesLoadPromise = null;
  const queueCache = new Map(); // roomName -> items array
  // The API doesn't report the currently-running sleep timer, so this is a
  // client-side-only record of the last option picked per room, defaulting
  // to "off" until the user sets one.
  const sleepSelection = new Map(); // roomName -> sleep value ('off' | seconds string)
  let pollTimer = null;
  let refreshDebounceTimer = null;
  let burstRefreshInterval = null;
  let burstRefreshTimeout = null;
  let progressTicker = null;
  let interacting = false;
  let lastError = null;
  const volumeThrottleTimers = new Map();
  const loaderEl = document.querySelector('.sonos-loader');

  const formatClock = (totalSeconds) => {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Reserves ~100px of height up front so a section expanding into "Loading…"
  // and then into its real (differently-sized) content doesn't jump twice.
  const showInlineLoading = (el) => {
    el.textContent = '';
    el.classList.add('sonos-inline-loading');
    const spinner = document.createElement('div');
    spinner.className = 'sonos-inline-spinner';
    el.appendChild(spinner);
  };

  // Range inputs have no native cross-browser "filled" track, so paint it
  // manually as a gradient split at the current value.
  const applySliderFill = (slider) => {
    const min = Number(slider.min) || 0;
    const max = Number(slider.max) || 100;
    const value = Number(slider.value) || 0;
    const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    slider.style.background = `linear-gradient(to right, #4a84d8 0%, #4a84d8 ${pct}%, rgba(103, 122, 145, 0.28) ${pct}%, rgba(103, 122, 145, 0.28) 100%)`;
  };

  // Reference-counted so overlapping refreshes (a regular poll landing
  // mid-burst, etc.) don't let one finishing early hide the loader while
  // another is still in flight. Also enforces a minimum visible time so a
  // fast request doesn't just flash the spinner for a few ms.
  const MIN_LOADER_MS = 500;
  let refreshInFlightCount = 0;
  let loaderShownAt = 0;
  let loaderHideTimer = null;
  const beginRefreshIndicator = () => {
    refreshInFlightCount += 1;
    if (refreshInFlightCount === 1) {
      clearTimeout(loaderHideTimer);
      loaderHideTimer = null;
      loaderShownAt = Date.now();
      loaderEl?.classList.add('is-active');
    }
  };
  const endRefreshIndicator = () => {
    refreshInFlightCount = Math.max(0, refreshInFlightCount - 1);
    if (refreshInFlightCount > 0) return;
    const remaining = Math.max(0, MIN_LOADER_MS - (Date.now() - loaderShownAt));
    clearTimeout(loaderHideTimer);
    loaderHideTimer = setTimeout(() => {
      if (refreshInFlightCount === 0) loaderEl?.classList.remove('is-active');
    }, remaining);
  };

  const stopBurstRefresh = () => {
    clearInterval(burstRefreshInterval);
    clearTimeout(burstRefreshTimeout);
    burstRefreshInterval = null;
    burstRefreshTimeout = null;
  };

  // After a mutating action (grouping, playback, ...), poll every second for
  // 5 seconds so the UI catches up quickly. The loader itself is driven by
  // refresh() (shown for every zones refresh, not just bursts).
  const startBurstRefresh = () => {
    clearInterval(burstRefreshInterval);
    clearTimeout(burstRefreshTimeout);
    refresh();
    burstRefreshInterval = setInterval(refresh, 1000);
    burstRefreshTimeout = setTimeout(stopBurstRefresh, 5000);
  };

  const stopProgressTicker = () => {
    clearInterval(progressTicker);
    progressTicker = null;
  };

  // Locally extrapolates playback position between polls instead of only
  // updating on each refresh, so the bar actually moves. Once the estimated
  // position reaches the track's duration, forces a refresh to pick up
  // whatever's playing next.
  const startProgressTicker = () => {
    if (progressTicker) return;
    progressTicker = setInterval(() => {
      if (expandedMode !== 'controls' || expandedId == null) return;
      const group = groups.find(g => g.id === expandedId);
      if (!group || !group.isPlaying || !group.duration || group.fetchedAt == null) return;

      const elapsed = Math.min(group.duration, (group.elapsedTime || 0) + (Date.now() - group.fetchedAt) / 1000);
      const fill = document.querySelector('.sonos-progress-fill');
      const currentEl = document.querySelector('.sonos-progress-current');
      if (fill) fill.style.width = `${Math.min(100, (elapsed / group.duration) * 100)}%`;
      if (currentEl) currentEl.textContent = formatClock(elapsed);

      if (elapsed >= group.duration) startBurstRefresh();
    }, 250);
  };

  const sendVolumeThrottled = (target, value, isGroupVolume = true) => {
    clearTimeout(volumeThrottleTimers.get(target.id));
    volumeThrottleTimers.set(target.id, setTimeout(async () => {
      volumeThrottleTimers.delete(target.id);
      const room = encodeURIComponent(target.coordinatorName);
      const path = isGroupVolume ? `/${room}/groupVolume/${value}` : `/${room}/volume/${value}`;
      try {
        await api(path);
      } catch (e) {
        console.warn('Sonos volume change failed', e);
      }
    }, VOLUME_SEND_DEBOUNCE_MS));
  };

  const ensureFavoritesLoaded = (anyRoomName) => {
    if (favoritesCache) return Promise.resolve(favoritesCache);
    if (!favoritesLoadPromise) {
      favoritesLoadPromise = api(`/${encodeURIComponent(anyRoomName)}/favorites/detailed`)
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          favoritesCache = list
            .map(item => ({
              name: (item?.title || '').toString().trim(),
              art: item?.albumArtUri || null,
              uri: (item?.uri || '').toString().trim(),
            }))
            // Entries without a uri are folders/section headers, not playable.
            .filter(favorite => favorite.name && favorite.uri);
          return favoritesCache;
        })
        .catch((e) => {
          favoritesLoadPromise = null;
          throw e;
        });
    }
    return favoritesLoadPromise;
  };

  // Favorites/Queue/Sleep are mutually exclusive within a room's controls —
  // opening one closes whichever of the other two was open for that room.
  const toggleInnerSection = (targetSet, otherSets, id) => {
    const isOpen = targetSet.has(id);
    otherSets.forEach(set => set.delete(id));
    if (isOpen) targetSet.delete(id);
    else targetSet.add(id);
    renderRooms();
  };

  const setExpanded = (id, mode) => {
    if (expandedId === id && expandedMode === mode) {
      expandedId = null;
      expandedMode = null;
    } else {
      expandedId = id;
      expandedMode = mode;
      // Freshly opening a room's controls always starts with its inner
      // sections (Favorites/Queue/Sleep) collapsed.
      if (mode === 'controls') {
        expandedFavoritesIds.delete(id);
        expandedQueueIds.delete(id);
        expandedSleepIds.delete(id);
      }
    }
    renderRooms();
  };

  const renderFavoritesList = (el, favorites, group) => {
    el.classList.remove('sonos-inline-loading');
    el.textContent = '';
    if (!favorites.length) {
      el.textContent = 'No favorites found.';
      return;
    }
    favorites.forEach((favorite) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sonos-favorite-btn';

      const art = document.createElement('span');
      art.className = 'sonos-favorite-art';
      setArtImage(art, favorite.art);
      btn.appendChild(art);

      const label = document.createElement('span');
      label.className = 'sonos-favorite-name';
      label.textContent = favorite.name;
      btn.appendChild(label);

      btn.addEventListener('click', async () => {
        try {
          await api(`/${encodeURIComponent(group.coordinatorName)}/favorite/${encodeURIComponent(favorite.name)}`);
          startBurstRefresh();
        } catch (e) {
          console.warn('Sonos play favorite failed', e);
        }
      });
      el.appendChild(btn);
    });
  };

  const buildSleepSection = (group) => {
    const section = document.createElement('div');
    section.className = 'sonos-expanded-section';

    const isOpen = expandedSleepIds.has(group.id);
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'sonos-expanded-title sonos-section-toggle';
    header.textContent = `${isOpen ? '▾' : '▸'} 🌙 Sleep timer`;
    header.addEventListener('click', () => {
      toggleInnerSection(expandedSleepIds, [expandedFavoritesIds, expandedQueueIds], group.id);
    });
    section.appendChild(header);

    if (isOpen) {
      const buttons = document.createElement('div');
      buttons.className = 'sonos-sleep-buttons';
      const selected = sleepSelection.get(group.coordinatorName) || 'off';
      [['Off', 'off'], ['15 min', '900'], ['30 min', '1800'], ['45 min', '2700'], ['60 min', '3600']]
        .forEach(([label, value]) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sonos-sleep-btn';
          if (value === selected) btn.classList.add('is-active');
          btn.textContent = label;
          btn.addEventListener('click', async () => {
            try {
              await api(`/${encodeURIComponent(group.coordinatorName)}/sleep/${value}`);
              sleepSelection.set(group.coordinatorName, value);
              renderRooms();
            } catch (e) {
              console.warn('Sonos sleep timer failed', e);
            }
          });
          buttons.appendChild(btn);
        });
      section.appendChild(buttons);
    }

    return section;
  };

  const buildFavoritesSection = (group) => {
    const section = document.createElement('div');
    section.className = 'sonos-expanded-section';

    const isOpen = expandedFavoritesIds.has(group.id);
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'sonos-expanded-title sonos-section-toggle';
    header.textContent = `${isOpen ? '▾' : '▸'} ⭐ Favorites`;
    header.addEventListener('click', () => {
      toggleInnerSection(expandedFavoritesIds, [expandedQueueIds, expandedSleepIds], group.id);
    });
    section.appendChild(header);

    if (isOpen) {
      const list = document.createElement('div');
      list.className = 'sonos-favorites-list';
      if (favoritesCache) {
        renderFavoritesList(list, favoritesCache, group);
      } else {
        showInlineLoading(list);
        ensureFavoritesLoaded(group.coordinatorName)
          .then(favorites => renderFavoritesList(list, favorites, group))
          .catch(() => {
            list.classList.remove('sonos-inline-loading');
            list.textContent = 'Failed to load favorites.';
          });
      }
      section.appendChild(list);
    }

    return section;
  };

  const renderQueueItems = (el, items, group) => {
    el.classList.remove('sonos-inline-loading');
    el.textContent = '';
    if (!items.length) {
      el.textContent = 'Queue is empty.';
      return;
    }
    items.forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'sonos-queue-item';
      const title = document.createElement('span');
      title.className = 'sonos-queue-item-title';
      title.textContent = item?.title || 'Unknown';
      const artist = document.createElement('span');
      artist.className = 'sonos-queue-item-artist';
      artist.textContent = item?.artist || '';
      row.append(title, artist);
      row.addEventListener('click', async () => {
        try {
          await api(`/${encodeURIComponent(group.coordinatorName)}/trackseek/${index + 1}`);
          startBurstRefresh();
        } catch (e) {
          console.warn('Sonos trackseek failed', e);
        }
      });
      el.appendChild(row);
    });
  };

  const buildQueueSection = (group) => {
    const section = document.createElement('div');
    section.className = 'sonos-expanded-section';

    const isOpen = expandedQueueIds.has(group.id);
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'sonos-expanded-title sonos-section-toggle';
    header.textContent = `${isOpen ? '▾' : '▸'} 📜 Queue`;
    header.addEventListener('click', () => {
      toggleInnerSection(expandedQueueIds, [expandedFavoritesIds, expandedSleepIds], group.id);
    });
    section.appendChild(header);

    if (isOpen) {
      const list = document.createElement('div');
      list.className = 'sonos-queue-list';
      const cached = queueCache.get(group.coordinatorName);
      if (cached) renderQueueItems(list, cached, group);
      else showInlineLoading(list);

      // Refresh in the background; keep showing the last-known list until
      // the new one arrives instead of flashing back to "Loading…".
      api(`/${encodeURIComponent(group.coordinatorName)}/queue`).then((queue) => {
        const items = (Array.isArray(queue) ? queue : []).slice(0, 20);
        queueCache.set(group.coordinatorName, items);
        renderQueueItems(list, items, group);
      }).catch(() => {
        if (!cached) {
          list.classList.remove('sonos-inline-loading');
          list.textContent = 'Failed to load queue.';
        }
      });

      section.appendChild(list);
    }

    return section;
  };

  const renderControlsPanel = (group) => {
    const wrap = document.createElement('div');
    wrap.className = 'sonos-expanded';
    wrap.addEventListener('click', e => e.stopPropagation());
    wrap.addEventListener('dragstart', e => e.stopPropagation());

    // Progress bar
    if (group.track && group.duration) {
      const progressSection = document.createElement('div');
      progressSection.className = 'sonos-expanded-section';

      const row = document.createElement('div');
      row.className = 'sonos-progress-row';

      const currentEl = document.createElement('span');
      currentEl.className = 'sonos-progress-time sonos-progress-current';
      currentEl.textContent = formatClock(group.elapsedTime || 0);

      const bar = document.createElement('div');
      bar.className = 'sonos-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'sonos-progress-fill';
      const pct = group.duration > 0
        ? Math.max(0, Math.min(100, ((group.elapsedTime || 0) / group.duration) * 100))
        : 0;
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      bar.addEventListener('click', async (e) => {
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const seconds = Math.round(ratio * group.duration);
        fill.style.width = `${ratio * 100}%`;
        currentEl.textContent = formatClock(seconds);
        try {
          await api(`/${encodeURIComponent(group.coordinatorName)}/timeseek/${seconds}`);
          startBurstRefresh();
        } catch (err) {
          console.warn('Sonos timeseek failed', err);
        }
      });

      const totalEl = document.createElement('span');
      totalEl.className = 'sonos-progress-time sonos-progress-total';
      totalEl.textContent = formatClock(group.duration);

      row.append(currentEl, bar, totalEl);
      progressSection.appendChild(row);
      wrap.appendChild(progressSection);
    }

    // Transport controls
    const transport = document.createElement('div');
    transport.className = 'sonos-expanded-section sonos-transport-row';

    const makeTransportBtn = (label, ariaLabel, action, extraClass = '') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sonos-transport-btn${extraClass ? ` ${extraClass}` : ''}`;
      btn.textContent = label;
      btn.setAttribute('aria-label', ariaLabel);
      btn.addEventListener('click', async () => {
        try {
          await api(`/${encodeURIComponent(group.coordinatorName)}/${action}`);
          startBurstRefresh();
        } catch (e) {
          console.warn(`Sonos ${action} failed`, e);
        }
      });
      return btn;
    };

    transport.appendChild(makeTransportBtn('⏮', 'Previous track', 'previous'));
    transport.appendChild(makeTransportBtn(
      group.isPlaying ? '⏸' : '▶',
      group.isPlaying ? 'Pause' : 'Play',
      'playpause',
      'sonos-transport-btn-primary',
    ));
    transport.appendChild(makeTransportBtn('⏭', 'Next track', 'next'));
    wrap.appendChild(transport);

    // Per-member volume balance
    if (group.members.length > 1) {
      const section = document.createElement('div');
      section.className = 'sonos-expanded-section';
      const title = document.createElement('div');
      title.className = 'sonos-expanded-title';
      title.textContent = 'Room balance';
      section.appendChild(title);

      group.members.forEach((member) => {
        const row = document.createElement('div');
        row.className = 'sonos-balance-row';
        const label = document.createElement('span');
        label.className = 'sonos-balance-label';
        label.textContent = member.roomName;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = String(member.state?.volume ?? 0);
        applySliderFill(slider);

        const valueEl = document.createElement('span');
        valueEl.className = 'sonos-balance-value';
        valueEl.textContent = String(member.state?.volume ?? 0);

        slider.addEventListener('input', () => {
          valueEl.textContent = slider.value;
          applySliderFill(slider);
          sendVolumeThrottled({ id: `member:${member.roomName}`, coordinatorName: member.roomName }, Number.parseInt(slider.value, 10), false);
        });
        row.append(label, slider, valueEl);
        section.appendChild(row);
      });
      wrap.appendChild(section);
    }

    // Playback modes
    const modes = document.createElement('div');
    modes.className = 'sonos-expanded-section sonos-mode-buttons';
    [
      { key: 'shuffle', label: '🔀 Shuffle', active: group.playMode.shuffle },
      { key: 'repeat', label: group.playMode.repeatRaw === 'one' ? '1️⃣ Repeat' : '🔁 Repeat', active: group.playMode.repeat },
      { key: 'crossfade', label: '⤭ Crossfade', active: group.playMode.crossfade },
    ].forEach(({ key, label, active }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sonos-mode-btn';
      if (active) btn.classList.add('is-active');
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        try {
          await api(`/${encodeURIComponent(group.coordinatorName)}/${key}/toggle`);
          startBurstRefresh();
        } catch (e) {
          console.warn(`Sonos ${key} toggle failed`, e);
        }
      });
      modes.appendChild(btn);
    });
    wrap.appendChild(modes);

    wrap.appendChild(buildFavoritesSection(group));
    wrap.appendChild(buildQueueSection(group));
    wrap.appendChild(buildSleepSection(group));

    return wrap;
  };

  const renderGroupingPanel = (group) => {
    const wrap = document.createElement('div');
    wrap.className = 'sonos-expanded';
    wrap.addEventListener('click', e => e.stopPropagation());
    wrap.addEventListener('dragstart', e => e.stopPropagation());

    const section = document.createElement('div');
    section.className = 'sonos-expanded-section';
    const title = document.createElement('div');
    title.className = 'sonos-expanded-title';
    title.textContent = 'Group with';
    section.appendChild(title);

    // Flattened, per-room list (not per-group) so rooms already in this
    // group show up as active/toggleable alongside everyone else.
    const otherRooms = groups
      .flatMap(g => g.members.map(m => ({ roomName: m.roomName, groupId: g.id })))
      .filter(room => room.roomName !== group.coordinatorName);

    const canUngroupAll = group.members.length > 1;

    if (otherRooms.length || canUngroupAll) {
      const list = document.createElement('div');
      list.className = 'sonos-grouping-list';
      otherRooms.forEach((room) => {
        const isInThisGroup = room.groupId === group.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sonos-grouping-btn';
        if (isInThisGroup) btn.classList.add('is-active');
        btn.textContent = room.roomName;
        btn.addEventListener('click', async () => {
          try {
            if (isInThisGroup) {
              // Toggle off: remove it from this group.
              await api(`/${encodeURIComponent(room.roomName)}/leave`);
            } else {
              // The other room joins THIS group (not the other way around).
              await api(`/${encodeURIComponent(room.roomName)}/join/${encodeURIComponent(group.coordinatorName)}`);
            }
            startBurstRefresh();
          } catch (e) {
            console.warn('Sonos group toggle failed', e);
          }
        });
        list.appendChild(btn);
      });

      if (canUngroupAll) {
        const leaveBtn = document.createElement('button');
        leaveBtn.type = 'button';
        leaveBtn.className = 'sonos-grouping-btn sonos-leave-btn';
        leaveBtn.textContent = 'Ungroup all';
        leaveBtn.addEventListener('click', async () => {
          try {
            await Promise.all(group.members
              .filter(m => m.roomName !== group.coordinatorName)
              .map(m => api(`/${encodeURIComponent(m.roomName)}/leave`)));
            startBurstRefresh();
          } catch (e) {
            console.warn('Sonos ungroup failed', e);
          }
        });
        list.appendChild(leaveBtn);
      }

      section.appendChild(list);
    } else {
      const empty = document.createElement('div');
      empty.className = 'sonos-empty';
      empty.textContent = 'No other rooms available.';
      section.appendChild(empty);
    }

    wrap.appendChild(section);
    return wrap;
  };

  // Shown right after a grouped room's card the moment you start dragging
  // one of its members, as an explicit "drop here to ungroup" target.
  const makeUngroupZone = () => {
    const zone = document.createElement('div');
    zone.className = 'sonos-ungroup-zone';
    zone.textContent = 'Drop here to ungroup';
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('is-drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-drag-over'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedRoom) return;
      try {
        await api(`/${encodeURIComponent(draggedRoom)}/leave`);
        startBurstRefresh();
      } catch (err) {
        console.warn('Sonos leave failed', err);
      }
    });
    return zone;
  };

  const showUngroupZones = (cardEl) => {
    ungroupZoneAfter = makeUngroupZone();
    cardEl.parentNode.insertBefore(ungroupZoneAfter, cardEl.nextSibling);
  };

  const removeUngroupZones = () => {
    if (ungroupZoneAfter) { ungroupZoneAfter.remove(); ungroupZoneAfter = null; }
  };

  const renderRoomCard = (group) => {
    const card = document.createElement('div');
    card.className = 'sonos-zone';
    card.dataset.groupId = group.id;
    if (group.isPlaying) {
      card.classList.add('is-playing');
      // The card is recreated on every render (poll/burst), which would
      // otherwise restart the pulse animation from 0 each time — offset it
      // to where a continuously-running clock would be so it looks seamless.
      card.style.animationDelay = `-${Date.now() % 2400}ms`;
    }

    // Holds the compact (always-visible) header/track/volume rows. The
    // expanded panel is appended to `card` as a SIBLING of this, not a
    // descendant — so a click inside it can never reach summary's own
    // click-to-toggle listener, regardless of stopPropagation/DOM-rebuild
    // timing quirks.
    const summary = document.createElement('div');
    summary.className = 'sonos-zone-summary';

    const header = document.createElement('div');
    header.className = 'sonos-zone-header';
    group.members.forEach((member) => {
      const chip = document.createElement('span');
      chip.className = 'sonos-room-chip';
      chip.textContent = member.roomName;
      chip.draggable = true;

      const battery = parseBattery(member.state);
      if (battery) {
        const badge = document.createElement('span');
        badge.className = 'sonos-battery';
        badge.textContent = `${battery.charging ? '⚡' : ''}${battery.pct}%`;
        chip.appendChild(badge);
      }

      chip.addEventListener('dragstart', (e) => {
        draggedRoom = member.roomName;
        draggedFromGroupId = group.id;
        chip.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', member.roomName);
        // Deferred: mutating the DOM synchronously inside dragstart (while the
        // browser is still capturing the drag image) can abort the drag —
        // do this just after this handler returns instead.
        setTimeout(() => {
          // Collapsing (if needed) rebuilds every card, replacing `card` —
          // re-fetch the fresh element afterwards rather than use the stale
          // reference so the ungroup zone gets inserted in the live DOM.
          if (expandedId != null) {
            expandedId = null;
            expandedMode = null;
            renderRooms();
          }
          if (group.members.length > 1) {
            const freshCard = roomsEl.querySelector(`[data-group-id="${group.id}"]`);
            if (freshCard) showUngroupZones(freshCard);
          }
        }, 0);
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('is-dragging');
        draggedRoom = null;
        draggedFromGroupId = null;
        removeUngroupZones();
      });

      header.appendChild(chip);
    });
    summary.appendChild(header);

    const trackRow = document.createElement('div');
    trackRow.className = 'sonos-track-row';

    const art = document.createElement('div');
    art.className = 'sonos-art';
    setArtImage(art, group.track?.art);
    trackRow.appendChild(art);

    const info = document.createElement('div');
    info.className = 'sonos-track-info';
    const titleEl = document.createElement('div');
    titleEl.className = 'sonos-track-title';
    titleEl.textContent = group.track?.title || 'No music selected';
    if (group.track?.title) titleEl.title = group.track.title;
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'sonos-track-subtitle';
    subtitleEl.textContent = group.track ? (group.track.artist || group.track.album || '') : 'Queue is empty';
    info.append(titleEl, subtitleEl);
    trackRow.appendChild(info);

    const groupBtn = document.createElement('button');
    groupBtn.type = 'button';
    groupBtn.className = 'sonos-group-btn';
    groupBtn.textContent = '🔗';
    groupBtn.title = 'Grouping';
    groupBtn.setAttribute('aria-label', 'Grouping options');
    groupBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setExpanded(group.id, 'grouping');
    });
    trackRow.appendChild(groupBtn);

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'sonos-play-btn';
    playBtn.textContent = group.isPlaying ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', group.isPlaying ? 'Pause' : 'Play');
    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await api(`/${encodeURIComponent(group.coordinatorName)}/playpause`);
        startBurstRefresh();
      } catch (err) {
        console.warn('Sonos playpause failed', err);
      }
    });
    trackRow.appendChild(playBtn);

    summary.appendChild(trackRow);

    const volumeRow = document.createElement('div');
    volumeRow.className = 'sonos-volume-row';

    const muteBtn = document.createElement('button');
    muteBtn.type = 'button';
    muteBtn.className = 'sonos-mute-btn';
    muteBtn.textContent = group.mute ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', group.mute ? 'Unmute' : 'Mute');
    muteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        // togglemute only mutes the coordinator's own speaker — grouped
        // rooms need the group-wide endpoint to mute everyone in the group.
        const path = group.members.length > 1
          ? (group.mute ? 'groupUnmute' : 'groupMute')
          : 'togglemute';
        await api(`/${encodeURIComponent(group.coordinatorName)}/${path}`);
        startBurstRefresh();
      } catch (err) {
        console.warn('Sonos mute toggle failed', err);
      }
    });
    volumeRow.appendChild(muteBtn);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(group.volume ?? 0);
    slider.className = 'sonos-volume-slider';
    slider.addEventListener('click', e => e.stopPropagation());
    applySliderFill(slider);

    const valueEl = document.createElement('span');
    valueEl.className = 'sonos-volume-value';
    valueEl.textContent = group.volume == null ? '--' : String(group.volume);

    slider.addEventListener('input', () => {
      valueEl.textContent = slider.value;
      applySliderFill(slider);
      sendVolumeThrottled(group, Number.parseInt(slider.value, 10), group.members.length > 1);
    });
    volumeRow.appendChild(slider);
    volumeRow.appendChild(valueEl);

    summary.appendChild(volumeRow);
    card.appendChild(summary);

    // Click to expand more controls — scoped to summary (not the whole
    // card), so it structurally cannot fire for clicks inside the expanded
    // panel, which is appended as summary's sibling below.
    summary.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, a, .sonos-room-chip')) return;
      setExpanded(group.id, 'controls');
    });

    // Drag & drop onto this card = join this group
    card.addEventListener('dragover', (e) => {
      if (!draggedRoom || draggedFromGroupId === group.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('is-drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('is-drag-over');
      if (!draggedRoom || draggedFromGroupId === group.id) return;
      try {
        await api(`/${encodeURIComponent(draggedRoom)}/join/${encodeURIComponent(group.coordinatorName)}`);
        startBurstRefresh();
      } catch (err) {
        console.warn('Sonos join failed', err);
      }
    });

    if (expandedId === group.id) {
      card.classList.add('is-expanded');
      card.appendChild(expandedMode === 'grouping' ? renderGroupingPanel(group) : renderControlsPanel(group));
    }

    return card;
  };

  function renderRooms() {
    roomsEl.textContent = '';

    if (!getToken()) {
      const empty = document.createElement('div');
      empty.className = 'sonos-empty';
      empty.textContent = 'Unlock in Settings to enable Sonos control.';
      roomsEl.appendChild(empty);
      return;
    }

    if (!loaded) {
      const message = document.createElement('div');
      message.className = 'sonos-empty';
      if (lastError) {
        message.classList.add('sonos-error');
        message.textContent = lastError.status === 401 || lastError.status === 403
          ? 'Invalid Sonos token — unlock again in Settings.'
          : `Couldn't reach Sonos (${lastError.message})`;
      } else {
        message.textContent = 'Loading rooms…';
      }
      roomsEl.appendChild(message);
      return;
    }

    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'sonos-empty';
      empty.textContent = 'No Sonos rooms found.';
      roomsEl.appendChild(empty);
      return;
    }

    groups.forEach(group => roomsEl.appendChild(renderRoomCard(group)));
  }

  async function refresh() {
    if (interacting) return;
    if (!getToken()) {
      loaded = false;
      lastError = null;
      renderRooms();
      return;
    }
    beginRefreshIndicator();
    try {
      const raw = await api('/zones');
      const fetchedAt = Date.now();
      const withTimestamp = normalizeZones(raw).map(group => ({ ...group, fetchedAt }));
      groups = await filterBlacklistedGroups(withTimestamp);
      loaded = true;
      lastError = null;
      renderRooms();
    } catch (e) {
      console.warn('Failed to refresh Sonos zones', e);
      lastError = e;
      renderRooms();
    } finally {
      endRefreshIndicator();
    }
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(refresh, delay);
  }

  const startPolling = () => {
    if (pollTimer) return;
    refresh();
    pollTimer = setInterval(refresh, POLL_MS);
    startProgressTicker();
  };

  // Closing the whole menu collapses whichever card's controls were open,
  // so reopening it later starts at the room list.
  const stopPolling = () => {
    clearInterval(pollTimer);
    pollTimer = null;
    stopProgressTicker();
    stopBurstRefresh();
    expandedId = null;
    expandedMode = null;
  };

  // Every render tears down and recreates the whole card subtree. That can
  // cause spurious mouseleave/focusout signals on the container — e.g. a
  // focused toggle button gets destroyed mid-click and focus falls away with
  // relatedTarget unreliable, or hover briefly un-matches while old elements
  // are gone and new ones haven't painted. Don't trust any single event: at
  // the moment the close would actually happen, re-check the real, live
  // hover/focus state and bail out if the user is still genuinely inside.
  let closeTimer = null;
  const cancelScheduledClose = () => {
    clearTimeout(closeTimer);
    closeTimer = null;
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (container.matches(':hover') || container.contains(document.activeElement)) return;
      container.classList.remove('is-open');
      stopPolling();
    }, 150);
  };

  container.addEventListener('mouseenter', () => {
    cancelScheduledClose();
    container.classList.add('is-open');
    startPolling();
  });
  container.addEventListener('focusin', () => {
    cancelScheduledClose();
    container.classList.add('is-open');
    startPolling();
  });
  container.addEventListener('mouseleave', scheduleClose);
  // relatedTarget is unreliable when the previously-focused element is
  // removed from the DOM by a re-render — defer to a fresh tick and check
  // document.activeElement directly instead of trusting this event alone.
  container.addEventListener('focusout', () => {
    setTimeout(scheduleClose, 0);
  });

  menu.addEventListener('mousedown', () => { interacting = true; });
  document.addEventListener('mouseup', () => {
    if (!interacting) return;
    interacting = false;
    scheduleRefresh(200);
  });

  renderRooms();
})();
