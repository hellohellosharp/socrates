/**
 * Adds the Bitjita menu on spreadsheet open.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📦 Bitjita Tools")
    .addItem("🔄 Update All Sheets", "updateAllSheets")
    .addToUi();

  Logger.log("📦 Bitjita Tools menu added.");
}
