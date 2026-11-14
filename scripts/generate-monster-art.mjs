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
// 2026-11-11 10時台に一般モンスター7体（森に忘れられたヘアピン／森に忘れられた風鈴／山道に置き去りの方位磁針／
// 山道に置き去りの望遠鏡／山道に置き去りの登山靴／山道に置き去りのラジオ／山道に置き去りのカメラ）を追加し、専用絵は計51体になった。
// 2026-11-11 13時台に一般モンスター7体（森に忘れられた靴下／山道に置き去りの軍手／山道に置き去りの日傘／
// 山道に置き去りのサングラス／山道に置き去りの凧／山道に置き去りの虫眼鏡／暗闇キノコ）を追加し、専用絵は計58体になった。
// 2026-11-12 08時台に一般モンスター3体（水晶ガニ／つららのカタツムリ／
// 忘れられたマフラー）を追加し、専用絵は計61体になった。登録順の次の4体（森に忘れられたエプロン／
// 山道に置き去りのストック／忘れられたヘルメット／忘れられた懐中電灯）は画像生成の失敗（参照パス指定ミスで
// ツールが再試行不可を返したためこの回は見送り）で次回へ持ち越し。
// 2026-11-12 12時台に持ち越しの4体（森に忘れられたエプロン／山道に置き去りのストック／
// 忘れられたヘルメット／忘れられた懐中電灯）を追加し、専用絵は計65体になった。
// 2026-11-12 20時台に一般モンスター7体（森に忘れられたバンダナ／山道に置き去りのヘッドランプ／
// 忘れられた地図／忘れられたマッチ箱／忘れられたランタン／忘れられたバケツ／洞窟に忘れられたろうそく）を追加し、
// 専用絵は計72体になった。
// 2026-11-12 22時台に一般モンスター7体（森に忘れられた毛糸玉／山道に置き去りの絵はがき／
// 洞窟に忘れられた寝袋／洞窟に忘れられた懐中時計／洞窟に忘れられたスコップ／洞窟に忘れられたスプーン／
// 洞窟に忘れられた財布）を追加し、専用絵は計79体になった。
// 2026-11-13 01時台に一般モンスター7体（森に忘れられた釣り竿／山道に置き去りの救急箱／
// 洞窟に忘れられたオルゴール／洞窟に忘れられた日記／洞窟に忘れられた湯たんぽ／洞窟に忘れられた毛布／
// 洞窟に忘れられたサンダル）を追加し、専用絵は計86体になった。
// 2026-11-14 10時台に一般モンスター7体（森に忘れられた歯ブラシ／山道に置き去りのホイッスル／
// 洞窟に忘れられたハーモニカ／洞窟に忘れられた目覚まし時計／洞窟に忘れられた枕／
// 洞窟に忘れられた石けん／錆びた鎧）を追加し、専用絵は計93体になった。
// 入力はローカルの monster-web-320/<monster>.webp（320x320・quality 75。生成物 1920x1280 を PIL で変換）。
// monster-web-320/ と monster-gen/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-monster-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 専用絵のあるモンスター（2026-11-14 時点で93体：玉座の間のボス4体＋初期モンスター4体＋一般モンスター85体）。
const MONSTERS = ['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king', 'slime', 'goblin', 'wolf', 'cave_bat', 'forest_mushroom', 'sigh_moss', 'whisper_vine', 'sleepy_mushroom', 'lost_umbrella', 'lost_picnic_basket', 'moss_turtle', 'lost_boot', 'rolling_rock', 'cliff_goat', 'shadow_rat', 'left_hat', 'left_handkerchief', 'left_gloves', 'forgotten_picture_book', 'forgotten_ribbon', 'forgotten_bottle', 'forgotten_rope', 'forgotten_hand_mirror', 'forgotten_watering_can', 'forgotten_mug', 'forgotten_wristwatch', 'forgotten_plushie', 'forgotten_comb', 'forgotten_slippers', 'forgotten_earring', 'pebble_golem', 'left_backpack', 'left_water_bottle', 'tilted_signpost', 'summit_crow', 'left_lunchbox', 'forgotten_raincoat', 'left_notebook', 'forgotten_towel', 'left_binoculars', 'forgotten_hairpin', 'forgotten_wind_chime', 'left_compass', 'left_telescope', 'left_hiking_boots', 'left_radio', 'forgotten_camera', 'forgotten_socks', 'left_work_gloves', 'left_parasol', 'left_sunglasses', 'left_kite', 'left_magnifier', 'dark_mushroom', 'crystal_crab', 'icicle_snail', 'forgotten_scarf', 'forgotten_apron', 'left_trekking_pole', 'forgotten_helmet', 'forgotten_flashlight', 'forgotten_bandana', 'left_headlamp', 'forgotten_map', 'forgotten_matches', 'forgotten_lantern', 'forgotten_bucket', 'forgotten_candle', 'forgotten_yarn_ball', 'left_postcard', 'forgotten_sleeping_bag', 'forgotten_pocket_watch', 'forgotten_shovel', 'forgotten_spoon', 'forgotten_wallet', 'forgotten_fishing_rod', 'left_first_aid_kit', 'forgotten_music_box', 'forgotten_diary', 'forgotten_yutanpo', 'forgotten_blanket', 'forgotten_sandal', 'forgotten_toothbrush', 'left_whistle', 'forgotten_harmonica', 'forgotten_alarm_clock', 'forgotten_pillow', 'forgotten_soap', 'rust_armor'];

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
