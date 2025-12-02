/**
 * Processes a stat/levels sheet:
 * - Resolves missing Player IDs from usernames in column A.
 * - Fetches /api/players/{playerId}.
 * - Fills per-skill levels + total exp + total level.
 *
 * Required headers:
 *   A: "Player Name" or username list
 *   B: "Player ID"
 *   D1: "Total Exp" to detect this as a stats sheet.
 */
function processStatLevelsSheet(sheet) {
  Logger.log(`📊 Processing stat/levels sheet: ${sheet.getName()}`);

  const aColumn = sheet.getRange("A2:A");
  const bColumn = sheet.getRange("B2:B");

  const aValues = aColumn.getValues();  // usernames
  let bValues = bColumn.getValues();    // player IDs

  // === 1) Resolve missing player IDs based on usernames ===
  for (let i = 0; i < aValues.length; i++) {
    const username = String(aValues[i][0]).trim();
    const existingPid = String(bValues[i][0] || "").trim();

    if (!username && !existingPid) continue; // empty row

    if (username && !existingPid) {
      const pid = getPlayerIdFromUserName(username);
      if (pid) {
        bColumn.getCell(i + 1, 1).setValue(pid);
        Logger.log(`🔗 Row ${i + 2}: Set playerId "${pid}" for username "${username}".`);
      } else {
        Logger.log(`⚠️ Row ${i + 2}: Could not resolve playerId for username "${username}".`);
      }
    }
  }

  // Refresh B column after writing IDs.
  bValues = bColumn.getValues();

  // === 2) Build header → column index map ===
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headerRange.getValues()[0];

  const colIndex = {};
  headers.forEach((h, i) => {
    const trimmed = String(h || "").trim();
    if (!trimmed) return;

    const colNumber = i + 1;
    colIndex[trimmed] = colNumber;

    // Allow shorthand headers (e.g., "Leatherwork") to map to full names.
    if (STAT_HEADER_SHORTHANDS[trimmed]) {
      colIndex[STAT_HEADER_SHORTHANDS[trimmed]] = colNumber;
    }
  });

  // Base columns
  const COL_PLAYER_NAME = colIndex["Player Name"];
  const COL_PLAYER_ID = colIndex["Player ID"];
  const COL_TOTAL_LVL = colIndex["Total Lvl"];
  const COL_TOTAL_EXP = colIndex["Total Exp"];

  // Map skillName → column index if column exists
  const skillColumns = {};
  for (const [, value] of Object.entries(skillMap)) {
    const skillName = value.name;
    if (colIndex[skillName]) {
      skillColumns[skillName] = colIndex[skillName];
    }
  }

  // === 3) Process each row (player) ===
  for (let i = 0; i < bValues.length; i++) {
    const playerId = String(bValues[i][0] || "").trim();
    if (!playerId) continue; // no playerId, nothing to do

    const usernameCellValue = String(aValues[i][0] || "").trim();
    const userRow = i + 2;

    try {
      const url = `https://bitjita.com/api/players/${playerId}`;
      const data = getApiWithCache(url);

      if (!data || !data.player) {
        Logger.log(`⚠️ Row ${userRow}: No player data for playerId=${playerId}`);
        continue;
      }

      const player = data.player;
      const expArray = player.experience || [];

      let totalExp = 0;
      let totalLvl = 0;

      // Keep sheet's "Player Name" synced to API username if column exists.
      if (COL_PLAYER_NAME && player.username) {
        sheet.getRange(userRow, COL_PLAYER_NAME).setValue(player.username);
      }

      if (COL_PLAYER_ID) {
        sheet.getRange(userRow, COL_PLAYER_ID).setValue(playerId);
      }

      // Fill per-skill levels
      for (const expEntry of expArray) {
        const xp = Number(expEntry.quantity);
        const sid = expEntry.skill_id;
        const skill = skillMap[String(sid)];
        if (!skill) continue;

        const skillName = skill.name;
        const col = skillColumns[skillName];
        const level = getLevelFromXP(xp);

        totalExp += xp;
        totalLvl += level;

        if (col) {
          sheet.getRange(userRow, col).setValue(level);
        }
      }

      // Write totals
      if (COL_TOTAL_EXP) sheet.getRange(userRow, COL_TOTAL_EXP).setValue(totalExp);
      if (COL_TOTAL_LVL) sheet.getRange(userRow, COL_TOTAL_LVL).setValue(totalLvl);

      // --- Collect latest data for history sheet ---
      const latest = {
        "Player Name": player.username,
        "Player ID": playerId,
        "Total Exp": totalExp,
        "Total Lvl": totalLvl
      };

      // Add each skill column
      for (const skillId in skillMap) {
        const skillName = skillMap[skillId].name;
        const col = skillColumns[skillName];
        if (col) {
          latest[skillName] = sheet.getRange(userRow, col).getValue();
        }
      }

      // --- Update Levels History ---
      updateLevelsHistory(sheet, latest);

      Logger.log(`✅ Row ${userRow}: Updated stats + history check for playerId=${playerId}`);

    } catch (e) {
      Logger.log(`❌ Row ${userRow}: Error processing stats for playerId=${playerId} – ${e}`);
    }
  }

  Logger.log(`✅ Finished processing stat/levels sheet: ${sheet.getName()}`);
}

/**
 * Appends a new row to "Levels History" if any skill level changed.
 *
 * Behaviour:
 * - If no previous history row for this player: writes a baseline row, no bold.
 * - If previous row exists: only appends if at least one skill level changed.
 * - Only skill columns drive change detection (not Player Name / ID / Date).
 * - Bold = only the skill columns whose level changed.
 *
 * @param {Sheet} statsSheet – the stats sheet being processed (e.g. "Levels")
 * @param {Object} latest    – map of headerName -> latest value for that row
 */
function updateLevelsHistory(statsSheet, latest) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const history = ss.getSheetByName("Levels History");
  if (!history) {
    Logger.log("📘 No 'Levels History' sheet found. Skipping history logging.");
    return;
  }

  Logger.log(`🕑 Checking Level History updates for ${statsSheet.getName()}`);

  // ===========================
  // 1) Build header index map
  // ===========================
  const headerRow = history.getRange(1, 1, 1, history.getLastColumn()).getValues()[0];
  const hIndex = {};

  headerRow.forEach((h, i) => {
    const trimmed = String(h || "").trim();
    if (!trimmed) return;

    const colNumber = i + 1;
    hIndex[trimmed] = colNumber;

    // Allow shorthand headers in the history sheet as well
    if (typeof STAT_HEADER_SHORTHANDS !== "undefined" && STAT_HEADER_SHORTHANDS[trimmed]) {
      const canonical = STAT_HEADER_SHORTHANDS[trimmed]; // e.g. Leatherwork -> Leatherworking
      hIndex[canonical] = colNumber;
    }
  });

  const playerId = latest["Player ID"];
  if (!playerId) {
    Logger.log("⚠ Missing Player ID in latest row, skipping history update.");
    return;
  }

  // Build a set of skill names from skillMap so we only treat these as "levels"
  const skillNames = new Set(Object.values(skillMap).map(s => s.name));

  // ===========================
  // 2) Read existing history rows safely
  // ===========================
  let allHistoryRows = [];
  const lastRow = history.getLastRow();

  if (lastRow > 1) {
    allHistoryRows = history.getRange(
      2,                      // start row
      1,                      // start col
      lastRow - 1,            // number of rows
      history.getLastColumn()
    ).getValues();
  }

  // ===========================
  // 3) Find last entry for this player
  // ===========================
  let lastRowData = null;
  const playerIdCol = hIndex["Player ID"];
  if (playerIdCol && allHistoryRows.length > 0) {
    for (let r = allHistoryRows.length - 1; r >= 0; r--) {
      const pid = String(allHistoryRows[r][playerIdCol - 1] || "").trim();
      if (pid === String(playerId)) {
        lastRowData = allHistoryRows[r];
        break;
      }
    }
  }

  // ===========================
  // 4) Compare: detect changed skill columns
  // ===========================
  let hasChange = false;
  const changedColumns = {}; // canonical header name → true

  if (!lastRowData) {
    // No previous row for this player:
    // we want a baseline row, but with NOTHING bold.
    hasChange = true;
    Logger.log(`📘 No existing history for player ${playerId}. Writing baseline row (no bold).`);
  } else {
    for (const key in latest) {
      if (!hIndex[key]) continue;          // skip headers that don't exist in history
      if (!skillNames.has(key)) continue;  // Only treat skills as "levels"

      const colIdx = hIndex[key] - 1;
      const newVal = latest[key];
      const prevVal = lastRowData[colIdx];

      if (String(newVal) !== String(prevVal)) {
        changedColumns[key] = true;
        hasChange = true;
      }
    }
  }

  if (!hasChange) {
    Logger.log(`📘 No level changes for player ${playerId}. No history row added.`);
    return;
  }

  // ===========================
  // 5) Build new row in history header order
  // ===========================
  const newRow = headerRow.map((rawHeader) => {
    const headerName = String(rawHeader || "").trim();

    if (headerName === "Date") {
      // Use the sheet's configured timezone
      const tz = Session.getScriptTimeZone();
      return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm");
    }
    if (headerName === "Unix") {
      return Math.floor(Date.now() / 1000);
    }

    // Direct match first
    if (latest[headerName] !== undefined) {
      return latest[headerName];
    }

    // If header is a shorthand, use its canonical in 'latest'
    if (typeof STAT_HEADER_SHORTHANDS !== "undefined") {
      const canonical = STAT_HEADER_SHORTHANDS[headerName];
      if (canonical && latest[canonical] !== undefined) {
        return latest[canonical];
      }
    }

    return "";
  });

  const appendRowIndex = history.getLastRow() + 1;
  history.getRange(appendRowIndex, 1, 1, newRow.length).setValues([newRow]);

  // ===========================
  // 6) Apply bold formatting ONLY to changed skill columns
  // ===========================
  headerRow.forEach((rawHeader, index) => {
    const headerName = String(rawHeader || "").trim();
    const cell = history.getRange(appendRowIndex, index + 1);

    // Never bold these:
    if (
      headerName === "Player Name" ||
      headerName === "Player ID" ||
      headerName === "Date"
    ) {
      cell.setFontWeight("normal");
      return;
    }

    // Work in canonical name space for changedColumns
    let canonical = headerName;
    if (typeof STAT_HEADER_SHORTHANDS !== "undefined" && STAT_HEADER_SHORTHANDS[headerName]) {
      canonical = STAT_HEADER_SHORTHANDS[headerName];
    }

    if (changedColumns[canonical] && skillNames.has(canonical)) {
      cell.setFontWeight("bold");
    } else {
      cell.setFontWeight("normal");
    }
  });

  Logger.log(`📘 Levels History updated at row ${appendRowIndex} for Player ID ${playerId}`);
}