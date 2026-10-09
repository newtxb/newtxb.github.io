// Fetches Google's autocomplete suggestions for the search box (Chrome extension build).
//
// Dynamically loaded by google-suggest.js whenever running as the Chrome extension (see that
// file for why the website needs a different implementation: Manifest V3 pins the extension
// pages CSP to script-src 'self', so a remote <script> tag could never load in the extension
// anyway).
//
// Calls the google-api reverse proxy instead — in front of Google's endpoint, it adds a CORS
// header so a plain fetch() works. Its domain (apiProxyDomain) and bearer token
// (apiBearerToken) both come from the Settings unlock password, same as Sonos/Hue — until
// unlocked the dropdown just silently doesn't appear (search itself still works fine).
window.googleSuggest = (q, onResult) => {
  const { apiBearerToken: token, apiProxyDomain: domain } = window.homeSettings?.get?.() || {};
  if (!token || !domain) return;
  window.fetch(`https://google-api.${domain}/complete/search?client=chrome&q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(res => res.json())
    .then(onResult)
    .catch(() => {});
};
