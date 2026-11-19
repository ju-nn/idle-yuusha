// このファイルは scripts/generate-monster-art.mjs による自動生成です。直接編集しないでください。
// モンスター専用絵（ドット絵風・静止画）を base64 データURIで保持します。
// 従来はボスもプログラム生成スプライトで表示されていたが、専用絵のあるモンスターは
// MonsterThumb がこの絵を使う（シルエット表示は CSS の brightness フィルターで維持）。
// 専用絵のないモンスターは従来通りスプライトのフォールバック。
// 320x320・quality 75 の WebP。元画像（1920x1280 生成物）はローカルの monster-gen/ のみに置き、リポジトリには含めません。
// push 時のリクエストサイズ上限（MCP 413）回避のため、実体は 30体ずつの monsterArtPartN.ts に分け、このファイルは束ねるだけです。

import { MONSTER_ART_PART1 } from './monsterArtPart1';
import { MONSTER_ART_PART2 } from './monsterArtPart2';
import { MONSTER_ART_PART3 } from './monsterArtPart3';
import { MONSTER_ART_PART4 } from './monsterArtPart4';

export const MONSTER_ART: Record<string, string> = {
  ...MONSTER_ART_PART1,
  ...MONSTER_ART_PART2,
  ...MONSTER_ART_PART3,
  ...MONSTER_ART_PART4,
};
