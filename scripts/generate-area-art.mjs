// 冒険エリア専用のシーンイラストを base64 データURIとして src/assets/areaArt.ts に埋め込む生成スクリプト。
// 2026-11-07 の方針「エリア専用イラストの新規生成」による。冒険の8エリアは従来、冒険の仕事絵1枚を
// 色調バリエーション（artVar）で使い回していた。専用絵があるエリアはその絵を使い、無いエリアは従来通り仕事絵＋色調変化にフォールバックする。
// 入力はローカルの scene-web-480/<area>.webp（480x320・quality 75。生成物 1920x1280 を PIL で変換）。
// scene-web-480/ と scene-new/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-area-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 冒険エリア9種すべてに専用絵がある（2026-11-09 時点で9種。輪廻の庭に加え、無限の塔を本コミットで追加し、フォールバックは残っていない）。
const AREAS = ['forest', 'mountain', 'cave', 'throne_room', 'old_castle_gate', 'inner_courtyard', 'rebirth_corridor', 'samsara_garden', 'endless_tower'];

const entries = [];
for (const area of AREAS) {
  const path = join(root, 'scene-web-480', `${area}.webp`);
  if (!existsSync(path)) {
    console.error(`missing: ${path}`);
    process.exit(1);
  }
  const b64 = readFileSync(path).toString('base64');
  entries.push(`  ${area}: 'data:image/webp;base64,${b64}',`);
}

const out = `// このファイルは scripts/generate-area-art.mjs による自動生成です。直接編集しないでください。
// 冒険エリア専用のシーンイラスト（ドット絵風・静止画）を base64 データURIで保持します。
// 従来は冒険の8エリアすべてが冒険の仕事絵1枚を色調バリエーションで使い回していたが、
// 専用絵のあるエリアは HeroScene とエリアボタンでこの絵を使う（色調フィルターは付けない）。
// 専用絵のないエリアは従来通り SCENE_ART.adventure ＋ artVar のフォールバック。
// 480x320・quality 75 の WebP。元画像（1920x1280 生成物）はローカルの scene-new/ のみに置き、リポジトリには含めません。

export const AREA_ART: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(join(root, 'src', 'assets', 'areaArt.ts'), out);
console.log(`wrote src/assets/areaArt.ts (${(out.length / 1024).toFixed(0)} KiB)`);
