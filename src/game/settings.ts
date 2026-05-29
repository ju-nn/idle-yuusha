export const SETTINGS_KEY = 'yuusha-settings-v1';

export type UserSettings = {
  bgm: number;
  se: number;
  simplifiedComboSe: boolean;
  textSpeed: 'normal' | 'fast';
};

export const defaultSettings: UserSettings = {
  bgm: 60,
  se: 75,
  simplifiedComboSe: false,
  textSpeed: 'normal',
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
}
