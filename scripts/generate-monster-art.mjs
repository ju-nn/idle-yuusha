// ボスモンスター＋初期モンスターのイラストを base64 データURIとして src/assets/monsterArt.ts に埋め込む生成スクリプト。
// 2026-11-09 の方針「ボス4体のイラスト化」による。ボスは従来、プログラム生成のスプライト
// （src/assets/sprites/hero/monster-*.png）で表示されていたが、専用絵のあるモンスターは
// MonsterThumb がこの絵を使う（シルエット表示も CSS でそのまま効く）。
// 専用絵のないモンスターは従来通りスプライトのフォールバック。
// 2026-11-09 15時台に初期モンスター4体（スライム／ゴブリン／オオカミ／洞窟コウモリ）を追加し、
// 専用絵はボス4体＋初期4体の計8体になった。
// 2026-11-10 05時台に一般モンスター4体（おすましキノコ／ため息ゴケ／ささやきツタ／寝坊キノコ）を追加し、
// 専用絵は計12体になった。
// 2026-11-10 09時台に一般モンスター4体（迷子の傘／置き忘れのピクニックかご／苔ガメ／迷子の長靴）を追加し、
// 専用絵は計16体になった。
// 2026-11-10 15時台に一般モンスター4体（置き去りの帽子／置き去りのハンカチ／置き去りの手袋／忘れられた絵本）を追加し、
// 専用絵は計23体になった。
// 2026-11-10 17時台に一般モンスター4体（森に忘れられたリボン／山道に置き去りのペットボトル／洞窟に忘れられたロープ／
// 森に忘れられた手鏡）を追加し、専用絵は計27体になった。
// 2026-11-10 22時台に一般モンスター7体（森に忘れられたぬいぐるみ／森に忘れられた櫛／森に忘れられたスリッパ／
// 森に忘れられたイヤリング／ちび岩ゴーレム／置き去りの登山リュック／置き去りの水筒）を追加し、専用絵は計37体になった。
// 入力はローカルの monster-web-320/<monster>.webp（320x320・quality 75。生成物 1920x1280 を PIL で変換）。
// monster-web-320/ と monster-gen/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-monster-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 専用絵のあるモンスター（2026-11-10 時点で37体：玉座の間のボス4体＋初期モンスター4体＋一般モンスター29体）。
const MONSTERS = ['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat', 'forest_mushroom', 'sigh_moss', 'whisper_vine', 'sleepy_mushroom', 'lost_umbrella', 'lost_picnic_basket', 'moss_turtle', 'lost_boot', 'rolling_rock', 'cliff_goat', 'shadow_rat', 'left_hat', 'left_handkerchief', 'left_gloves', 'forgotten_picture_book', 'forgotten_ribbon', 'forgotten_bottle', 'forgotten_rope', 'forgotten_hand_mirror', 'forgotten_watering_can', 'forgotten_mug', 'forgotten_wristwatch', 'forgotten_plushie', 'forgotten_comb', 'forgotten_slippers', 'forgotten_earring', 'pebble_golem', 'left_backpack', 'left_water_bottle'];

const entries = [];
for (const monster of MONSTERS) {
  const path = join(root, 'monster-web-320', `${monster}.webp`);
  if (!existsSync(path)) {
    console.error(`missing: ${path}`);
    process.exit(1);
  }
  const b64 = readFileSync(path).toString('base64');
  entries.push(`  ${monster}: 'data:image/webp;base64,${b64}',`);
}

const out = `// このファイルは scripts/generate-monster-art.mjs による自動生成です。直接編集しないでください。
// ボスモンスター＋初期モンスター専用のイラスト（ドット絵風・静止画）を base64 データURIで保持します。
// 従来はボスもプログラム生成スプライトで表示されていたが、専用絵のあるモンスターは
// MonsterThumb がこの絵を使う（シルエット表示は CSS の brightness フィルターで維持）。
// 専用絵のないモンスターは従来通りスプライトのフォールバック。
// 320x320・quality 75 の WebP。元画像（1920x1280 生成物）はローカルの monster-gen/ のみに置き、リポジトリには含めません。

export const MONSTER_ART: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(join(root, 'src', 'assets', 'monsterArt.ts'), out);
console.log(`wrote src/assets/monsterArt.ts (${(out.length / 1024).toFixed(0)} KiB)`);
