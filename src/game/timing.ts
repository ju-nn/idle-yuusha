export const GAME_SPEED_DIVISOR = 5;
export const TICK_INTERVAL_MS = 1000;
export const DAIKON_GROWTH_MS = 10000 * GAME_SPEED_DIVISOR;

export function getScaledDurationTicks(seconds: number) {
  return seconds * GAME_SPEED_DIVISOR;
}

export function getWorkSpeedMultiplier(level = 1, ownedUpgradeCount = 0) {
  const levelBonus = Math.max(0, level - 1) * 0.06;
  const upgradeBonus = Math.max(0, ownedUpgradeCount) * 0.12;
  return Math.min(2.5, 1 + levelBonus + upgradeBonus);
}

export function getEffectiveDurationTicks(seconds: number, level = 1, ownedUpgradeCount = 0) {
  const baseTicks = getScaledDurationTicks(seconds);
  return Math.max(3, Math.ceil(baseTicks / getWorkSpeedMultiplier(level, ownedUpgradeCount)));
}

export function countOwnedUpgrades(upgradeIds: string[], ownedItems: Record<string, number> = {}) {
  return upgradeIds.reduce((sum, id) => sum + (ownedItems[id] ? 1 : 0), 0);
}
