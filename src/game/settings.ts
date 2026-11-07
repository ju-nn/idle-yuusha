export const SETTINGS_KEY = 'yuusha-settings-v1';

export type UserSettings = {
  bgm: number;
  se: number;
  simplifiedComboSe: boolean;
  textSpeed: 'normal' | 'fast';
  autoSell: boolean;
  autoEquip: boolean;
  // 宝箱の自動開封: 宝箱が上限に達したら、いちばん古い宝箱を自動で開ける（装備枠が空いているときだけ）。
  autoOpenChest: boolean;
  // 自動休憩: 戦闘・冒険でHP/MPが足りなくなったら自動で休憩へ切り替わり、回復したら元の仕事に戻る。
  autoRest: boolean;
  showTitleScreen: boolean;
};

export const defaultSettings: UserSettings = {
  bgm: 60,
  se: 75,
  simplifiedComboSe: false,
  textSpeed: 'normal',
  autoSell: false,
  autoEquip: false,
  autoOpenChest: false,
  autoRest: false,
  showTitleScreen: true,
};

export function loadUserSettings(): UserSettings {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaultSettings;
  }
}

export function saveUserSettings(settings: UserSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function applyUserSettings(settings: UserSettings) {
  document.documentElement.dataset.textSpeed = settings.textSpeed;
  // BGMエンジン等が音量変更へ即追従できるよう通知する。
  window.dispatchEvent(new CustomEvent('yuusha:settings-changed'));
}
