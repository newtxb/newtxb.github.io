// Fetches Google's autocomplete suggestions for the search box (Chrome extension build).
//
// Dynamically loaded by google-suggest.js whenever running as the Chrome extension (see that
// file for why the website needs a different implementation: Manifest V3 pins the extension
// pages CSP to script-src 'self', so a remote <script> tag could never load in the extension
// anyway).
//
// Calls google-api.proxy.cloud.jclerc.com instead — a reverse proxy in front of Google's
// endpoint that adds a CORS header, so a plain fetch() works. Authenticated with the same
// bearer token that unlocks Sonos/Hue control (apiBearerToken, derived from the Settings
// unlock password) — until unlocked, apiBearerToken is empty, the proxy call fails auth,
// and the dropdown just silently doesn't appear (search itself still works fine).
window.googleSuggest = (q, onResult) => {
  const token = window.homeSettings?.get?.().apiBearerToken || '';
  window.fetch(`https://google-api.proxy.cloud.jclerc.com/complete/search?client=chrome&q=${q}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
    .then(res => res.json())
    .then(onResult)
    .catch(() => {});
};
