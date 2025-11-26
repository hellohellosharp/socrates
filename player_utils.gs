/**
 * Looks up a playerId from a username, with caching.
 *
 * @param {string} userName - The Bitcraft username.
 * @return {string|null} - The player entityId or null if not found.
 */
function getPlayerIdFromUserName(userName) {
  const trimmed = String(userName || "").trim();
  if (!trimmed) {
    Logger.log("⚠️ getPlayerIdFromUserName called with empty username.");
    return null;
  }

  if (userNameToPlayerIdCache[trimmed]) {
    Logger.log(`♻️ PlayerId cache hit for username: ${trimmed}`);
    return userNameToPlayerIdCache[trimmed];
  }

  Logger.log(`🔍 Getting player id for username: ${trimmed}`);
  const url = `https://bitjita.com/api/players?q=${encodeURIComponent(trimmed)}`;
  const response = getApiWithCache(url);

  if (!response || !Array.isArray(response.players) || response.players.length === 0) {
    Logger.log(`❌ No players found for username: ${trimmed}`);
    return null;
  }

  const entityId = response.players[0].entityId;
  userNameToPlayerIdCache[trimmed] = entityId;
  Logger.log(`✅ Resolved username "${trimmed}" → playerId: ${entityId}`);
  return entityId;
}
