
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
