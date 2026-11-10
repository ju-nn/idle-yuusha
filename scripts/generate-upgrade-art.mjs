// 仕事の拠点整備パネル専用のシーンイラストを base64 データURIとして src/assets/upgradeArt.ts に埋め込む生成スクリプト。
// 2026-11-09 の方針「拠点整備パネルへの絵」による。拠点整備パネルは従来、テキストの行だけだったが、
// 専用絵のある仕事はパネルの見出しにこの絵を出す（絵のない仕事は従来通り絵なし）。
// 2026-11-09 15時台に最初の4仕事（釣り／休憩／木こり／商人）を追加した。
// 2026-11-10 05時台に次の4仕事（農業／採掘／冒険／王国勤務）を追加し、専用絵は8仕事になった。
// 2026-11-10 09時台に次の4仕事（在宅作業／配達アプリ／家事代行／写真販売）を追加し、専用絵は12仕事になった。
// 2026-11-10 09時台の統合で08時台の夜間警備を追加し、専用絵は13仕事になった（08時台の nightwatch.webp を採用）。
// 入力はローカルの upgrade-web-480/<job>.webp（480x320・quality 75。生成物 1920x1280 を PIL で変換）。
// upgrade-web-480/ と upgrade-gen/ はローカルのみに置き、リポジトリには含めない。
//
// 使い方: node scripts/generate-upgrade-art.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// 専用絵のある仕事の拠点整備パネル（2026-11-10 時点で13仕事。残りの仕事は今後の追加対象）。
const JOBS = ['fishing', 'rest', 'woodcutting', 'merchant', 'farming', 'mining', 'adventure', 'office', 'remote', 'delivery', 'housekeeping', 'photography', 'nightwatch'];

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
