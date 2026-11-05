// 新規仕事ぶんのシーンイラストを base64 データURIとして src/assets/sceneArtExtra.ts に埋め込む生成スクリプト。
// 既存の generate-scene-art.mjs（sceneArt.ts・960x640）は全文が 2.5MB を超え、
// テキスト専用 push での全文送付が困難なため、新規分は 480x320・quality 75 の WebP としてこちらに分離する。
// 入力はローカルの scene-web-480/<job>.webp（scene-web/ の 960x640 版を 480x320 に変換したもの）。
// scene-web-480/ と scene-web/・scene-new/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-scene-art-extra.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JOBS = ['housekeeping', 'photography', 'nightwatch', 'booktrade'];

const entries = [];
for (const job of JOBS) {
  const path = join(root, 'scene-web-480', `${job}.webp`);
  if (!existsSync(path)) {
    console.error(`missing: ${path}`);
    process.exit(1);
  }
  const b64 = readFileSync(path).toString('base64');
  entries.push(`  ${job}: 'data:image/webp;base64,${b64}',`);
}

const out = `// このファイルは scripts/generate-scene-art-extra.mjs による自動生成です。直接編集しないでください。
// 新規仕事ぶんのシーンイラスト（ドット絵風・静止画）を base64 データURIで保持します。
// 既存の src/assets/sceneArt.ts（960x640・2.5MB）はテキスト専用 push では全文送付が
// 困難なため、新規分は 480x320・quality 75 の WebP としてこちらに分離しています。
// 表示枠はスマホ 348px・PC 940px の 3:2 で、480px 幅はスマホでは十分・PC ではやや柔らかく見えます。
// バイナリ画像をテキストとして安全に配布・コミットするための埋め込み形式です。
// 元画像（1920x1280 生成物・960x640 変換版）はローカルの scene-new/・scene-web/ のみに置き、リポジトリには含めません。

export const SCENE_ART_EXTRA: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(join(root, 'src', 'assets', 'sceneArtExtra.ts'), out);
console.log(`wrote src/assets/sceneArtExtra.ts (${(out.length / 1024).toFixed(0)} KiB)`);
