(() => {
  'use strict';
  const catalog = window.wasWasntLanguages;
  const key = 'waswasnt-language';
  let selected, explicit = false, complete, previousFocus;
  const dialog = document.getElementById('languages');
  const list = document.getElementById('language-list');
  const back = document.getElementById('language-back');
  const title = document.getElementById('language-title');
  const match = code => {
    if (!code) return null;
    code = code.replaceAll('_', '-').toLowerCase();
    return catalog.find(item => item.code.toLowerCase() === code) || catalog.find(item => item.code.toLowerCase() === code.split('-')[0]);
  };
  function apply(code) {
    selected = match(code);
    if (!selected) throw new Error('Отсутствует локаль страницы: ' + code);
    document.documentElement.lang = selected.code;
    document.title = "Was, Wasn't";
    if (window.wasWasntSetLocale) window.wasWasntSetLocale(selected.code);
  }
  function save(code) {
    apply(code); explicit = true;
    try { localStorage.setItem(key, selected.code); }
    catch (error) { console.warn('Не удалось сохранить выбранный язык: ' + error.message); }
  }
  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    if (previousFocus) previousFocus.focus();
  }
  function show(required, callback) {
    previousFocus = document.activeElement;
    complete = callback;
    title.textContent = selected ? selected.choose : "Was, Wasn't";
    back.hidden = required;
    back.textContent = selected ? selected.back : '';
    list.replaceChildren();
    catalog.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = item.name;
      button.setAttribute('aria-pressed', String(selected?.code === item.code));
      button.onclick = () => { save(item.code); close(); complete(item.code); };
      list.append(button);
    });
    dialog.hidden = false;
    (list.querySelector('[aria-pressed="true"]') || list.firstElementChild).focus();
  }
  back.onclick = close;
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); if (!back.hidden) close(); }
    if (event.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button')].filter(button => !button.hidden);
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
  window.wasWasntLanguage = {
    get explicitCode() { return explicit ? selected.code : ''; },
    get code() { return selected?.code || ''; },
    text(name) { return selected[name]; },
    save, sync: apply, close,
    show() { show(false, code => window.unityInstance.SendMessage('WasWasntConsoleHost', 'SelectLanguage', code)); },
    start() {
      let saved;
      try { saved = localStorage.getItem(key); } catch (error) { console.warn('Выбор языка недоступен: ' + error.message); }
      selected = match(saved); explicit = !!selected;
      if (saved && !selected) console.warn('Сохранённая локаль больше не доступна: ' + saved);
      if (!selected) selected = (navigator.languages || [navigator.language]).map(match).find(Boolean);
      if (selected) { apply(selected.code); return Promise.resolve(selected.code); }
      return new Promise(resolve => show(true, resolve));
    }
  };
})();
