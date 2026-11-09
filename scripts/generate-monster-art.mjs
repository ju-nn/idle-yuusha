// ボスモンスター専用のイラストを base64 データURIとして src/assets/monsterArt.ts に埋め込む生成スクリプト。
// 2026-11-09 の方針「ボス4体のイラスト化」による。ボスは従来、プログラム生成のスプライト
// （src/assets/sprites/hero/monster-*.png）で表示されていたが、専用絵のあるボスは
// MonsterThumb がこの絵を優先する（シルエット表示も CSS でそのまま効く）。
// 専用絵のないモンスターは従来通りスプライトのフォールバック。
// 入力はローカルの monster-web-320/<boss>.webp（320x320・quality 75。生成物 1600x1600 を PIL で変換）。
// monster-web-320/ と monster-gen/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-monster-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 玉座の間のボス4体すべてに専用絵がある（2026-11-09 時点）。
const BOSSES = ['throne_mimic', 'retired_hero', 'silent_demon_king', 'household_demon_king'];

const entries = [];
for (const boss of BOSSES) {
  const path = join(root, 'monster-web-320', `${boss}.webp`);
  if (!existsSync(path)) {
    console.error(`missing: ${path}`);
    process.exit(1);
  }
  const b64 = readFileSync(path).toString('base64');
  entries.push(`  ${boss}: 'data:image/webp;base64,${b64}',`);
}

const out = `// このファイルは scripts/generate-monster-art.mjs による自動生成です。直接編集しないでください。
// ボスモンスター専用のイラスト（ドット絵風・静止画）を base64 データURIで保持します。
// 従来はボスもプログラム生成スプライトで表示されていたが、専用絵のあるボスは
// MonsterThumb がこの絵を使う（シルエット表示は CSS の brightness フィルターで維持）。
// 専用絵のないモンスターは従来通りスプライトのフォールバック。
// 320x320・quality 75 の WebP。元画像（1600x1600 生成物）はローカルの monster-gen/ のみに置き、リポジトリには含めません。

export const MONSTER_ART: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(join(root, 'src', 'assets', 'monsterArt.ts'), out);
console.log(`wrote src/assets/monsterArt.ts (${(out.length / 1024).toFixed(0)} KiB)`);
