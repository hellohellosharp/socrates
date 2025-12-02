//Run these once from dev console

function createTrigger() {
  ScriptApp.newTrigger('updateAllSheets')
    .timeBased()
    .everyHours(1)
    .create();
}

function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
}