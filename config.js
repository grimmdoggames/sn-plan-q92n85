// Настройки страницы. Править можно руками.
//
// statusStorage — где хранятся отметки «опубликовано»:
//   'local'       — только в этом браузере (так сейчас, пока не выбрано общее хранение);
//   'apps-script' — общая Google Таблица через Apps Script (см. backend/README.md);
//                   тогда нужно вписать адрес в appsScriptUrl.
window.CP_CONFIG = {
  statusStorage: 'local',
  appsScriptUrl: '',
  // как часто подтягивать чужие отметки, секунд (только для общего хранения)
  refreshSeconds: 60,
};
