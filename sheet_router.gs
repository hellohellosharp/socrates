/**
 * Entry point from the menu.
 * Determines which sheets are inventory vs stat/level sheets and processes them.
 */
function updateAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  Logger.log(`🚀 Starting update for ${sheets.length} sheets`);
  clearApiCache();

  sheets.forEach(sheet => {
    try {
      const a1Value = String(sheet.getRange("A1").getValue() || "").trim();
      const d1Value = String(sheet.getRange("D1").getValue() || "").trim();

      if (a1Value === "player_username") {
        Logger.log(`📄 [${sheet.getName()}] Detected INVENTORY sheet (A1 = "player_username").`);
        updateInventoryForSheet(sheet);
      } else if (d1Value === "Total Exp") {
        Logger.log(`📊 [${sheet.getName()}] Detected STATS/LEVELS sheet (D1 = "Total Exp").`);
        processStatLevelsSheet(sheet);
      } else {
        Logger.log(`🤷 [${sheet.getName()}] Unknown sheet type. A1="${a1Value}", D1="${d1Value}". Skipping.`);
      }

    } catch (e) {
      Logger.log(`❌ Error while processing sheet "${sheet.getName()}": ${e}`);
    }
  });

  Logger.log("✅ Finished updateAllSheets.");
}
