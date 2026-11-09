// 仕事の拠点整備パネル専用のシーンイラストを base64 データURIとして src/assets/upgradeArt.ts に埋め込む生成スクリプト。
// 2026-11-09 の方針「拠点整備パネルへの絵」による。拠点整備パネルは従来、テキストの行だけだったが、
// 専用絵のある仕事はパネルの見出しにこの絵を出す（絵のない仕事は従来通り絵なし）。
// 2026-11-09 15時台に最初の4仕事（釣り／休憩／木こり／商人）を追加した。
// 入力はローカルの upgrade-web-480/<job>.webp（480x320・quality 75。生成物 1920x1280 を PIL で変換）。
// upgrade-web-480/ と upgrade-gen/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-upgrade-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 専用絵のある仕事の拠点整備パネル（2026-11-09 時点で4仕事。残りの仕事は今後の追加対象）。
const JOBS = ['fishing', 'rest', 'woodcutting', 'merchant'];

const entries = [];
for (const job of JOBS) {
  const path = join(root, 'upgrade-web-480', `${job}.webp`);
  if (!existsSync(path)) {
    console.error(`missing: ${path}`);
    process.exit(1);
  }
  const b64 = readFileSync(path).toString('base64');
  entries.push(`  ${job}: 'data:image/webp;base64,${b64}',`);
}

const out = `// このファイルは scripts/generate-upgrade-art.mjs による自動生成です。直接編集しないでください。
// 仕事の拠点整備パネル専用のシーンイラスト（ドット絵風・静止画）を base64 データURIで保持します。
// 従来は拠点整備パネルに絵がなくテキストの行だけだったが、専用絵のある仕事は
// UpgradePanel が見出しにこの絵を出す。絵のない仕事は従来通り絵なし。
// 480x320・quality 75 の WebP。元画像（1920x1280 生成物）はローカルの upgrade-gen/ のみに置き、リポジトリには含めません。

export const UPGRADE_ART: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(join(root, 'src', 'assets', 'upgradeArt.ts'), out);
console.log(`wrote src/assets/upgradeArt.ts (${(out.length / 1024).toFixed(0)} KiB)`);
