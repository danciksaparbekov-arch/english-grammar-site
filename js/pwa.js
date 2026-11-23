// Установка на рабочий стол телефона: service worker + кнопка «Установить».
(function () {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var btn = document.getElementById('install-btn');
  if (!btn) return;
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  var deferred = null;
  addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; btn.hidden = false;
  });
  addEventListener('appinstalled', function () { btn.hidden = true; deferred = null; });
  // iOS Safari: события нет, показываем подсказку
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) btn.hidden = false;
  btn.addEventListener('click', function () {
    if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; btn.hidden = true; }); }
    else if (ios) alert('Нажмите «Поделиться» в Safari и выберите «На экран Домой».');
    else alert('Откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».');
  });
})();
