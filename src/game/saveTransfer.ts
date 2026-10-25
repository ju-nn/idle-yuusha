import type { GameState } from '../types';
import { detectSaveVersion, migrateState, SAVE_KEY, SAVE_VERSION } from './state';

// セーブの書き出し/読み込み。書き出しは素のセーブJSONではなく、
// 「これは idle-yuusha のバックアップだ」と分かる封筒（envelope）形式にする。
// 読み込みは封筒形式と、旧来の素のセーブJSON（既存バックアップ）の両方を受ける。
export const SAVE_BACKUP_GAME_ID = 'idle-yuusha';
export const SAVE_BACKUP_FORMAT_VERSION = 1;

type SaveBackupEnvelope = {
  game: typeof SAVE_BACKUP_GAME_ID;
  kind: 'save-backup';
  formatVersion: number;
  exportedAt: string;
  save: Partial<GameState>;
};

export type SaveImportResult =
  | { ok: true; fromVersion: number; message: string }
  | { ok: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 書き出し: いま保存されているセーブを封筒に入れて文字列にする。セーブが無ければ null。
export function createSaveBackupText(): string | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const save = JSON.parse(raw) as Partial<GameState>;
    const envelope: SaveBackupEnvelope = {
      game: SAVE_BACKUP_GAME_ID,
      kind: 'save-backup',
      formatVersion: SAVE_BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      save,
    };
    return JSON.stringify(envelope, null, 2);
  } catch {
    return null;
  }
}

// セーブらしい形かどうかの検証。ここを通らないものは既存セーブに一切触れない。
function validateSaveCandidate(candidate: unknown): { ok: true; save: Partial<GameState>; fromVersion: number } | { ok: false; message: string } {
  if (!isPlainObject(candidate)) {
    return { ok: false, message: '取り込みに失敗しました。セーブの形が違うみたいです。いまのセーブは無事です。' };
  }
  const save = candidate as Partial<GameState>;
  const fromVersion = detectSaveVersion(save);
  if (typeof save.saveVersion === 'number' && save.saveVersion > SAVE_VERSION) {
    return { ok: false, message: '取り込みに失敗しました。未来のセーブみたいで、この勇者にはまだ読めません。いまのセーブは無事です。' };
  }
  // 中核フィールドのうち複数が揃っていること。どれか1つだけではセーブとみなさない。
  const signals = [
    isPlainObject(save.jobData),
    isPlainObject(save.items),
    typeof save.gold === 'number',
    typeof save.tick === 'number',
    Array.isArray(save.readMusings),
  ].filter(Boolean).length;
  if (signals < 2) {
    return { ok: false, message: '取り込みに失敗しました。セーブの形が違うみたいです。いまのセーブは無事です。' };
  }
  return { ok: true, save, fromVersion };
}

// バックアップ文字列を解釈する。封筒形式なら game の一致を確認し、
// 素のJSONならそのままセーブ候補として扱う（旧バックアップとの互換）。
export function parseSaveBackup(text: string): { ok: true; save: Partial<GameState>; fromVersion: number } | { ok: false; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: '取り込みに失敗しました。その文字列、勇者の知らない言語みたいです。いまのセーブは無事です。' };
  }
  if (isPlainObject(parsed) && 'kind' in parsed) {
    if (parsed.kind !== 'save-backup' || parsed.game !== SAVE_BACKUP_GAME_ID) {
      return { ok: false, message: '取り込みに失敗しました。これは別の世界のセーブみたいです。いまのセーブは無事です。' };
    }
    return validateSaveCandidate(parsed.save);
  }
  return validateSaveCandidate(parsed);
}

// 読み込み: 検証を通ったものだけを、移行処理込みの完全な形にしてから保存する。
// 検証で落ちた場合は localStorage に一切触れないので、既存セーブは上書きされない。
export function importSaveBackup(text: string, initialState: GameState): SaveImportResult {
  const parsed = parseSaveBackup(text);
  if (!parsed.ok) return parsed;
  const migrated = migrateState(parsed.save, initialState);
  localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
  const drifted = parsed.fromVersion < SAVE_VERSION ? `v${parsed.fromVersion} のセーブを今の形（v${SAVE_VERSION}）に引っ越ししてから取り込みました。` : 'セーブを取り込みました。';
  return { ok: true, fromVersion: parsed.fromVersion, message: `${drifted}画面を再読み込みします。` };
}
