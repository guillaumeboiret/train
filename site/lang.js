// One language for the whole site, picked in each page's head before anything renders (site/build.sh inlines this file).
// A ?lang= link wins and is remembered (then dropped from the address, so a later switch is not undone on reload),
// then the visitor's last pick (every page's switcher saves it under 'lang'), then the browser's languages, then English.
// Pages start in <html lang> and fall back to English if they lack it.
// The static <html lang> is the language the markup is written in: when the pick differs, the [data-i18n] text stays
// hidden until the page's script swaps its dictionary in and removes data-i18n-wait, so the wrong language never shows.
(() => {
  const OK = ['fr', 'en'], d = document.documentElement;
  let l = null;
  try {
    const q = new URLSearchParams(location.search);
    l = q.get('lang');
    if (OK.includes(l)){
      localStorage.setItem('lang', l);
      q.delete('lang');
      history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    } else l = localStorage.getItem('lang');
  } catch (e) {}
  if (!OK.includes(l)) l = (navigator.languages || [navigator.language]).map(x => String(x).split('-')[0].toLowerCase()).find(x => OK.includes(x)) || 'en';
  if (d.lang === l) return;
  d.lang = l;
  d.setAttribute('data-i18n-wait', '');
  const s = document.createElement('style');
  s.textContent = '[data-i18n-wait] [data-i18n]{ visibility:hidden; }';
  document.head.append(s);
})();
