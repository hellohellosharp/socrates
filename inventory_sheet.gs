/**
 * Updates a "player_username" inventory sheet.
 *
 * Layout:
 *  A1: "player_username"
 *  B1: username value
 *
 * Rows starting at row 3 are rewritten with merged inventory data from:
 *  - /players/{id}/inventories
 *  - /players/{id}/housing
 *  - /players/{id} (market orders)
 */
function updateInventoryForSheet(sheet) {
  Logger.log(`📄 Processing inventory sheet: ${sheet.getName()}`);

  const headers = [
    'Item Name', 'Rarity', 'Tag', 'Tier', 'Quantity',
    'Inventory Name', 'Claim Name', 'Claim Region',
    'Inventory ID', 'Item Type'
  ];

  // 1) Get username from B1
  const username = String(sheet.getRange("B1").getValue() || "").trim();
  if (!username) {
    Logger.log(`⚠️ [${sheet.getName()}] No username found in B1. Skipping.`);
    return;
  }

  Logger.log(`🔍 [${sheet.getName()}] Looking up username: ${username}`);

  // 2) Resolve username → playerId using shared helper
  const playerId = getPlayerIdFromUserName(username);
  if (!playerId) {
    Logger.log(`❌ [${sheet.getName()}] Could not resolve playerId for username: ${username}`);
    return;
  }

  Logger.log(`✅ [${sheet.getName()}] Username resolved → playerId: ${playerId}`);

  // 3) Prepare merge map: key → merged row object
  const mergedRowsMap = new Map();

  // 4) NORMAL PLAYER INVENTORIES
  const baseData = getApiWithCache(`https://bitjita.com/api/players/${playerId}/inventories`);
  if (baseData) {
    processNormalInventories(baseData, mergedRowsMap);
  } else {
    Logger.log(`⚠️ No base inventory data for playerId=${playerId}`);
  }

  // 5) HOUSING INVENTORIES
  const housingList = getApiWithCache(`https://bitjita.com/api/players/${playerId}/housing`);
  if (housingList && Array.isArray(housingList)) {
    housingList.forEach(house => {
      if (!house.buildingEntityId) return;

      const houseId = house.buildingEntityId;
      const housingData = getApiWithCache(
        `https://bitjita.com/api/players/${playerId}/housing/${houseId}`
      );

      if (housingData) {
        processHousingInventories(housingData, mergedRowsMap);
      }
    });
  } else {
    Logger.log(`ℹ️ No housing list or empty housing for playerId=${playerId} (this can be normal).`);
  }

  // 6) MARKET ORDERS
  const playerData = getApiWithCache(`https://bitjita.com/api/players/${playerId}`);
  if (playerData) {
    processMarketOrders(playerData, mergedRowsMap);
  } else {
    Logger.log(`⚠️ No player data found for market orders, playerId=${playerId}`);
  }

  // 7) WRITE TO SHEET
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

  // Headers on row 2
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);

  // Clear all rows below header
  sheet.getRange(3, 1, sheet.getMaxRows() - 2, headers.length).clearContent();

  if (rows.length > 0) {
    sheet.getRange(3, 1, rows.length, headers.length).setValues(rows);
  }

  Logger.log(`✅ [${sheet.getName()}] Updated inventory with ${rows.length} rows.`);
}

/**
 * Processes normal (non-housing) player inventories from:
 *   /players/{id}/inventories
 */
function processNormalInventories(data, rowsMap) {
  const inventories = data.inventories || [];
  const itemsMap = data.items || {};
  const cargosMap = data.cargos || {};

  inventories.forEach(inv => {
    const inventoryName = inv.inventoryName || '';
    const claimName = inv.claimName || '';
    const regionId = inv.regionId || '';
    const inventoryId = inv.entityId ? String(inv.entityId) : '';

    (inv.pockets || []).forEach(pocket => {
      const c = pocket.contents;
      if (!c || c.quantity <= 0) return;

      const itemId = c.itemId != null ? String(c.itemId) : '';
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

  Logger.log(`📦 processNormalInventories: processed ${inventories.length} inventories.`);
}

/**
 * Processes housing inventories from:
 *   /players/{id}/housing/{houseId}
 */
function processHousingInventories(housingData, rowsMap) {
  const itemsMap = arrayToMap(housingData.items || []);
  const cargosMap = arrayToMap(housingData.cargos || []);

  const houseClaimName = housingData.claimName || '';
  const houseRegionId = housingData.claimRegionId || '';
  const buildingName = housingData.buildingNickname || housingData.buildingName || 'Unknown House';

  const inventories = housingData.inventories || [];

  inventories.forEach(inv => {
    const inventoryId = inv.entityId ? String(inv.entityId) : '';
    const inventoryInHouseName = inv.buildingNickname || inv.buildingName || 'Unknown';
    const slots = inv.inventory || [];

    slots.forEach(slot => {
      const c = slot.contents;
      if (!c || c.quantity <= 0) return;

      const itemId = c.item_id != null ? String(c.item_id) : '';
      const typeLabel = (c.item_type === "cargo" || c.item_type === 1) ? "cargo" : "item";
      const sourceData = (typeLabel === "cargo") ? cargosMap[itemId] : itemsMap[itemId];

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

  Logger.log(`🏠 processHousingInventories: processed ${inventories.length} housing inventories.`);
}

/**
 * Processes market buy/sell orders from /players/{id}.
 */
function processMarketOrders(playerData, rowsMap) {
  if (!playerData || !playerData.player || !playerData.player.marketOrders) {
    Logger.log("ℹ️ No marketOrders property found on playerData.");
    return;
  }

  const m = playerData.player.marketOrders;

  // SELL ORDERS
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

  // BUY ORDERS
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

  Logger.log(`💰 processMarketOrders: processed ${(m.sellOrders || []).length} sell + ${(m.buyOrders || []).length} buy orders.`);
}

/**
 * Merges a single item instance into the rowsMap.
 * Key is (itemId, typeLabel, inventoryId) so piles of the same thing in
 * the same inventory are combined.
 */
function mergeItem(rowsMap, itemId, typeLabel, inventoryId, quantity, meta) {
  const key = `${itemId}_${typeLabel}_${inventoryId}`;
  const existing = rowsMap.get(key);

  if (existing) {
    existing.quantity += quantity;
  } else {
    rowsMap.set(key, {
      itemName: meta.itemName,
      rarity: meta.rarity,
      tag: meta.tag,
      tier: meta.tier,
      quantity: quantity,
      inventoryName: meta.inventoryName,
      claimName: meta.claimName,
      regionId: meta.regionId,
      inventoryId: inventoryId,
      itemType: typeLabel
    });
  }
}

/**
 * Converts an array of objects with "id" into a map keyed by id.toString().
 */
function arrayToMap(arr) {
  const map = {};
  (arr || []).forEach(obj => {
    if (obj.id !== undefined && obj.id !== null) {
      map[String(obj.id)] = obj;
    }
  });
  return map;
}
