// シーンイラスト（ドット絵風・静止画）を base64 データURIとして src/assets/sceneArt.ts に埋め込む生成スクリプト。
//
// 経緯: 2026-10-27 のビジュアル方針転換で、シーン表示はプログラム生成スプライトから
// 画像生成イラストへ移行した。画像はバイナリのため GitHub のテキスト専用 push では送れない。
// そのため Web 最適化済み WebP（scene-web/*.webp、960x640 / quality 80）を base64 化し、
// テキストとしてコミット可能な sceneArt.ts を生成する方式を採る。
// scene-web/ と scene-src/（原画 1920x1280）はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-scene-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JOBS = [
  'fishing', 'woodcutting', 'mining', 'farming', 'merchant', 'adventure',
  'rest', 'office', 'remote', 'shady', 'delivery', 'streaming',
];

const entries = [];
for (const job of JOBS) {
  const path = join(root, 'scene-web', `${job}.webp`);
  if (!existsSync(path)) {
    console.error(`missing: ${path}`);
    process.exit(1);
  }
  const b64 = readFileSync(path).toString('base64');
  entries.push(`  ${job}: 'data:image/webp;base64,${b64}',`);
}

const out = `// このファイルは scripts/generate-scene-art.mjs による自動生成です。直接編集しないでください。
// シーンイラスト（ドット絵風・静止画）を base64 データURIで保持します。
// バイナリ画像をテキストとして安全に配布・コミットするための埋め込み形式です。

export const SCENE_ART: Record<string, string> = {
${entries.join('\n')}
};
`;

writeFileSync(join(root, 'src', 'assets', 'sceneArt.ts'), out);
console.log(`wrote src/assets/sceneArt.ts (${(out.length / 1024).toFixed(0)} KiB)`);
