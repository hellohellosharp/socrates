/**
 * Global in-memory cache for API responses during a single run.
 * Key: URL, Value: parsed JSON.
 */
let apiCache = {};

/**
 * Cache for username → playerId mappings.
 */
const userNameToPlayerIdCache = {};

/**
 * Clears the in-memory API cache. Called at the start of updateAllSheets().
 */
function clearApiCache() {
  apiCache = {};
  Logger.log("🧹 Cleared API cache.");
}

/**
 * Fetches a URL and caches the parsed JSON for the duration of the run.
 */
function getApiWithCache(url) {
  if (apiCache[url]) {
    Logger.log(`♻️ Cache hit: ${url}`);
    return apiCache[url];
  }

  Logger.log(`🌐 Fetching: ${url}`);
  const response = fetchJsonSafe(url);
  apiCache[url] = response;
  return response;
}

/**
 * Safe JSON fetch helper; returns null on failure instead of throwing.
 */
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
    if (!text) {
      Logger.log(`⚠️ Empty response from: ${url}`);
      return null;
    }

    return JSON.parse(text);

  } catch (e) {
    Logger.log(`❌ Failed to fetch or parse: ${url} – ${e}`);
    return null;
  }
}
