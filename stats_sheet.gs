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
  const COL_PLAYER_ID   = colIndex["Player ID"];
  const COL_TOTAL_LVL   = colIndex["Total Lvl"];
  const COL_TOTAL_EXP   = colIndex["Total Exp"];

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

      // Write totals if columns exist
      if (COL_TOTAL_EXP) sheet.getRange(userRow, COL_TOTAL_EXP).setValue(totalExp);
      if (COL_TOTAL_LVL) sheet.getRange(userRow, COL_TOTAL_LVL).setValue(totalLvl);

      Logger.log(`✅ Row ${userRow}: Updated stats for playerId=${playerId}, user="${usernameCellValue}"`);

    } catch (e) {
      Logger.log(`❌ Row ${userRow}: Error processing stats for playerId=${playerId} – ${e}`);
    }
  }

  Logger.log(`✅ Finished processing stat/levels sheet: ${sheet.getName()}`);
}
