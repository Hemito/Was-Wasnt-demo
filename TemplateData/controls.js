(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const fullscreenButton = document.getElementById('fullscreen-button');
  const fullscreenNote = document.getElementById('fullscreen-note');
  const mode = document.getElementById('input-mode');
  const portrait = document.getElementById('portrait');
  const consolePanel = document.getElementById('console-panel');
  const command = document.getElementById('console-command');
  const output = document.getElementById('console-output');
  let instance, mobile = false, primary = null, suppressTouches = false, pending = false, sequence = 0, consoleOwnsInput = false;
  const history = []; let historyIndex = 0;
  const replies = new Map();
  const query = new URLSearchParams(location.search);
  consolePanel.hidden = query.get('console') !== '1';
  const copy = Object.fromEntries(window.wasWasntLanguages.map(locale => [locale.code,
    Object.fromEntries(locale.mobile.map(entry => [entry.key, entry.text]))]));
  window.wasWasntSetLocale = locale => {
    const table = copy[locale === 'dev' ? 'ru' : locale];
    if (!table && locale !== 'dev.key') console.warn('Неизвестная локаль браузерного управления: ' + locale);
    document.querySelectorAll('[data-key]').forEach(element => { const key = element.dataset.key; element.textContent = locale === 'dev.key' || !table ? key : table[key]; });
  };
  function send(method, value = '') { if (instance) instance.SendMessage('WasWasntConsoleHost', method, value); }
  function cancelTouch() { primary = null; suppressTouches = false; send('MobileCancel'); }
  function refresh() {
    const touch = mode.value === 'touch' || (mode.value === 'auto' && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);
    if (mobile !== touch) { cancelTouch(); mobile = touch; send('SetMobile', touch ? '1' : '0'); }
    portrait.hidden = !(mobile && innerHeight > innerWidth);
    fullscreenButton.hidden = !mobile || !portrait.hidden || !!document.fullscreenElement;
    if (!mobile || document.fullscreenElement) fullscreenNote.hidden = true;
    canvas.style.touchAction = mobile ? 'none' : 'auto';
    document.body.classList.toggle('touch-mode', mobile);
    if (!portrait.hidden) cancelTouch();
  }
  window.wasWasntRefreshControls = refresh;
  window.wasWasntControlsReady = game => {
    instance = game;
    try { mode.value = localStorage.getItem('waswasnt-input-mode') || 'auto'; } catch (error) { console.warn('Настройка управления недоступна: ' + error.message); mode.value = 'auto'; }
    refresh();
  };
  mode.addEventListener('change', () => {
    try { localStorage.setItem('waswasnt-input-mode', mode.value); } catch (error) { console.warn('Не удалось сохранить режим управления: ' + error.message); }
    refresh();
  });
  fullscreenButton.onclick = async () => {
    cancelTouch();
    fullscreenNote.hidden = true;
    try {
      if (!document.documentElement.requestFullscreen) throw new Error('Fullscreen API недоступен');
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      console.warn('Не удалось включить полный экран: ' + error.message);
      fullscreenNote.hidden = false;
    }
    refresh();
  };
  document.addEventListener('fullscreenchange', () => { cancelTouch(); refresh(); });
  addEventListener('resize', refresh);
  addEventListener('blur', cancelTouch);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelTouch(); });
  function touch(event, phase) {
    if (!mobile || consoleOwnsInput) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!portrait.hidden || !instance) return;
    if (phase === 'cancel') { cancelTouch(); return; }
    if (primary === null && phase === 'start' && event.changedTouches.length) primary = event.changedTouches[0].identifier;
    const all = [...event.touches];
    const changed = [...event.changedTouches];
    if (suppressTouches) {
      if (all.length === 0) { send('Touch', JSON.stringify({ phase: 'end', count: 0, x: 0, y: 0, distance: 0 })); suppressTouches = false; primary = null; }
      return;
    }
    const finger = all.find(t => t.identifier === primary) || changed.find(t => t.identifier === primary);
    if (!finger) return;
    const primaryEnded = phase === 'end' && changed.some(t => t.identifier === primary);
    if (phase === 'end' && !primaryEnded) phase = 'move';
    const rect = canvas.getBoundingClientRect();
    const distance = all.length >= 2 ? Math.hypot(all[0].clientX - all[1].clientX, all[0].clientY - all[1].clientY) / rect.height : 0;
    send('Touch', JSON.stringify({ phase, count: all.length, x: (finger.clientX - rect.left) / rect.width, y: 1 - (finger.clientY - rect.top) / rect.height, distance }));
    if (primaryEnded) { primary = null; suppressTouches = all.length > 0; }
  }
  ['start', 'move', 'end', 'cancel'].forEach(phase => canvas.addEventListener('touch' + phase, event => touch(event, phase), { passive: false, capture: true }));
  function append(text) {
    // Keep a complete observation even when one reply exceeds the history budget.
    const historyBudget = Math.max(0, 24000 - text.length - 1);
    const history = historyBudget > 0 ? output.textContent.slice(-historyBudget) : '';
    output.textContent = history + '\n' + text;
    output.scrollTop = output.scrollHeight;
  }
  window.wasWasntConsoleReply = reply => {
    append((reply.ok ? '' : 'Ошибка: ') + reply.message);
    const callback = replies.get(reply.id); replies.delete(reply.id); if (callback) callback(reply);
  };
  function execute(text) {
    if (!instance) { append('Игра ещё загружается.'); return; }
    if (pending && !['status', 'cancel', 'stop', 'help'].includes(text)) { append('Дождитесь завершения команды.'); return; }
    const id = String(++sequence); pending = true;
    replies.set(id, reply => { pending = replies.size > 0; if (reply.ok && text === 'start') consoleOwnsInput = true; if (reply.ok && text === 'stop') consoleOwnsInput = false; refresh(); });
    append('> ' + text);
    send('Execute', JSON.stringify({ id, command: text }));
  }
  document.getElementById('console-form').onsubmit = event => {
    event.preventDefault(); const text = command.value.trim(); if (!text) return;
    history.push(text); if (history.length > 100) history.shift(); historyIndex = history.length;
    command.value = ''; execute(text);
  };
  consolePanel.querySelectorAll('[data-command]').forEach(button => { button.onclick = () => execute(button.dataset.command); });
  command.addEventListener('keydown', event => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1))); command.value = history[historyIndex] || ''; }
  });

})();
