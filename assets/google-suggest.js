// Fetches Google's autocomplete suggestions for the search box.
//
// Packaged as a Chrome extension, this instead dynamically loads google-suggest.ext.js,
// which defines window.googleSuggest via fetch() against a CORS-enabled reverse proxy —
// Manifest V3 pins the extension pages CSP to script-src 'self' with no way to allow a
// remote host, so the JSONP <script> tag below could never load there anyway.
//
// On the website: Google's endpoint sends no CORS headers, so a plain fetch() is rejected
// by the browser — a JSONP <script> tag isn't subject to CORS, so that's what we use here.
if (window.location.protocol === 'chrome-extension:') {
  const script = document.createElement('script');
  script.src = 'assets/google-suggest.ext.js';
  document.head.appendChild(script);
} else {
  window.googleSuggest = (q, onResult) => {
    const script = document.createElement('script');
    const callback = `_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    script.src = `https://www.google.com/complete/search?client=chrome&callback=${callback}&q=${q}`;
    document.body.appendChild(script);
    window[callback] = (args) => {
      script.remove();
      delete window[callback];
      onResult(args);
    };
  };
}
