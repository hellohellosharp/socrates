function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("📦 Bitjita Tools")
    .addItem("🔄 Update All Sheets", "updateAllSheets")
    .addToUi();
}

const apiCache = {};
function getApiWithCache(url) {
  if (apiCache[url]) {
    return apiCache[url];
  }
  const response = fetchJsonSafe(url);
  apiCache[url] = response;
  return response;
}
function clearApiCache() {
  apiCache = {};
}

const userNameToPlayerIdCache = {};
function getPlayerIdFromUserName(userName) {
  Logger.log(`Getting player id for user name: ${userName}`);
  if (userNameToPlayerIdCache[userName]) {
    return userNameToPlayerIdCache[userName];
  }
  const response = getApiWithCache(`https://bitjita.com/api/players?q=${encodeURIComponent(userName)}`);
  userNameToPlayerIdCache[userName] = response.players[0].entityId;
  return response.players[0].entityId;
}

const skillMap = {
  "1": {
    "id": 1,
    "name": "ANY",
    "title": "",
    "skillCategoryStr": "None"
  },
  "2": {
    "id": 2,
    "name": "Forestry",
    "title": "Forester",
    "skillCategoryStr": "Profession"
  },
  "3": {
    "id": 3,
    "name": "Carpentry",
    "title": "Carpenter",
    "skillCategoryStr": "Profession"
  },
  "4": {
    "id": 4,
    "name": "Masonry",
    "title": "Mason",
    "skillCategoryStr": "Profession"
  },
  "5": {
    "id": 5,
    "name": "Mining",
    "title": "Miner",
    "skillCategoryStr": "Profession"
  },
  "6": {
    "id": 6,
    "name": "Smithing",
    "title": "Smith",
    "skillCategoryStr": "Profession"
  },
  "7": {
    "id": 7,
    "name": "Scholar",
    "title": "Scholar",
    "skillCategoryStr": "Profession"
  },
  "8": {
    "id": 8,
    "name": "Leatherworking",
    "title": "Leatherworker",
    "skillCategoryStr": "Profession"
  },
  "9": {
    "id": 9,
    "name": "Hunting",
    "title": "Hunter",
    "skillCategoryStr": "Profession"
  },
  "10": {
    "id": 10,
    "name": "Tailoring",
    "title": "Tailor",
    "skillCategoryStr": "Profession"
  },
  "11": {
    "id": 11,
    "name": "Farming",
    "title": "Farmer",
    "skillCategoryStr": "Profession"
  },
  "12": {
    "id": 12,
    "name": "Fishing",
    "title": "Fisher",
    "skillCategoryStr": "Profession"
  },
  "13": {
    "id": 13,
    "name": "Cooking",
    "title": "Cook",
    "skillCategoryStr": "Adventure"
  },
  "14": {
    "id": 14,
    "name": "Foraging",
    "title": "Forager",
    "skillCategoryStr": "Profession"
  },
  "15": {
    "id": 15,
    "name": "Construction",
    "title": "Builder",
    "skillCategoryStr": "Adventure"
  },
  "17": {
    "id": 17,
    "name": "Taming",
    "title": "Tamer",
    "skillCategoryStr": "Adventure"
  },
  "18": {
    "id": 18,
    "name": "Slayer",
    "title": "Slayer",
    "skillCategoryStr": "Adventure"
  },
  "19": {
    "id": 19,
    "name": "Merchanting",
    "title": "Merchant",
    "skillCategoryStr": "Adventure"
  },
  "21": {
    "id": 21,
    "name": "Sailing",
    "title": "Sailor",
    "skillCategoryStr": "Adventure"
  }
};

function processStatLevelsSheet(sheet) {

  const shorthands = {
    "Leatherwork": "Leatherworking",
    "Merchant": "Merchanting"
  };

  const aColumn = sheet.getRange("A2:A");
  const bColumn = sheet.getRange("B2:B");

  const aValues = aColumn.getValues();
  let bValues = bColumn.getValues();

  // === Resolve missing player IDs ===
  for (let i = 0; i < aValues.length; i++) {
    const username = String(aValues[i][0]).trim();
    const existingPid = String(bValues[i][0]).trim();

    if (username && !existingPid) {
      const pid = getPlayerIdFromUserName(username);
      bColumn.getCell(i + 1, 1).setValue(pid);
    }
  }

  bValues = bColumn.getValues();

  // === Build header → column map ===
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headerRange.getValues()[0];

  const colIndex = {};
  headers.forEach((h, i) => {
    const trimmed = h.trim();
    colIndex[trimmed] = i + 1;

    // NEW: Allow shorthand headers
    if (shorthands[trimmed]) {
      colIndex[shorthands[trimmed]] = i + 1;
    }
  });

  // Base columns
  const COL_PLAYER_NAME = colIndex["Player Name"];
  const COL_PLAYER_ID = colIndex["Player ID"];
  const COL_TOTAL_LVL = colIndex["Total Lvl"];
  const COL_TOTAL_EXP = colIndex["Total Exp"];

  // Build skill → column index map
  const skillColumns = {};
  for (const [key, value] of Object.entries(skillMap)) {
    const skillName = value.name;
    if (colIndex[skillName]) {
      skillColumns[skillName] = colIndex[skillName];
    }
  }

  // === Process each row ===
  for (let i = 0; i < bValues.length; i++) {
    const playerId = String(bValues[i][0]).trim();
    if (!playerId) continue;

    const userRow = i + 2;

    const data = getApiWithCache(`https://bitjita.com/api/players/${playerId}`);
    if (!data || !data.player || !data.player.experience) continue;

    const expArray = data.player.experience;

    let totalExp = 0;
    let totalLvl = 0;

    if (COL_PLAYER_NAME) sheet.getRange(userRow, COL_PLAYER_NAME).setValue(data.player.username);
    if (COL_PLAYER_ID) sheet.getRange(userRow, COL_PLAYER_ID).setValue(playerId);

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

      if (col) sheet.getRange(userRow, col).setValue(level);
    }

    if (COL_TOTAL_EXP) sheet.getRange(userRow, COL_TOTAL_EXP).setValue(totalExp);
    if (COL_TOTAL_LVL) sheet.getRange(userRow, COL_TOTAL_LVL).setValue(totalLvl);
  }
}



// Total XP needed to *reach* a given level
function totalXpForLevel(level) {
  const a  = Math.pow(2, 0.145 * level);
  const a1 = Math.pow(2, 0.145);
  const a2 = Math.pow(2, 0.29);
  return 10 * Math.floor(64 * ((a - a1) / (a2 - a1)));
}

// Build table: totalXpTable[level] = total XP at that level
function buildTotalXpTable(maxLevel = 100) {
  const totalXp = [0]; // index 0 unused, level 1 starts at 0 XP
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    totalXp[lvl] = totalXpForLevel(lvl);
  }
  return totalXp;
}

const totalXpTable = buildTotalXpTable(100);

function getLevelFromXP(xp) {
  let low = 1;
  let high = totalXpTable.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;

    if (totalXpTable[mid] === xp) return mid;
    if (totalXpTable[mid] < xp) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // `high` ends at highest level where totalXp <= xp
  return high;
}

function updateInventoryForSheet(sheet) {
  const headers = [
    'Item Name', 'Rarity', 'Tag', 'Tier', 'Quantity',
    'Inventory Name', 'Claim Name', 'Claim Region',
    'Inventory ID', 'Item Type'
  ];

  // 1) Get username from B1
  //
  const username = sheet.getRange("B1").getValue().toString().trim();
  if (!username) {
    Logger.log(`⚠️ No username found in B1`);
    return;
  }

  Logger.log(`🔍 Looking up username: ${username}`);

  //
  // 2) Resolve username → playerId
  //
  const searchData = getApiWithCache(`https://bitjita.com/api/players?q=${encodeURIComponent(username)}`);
  if (!searchData || !Array.isArray(searchData.players) || searchData.players.length === 0) {
    Logger.log(`❌ No players found for username: ${username}`);
    return;
  }

  const playerId = searchData.players[0].entityId;
  Logger.log(`✅ Username resolved → playerId: ${playerId}`);

  //
  // 3) Prepare merge map
  //
  const mergedRowsMap = new Map();

  //
  // 4) NORMAL PLAYER INVENTORIES
  //
  const baseData = getApiWithCache(`https://bitjita.com/api/players/${playerId}/inventories`);
  if (baseData) {
    processNormalInventories(baseData, mergedRowsMap);
  }

  //
  // 5) HOUSING INVENTORIES
  //
  const housingList = getApiWithCache(`https://bitjita.com/api/players/${playerId}/housing`);
  if (housingList && Array.isArray(housingList)) {
    housingList.forEach(house => {
      if (!house.buildingEntityId) return;

      const houseId = house.buildingEntityId;
      const housingData = getApiWithCache(`https://bitjita.com/api/players/${playerId}/housing/${houseId}`);

      if (housingData) {
        processHousingInventories(housingData, mergedRowsMap);
      }
    });
  }

  //
  // 6) MARKET ORDERS (NEW)
  //
  const playerData = getApiWithCache(`https://bitjita.com/api/players/${playerId}`);
  if (playerData) {
    processMarketOrders(playerData, mergedRowsMap);
  }

  //
  // 7) WRITE TO SHEET
  //
  const rows = Array.from(mergedRowsMap.values()).map(entry => [
    entry.itemName,
    entry.rarity,
    entry.tag,
    entry.tier,
    entry.quantity,
    entry.inventoryName,
    entry.claimName,
    entry.regionId,
    entry.inventoryId,
    entry.itemType
  ]);

  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(3, 1, sheet.getMaxRows() - 2, headers.length).clearContent();

  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log(`✅ Updated sheet: ${sheet.getName()} with ${rows.length} rows`);
}

function updateAllSheets() {
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  clearApiCache();


  Logger.log(`Starting update for ${sheets.length} sheets`);

  sheets.forEach(sheet => {

    // Find out which process to use for this sheet
    const a1Value = sheet.getRange("A1").getValue().toString().trim();
    const d1Value = sheet.getRange("D1").getValue().toString().trim();
    if (a1Value === "player_username") {
      Logger.log(`This is an inventory sheet (A1 === player_username) ${a1Value}`);
      updateInventoryForSheet(sheet);
      return;
    }
    else if (d1Value === "Total Exp") {
      Logger.log(`This is an stat/levels sheet (D1 === Total Exp) ${d1Value}`);
      processStatLevelsSheet(sheet);
      return;
    }
    else {
      Logger.log(`Could not determine which process to use for this sheet ${a1Value} ${d1Value}`);
      return;
    }

  });

}

//
// -------- SAFE FETCH --------
//
function fetchJsonSafe(url) {
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://bitjita.com'
      }
    });

    const text = response.getContentText();
    return JSON.parse(text);

  } catch (e) {
    Logger.log(`❌ Failed to fetch or parse: ${url}`);
    return null;
  }
}

//
// -------- PROCESS NORMAL INVENTORIES --------
//
function processNormalInventories(data, rowsMap) {
  const inventories = data.inventories || [];
  const itemsMap = data.items || {};
  const cargosMap = data.cargos || {};

  inventories.forEach(inv => {
    const inventoryName = inv.inventoryName || '';
    const claimName = inv.claimName || '';
    const regionId = inv.regionId || '';
    const inventoryId = inv.entityId?.toString() || '';

    inv.pockets?.forEach(pocket => {
      const c = pocket.contents;
      if (!c || c.quantity <= 0) return;

      const itemId = c.itemId?.toString();
      const isCargo = c.itemType === 1;
      const typeLabel = isCargo ? "cargo" : "item";
      const sourceData = isCargo ? cargosMap[itemId] : itemsMap[itemId];

      mergeItem(rowsMap, itemId, typeLabel, inventoryId, Number(c.quantity), {
        itemName: sourceData?.name || `Unknown ${typeLabel} ${itemId}`,
        rarity: sourceData?.rarityStr || '',
        tag: sourceData?.tag || '',
        tier: sourceData?.tier ?? '',
        inventoryName,
        claimName,
        regionId
      });
    });
  });
}

//
// -------- PROCESS HOUSING INVENTORIES --------
//
function processHousingInventories(housingData, rowsMap) {
  const itemsMap = arrayToMap(housingData.items || []);
  const cargosMap = arrayToMap(housingData.cargos || []);

  const houseClaimName = housingData.claimName || '';
  const houseRegionId = housingData.claimRegionId || '';
  const buildingName = housingData.buildingNickname || housingData.buildingName || 'Unknown House';

  const inventories = housingData.inventories || [];

  inventories.forEach(inv => {
    const inventoryId = inv.entityId?.toString() || '';
    const inventoryInHouseName = inv.buildingNickname || inv.buildingName || 'Unknown';
    const slots = inv.inventory || [];

    slots.forEach(slot => {
      const c = slot.contents;
      if (!c || c.quantity <= 0) return;

      const itemId = c.item_id?.toString();
      const typeLabel = (c.item_type === "cargo" || c.item_type === 1) ? "cargo" : "item";
      const sourceData = typeLabel === "cargo" ? cargosMap[itemId] : itemsMap[itemId];

      mergeItem(rowsMap, itemId, typeLabel, inventoryId, Number(c.quantity), {
        itemName: sourceData?.name || `Unknown ${typeLabel} ${itemId}`,
        rarity: sourceData?.rarityStr || '',
        tag: sourceData?.tag || '',
        tier: sourceData?.tier ?? '',
        inventoryName: `${inventoryInHouseName} - ${buildingName}`,
        claimName: houseClaimName,
        regionId: houseRegionId
      });
    });
  });
}

//
// -------- PROCESS MARKET ORDERS (NEW) --------
//
function processMarketOrders(playerData, rowsMap) {
  if (!playerData || !playerData.player || !playerData.player.marketOrders) return;
  const m = playerData.player.marketOrders;

  //
  // SELL ORDERS
  //
  (m.sellOrders || []).forEach(order => {
    mergeItem(rowsMap, order.entityId, "sell", order.entityId, Number(order.quantity), {
      itemName: order.itemName,
      rarity: order.rarityStr || '',
      tag: order.tag || '',
      tier: order.tier ?? '',
      inventoryName: "Market Sell Order",
      claimName: order.claimName || '',
      regionId: order.regionId || ''
    });
  });

  //
  // BUY ORDERS
  //
  (m.buyOrders || []).forEach(order => {
    mergeItem(rowsMap, order.entityId, "buy", order.entityId, Number(order.quantity), {
      itemName: order.itemName,
      rarity: order.rarityStr || '',
      tag: order.tag || '',
      tier: order.tier ?? '',
      inventoryName: "Market Buy Order",
      claimName: order.claimName || '',
      regionId: order.regionId || ''
    });
  });
}

//
// -------- MERGE LOGIC --------
//
function mergeItem(rowsMap, itemId, typeLabel, inventoryId, quantity, meta) {
  const key = `${itemId}_${typeLabel}_${inventoryId}`;

  if (rowsMap.has(key)) {
    rowsMap.get(key).quantity += quantity;
  } else {
    rowsMap.set(key, {
      itemName: meta.itemName,
      rarity: meta.rarity,
      tag: meta.tag,
      tier: meta.tier,
      quantity,
      inventoryName: meta.inventoryName,
      claimName: meta.claimName,
      regionId: meta.regionId,
      inventoryId,
      itemType: typeLabel
    });
  }
}

function arrayToMap(arr) {
  const map = {};
  arr.forEach(obj => {
    if (obj.id !== undefined) {
      map[obj.id.toString()] = obj;
    }
  });
  return map;
}  