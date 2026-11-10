// 勇者ドット絵スプライト生成スクリプト
// PIXEL_ART_GUIDE.md 準拠: キャラ 32x48 / 小物 32x32 / 全フレーム同一キャンバス / bottom-center アンカー固定
// 使い方: node scripts/generate-hero-sprites.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'sprites', 'hero');
mkdirSync(OUT, { recursive: true });

// ---------- PNG encoder ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- canvas helpers ----------
function canvas(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}
function px(c, x, y, col) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h || !col) return;
  const i = (y * c.w + x) * 4;
  c.data[i] = col[0]; c.data[i + 1] = col[1]; c.data[i + 2] = col[2]; c.data[i + 3] = col[3] ?? 255;
}
function rect(c, x, y, w, h, col) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(c, xx, yy, col);
}
function line(c, x0, y0, x1, y1, col) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    px(c, x, y, col);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
function saveSheet(frames, name) {
  const w = frames[0].w, h = frames[0].h;
  const sheet = canvas(w * frames.length, h);
  frames.forEach((f, i) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4, di = (y * sheet.w + i * w + x) * 4;
      sheet.data[di] = f.data[si]; sheet.data[di + 1] = f.data[si + 1];
      sheet.data[di + 2] = f.data[si + 2]; sheet.data[di + 3] = f.data[si + 3];
    }
  });
  writeFileSync(join(OUT, name), encodePNG(sheet.w, sheet.h, sheet.data));
  console.log('wrote', name, `${sheet.w}x${sheet.h}`);
}
function saveSingle(c, name) {
  writeFileSync(join(OUT, name), encodePNG(c.w, c.h, c.data));
  console.log('wrote', name, `${c.w}x${c.h}`);
}

// ---------- palette ----------
const K = [46, 38, 32];        // 輪郭
const SKIN = [240, 192, 138];
const HAIR = [107, 74, 47];
const HOOD = [52, 58, 66];
const TUNIC = [78, 125, 90];
const TUNIC_D = [60, 98, 71];
const PANTS = [122, 90, 56];
const BOOT = [74, 52, 35];
const BELT = [166, 124, 61];
const GOLD = [242, 179, 61];
const METAL = [201, 206, 214];
const METAL_D = [139, 147, 161];
const WOOD = [154, 107, 63];
const WOOD_D = [122, 84, 47];
const WHITE = [255, 253, 248];
const RED = [201, 79, 67];
const BLUE = [84, 156, 214];
const WATER = [110, 186, 224];
const WATER_D = [70, 144, 196];
const GREEN = [96, 168, 92];
const GREEN_D = [64, 128, 62];
const GRAY = [150, 148, 142];
const GRAY_D = [110, 108, 102];
const CYAN = [120, 224, 214];
const PAPER = [250, 246, 232];
const SOIL = [128, 92, 58];

// ---------- hero base (32x48, feet at y44-47, bottom-center) ----------
function drawLegs(c) {
  rect(c, 11, 28, 5, 14, PANTS);
  rect(c, 17, 28, 5, 14, PANTS);
  rect(c, 10, 42, 6, 4, BOOT);
  rect(c, 17, 42, 6, 4, BOOT);
  rect(c, 10, 46, 6, 1, K);
  rect(c, 17, 46, 6, 1, K);
}
function drawTorso(c, tunic = TUNIC, tunicD = TUNIC_D) {
  rect(c, 10, 14, 12, 13, tunic);
  rect(c, 10, 14, 12, 1, tunicD);
  rect(c, 10, 24, 12, 3, BELT);
  rect(c, 15, 24, 2, 3, GOLD);
  rect(c, 11, 27, 10, 1, tunicD);
}
function drawHead(c, bob, { hood = false } = {}) {
  const y = bob;
  if (hood) {
    rect(c, 10, 3 + y, 12, 5, HOOD);
    rect(c, 9, 7 + y, 14, 7, HOOD);
    rect(c, 11, 7 + y, 10, 6, SKIN);
    rect(c, 11, 13 + y, 10, 1, HOOD);
  } else {
    rect(c, 11, 3 + y, 10, 4, HAIR);
    rect(c, 10, 6 + y, 12, 2, HAIR);
    rect(c, 11, 8 + y, 10, 5, SKIN);
    rect(c, 10, 8 + y, 1, 4, HAIR);
    rect(c, 21, 8 + y, 1, 4, HAIR);
  }
  px(c, 13, 10 + y, K);
  px(c, 18, 10 + y, K);
  rect(c, 14, 13, 4, 1, SKIN); // 首と繋ぐ
}
function drawArmL(c, dx = 0, dy = 0, sleeve = TUNIC) {
  rect(c, 7 + dx, 15 + dy, 3, 5, sleeve);
  rect(c, 7 + dx, 20 + dy, 3, 5, SKIN);
}
function drawArmR(c, dx = 0, dy = 0, sleeve = TUNIC) {
  rect(c, 22 + dx, 15 + dy, 3, 5, sleeve);
  rect(c, 22 + dx, 20 + dy, 3, 5, SKIN);
}
function baseHero(frame, opts = {}) {
  const c = canvas(32, 48);
  const bob = frame % 2 === 1 ? -1 : 0;
  drawLegs(c);
  drawTorso(c, opts.tunic, opts.tunicD);
  drawHead(c, bob, opts);
  return { c, bob };
}

// ---------- job motions (4 frames each) ----------
const FRAMES = 4;
function heroFishing(f) {
  const { c, bob } = baseHero(f);
  drawArmL(c);
  // 右腕は竿を持つため少し前へ
  rect(c, 22, 15 + bob, 3, 5, TUNIC);
  rect(c, 23, 20 + bob, 3, 4, SKIN);
  const tips = [[31, 3], [31, 5], [30, 3], [31, 5]];
  const lineEnds = [27, 31, 27, 35];
  const [tx, ty] = tips[f];
  line(c, 24, 20 + bob, tx, ty + bob, WOOD_D);
  line(c, tx, ty + bob, tx, lineEnds[f], [230, 236, 240]);
  px(c, tx, lineEnds[f], RED);
  px(c, tx, lineEnds[f] + 1, WHITE);
  return c;
}
function heroWoodcutting(f) {
  const { c, bob } = baseHero(f);
  drawArmL(c);
  const ends = [[30, 5], [31, 12], [30, 23], [31, 12]]; // 振りかぶり→振り下ろし
  const [ex, ey] = ends[f];
  line(c, 23, 20 + bob, ex, ey, WOOD);
  rect(c, ex - 1, ey - 2, 4, 3, METAL);
  rect(c, ex - 1, ey - 2, 4, 1, METAL_D);
  rect(c, 22, 15 + bob, 3, 5, TUNIC);
  rect(c, 22, 19 + bob, 3, 4, SKIN);
  return c;
}
function heroMining(f) {
  const { c, bob } = baseHero(f);
  drawArmL(c);
  const ends = [[29, 4], [31, 11], [31, 22], [31, 11]];
  const [ex, ey] = ends[f];
  line(c, 23, 20 + bob, ex, ey, WOOD);
  // ツルハシの弧
  px(c, ex - 3, ey - 1, METAL); px(c, ex - 2, ey - 2, METAL); px(c, ex - 1, ey - 2, METAL);
  px(c, ex, ey - 1, METAL); px(c, ex + 1, ey - 2, METAL); px(c, ex + 2, ey - 2, METAL); px(c, ex + 3, ey - 1, METAL);
  px(c, ex - 3, ey, METAL_D); px(c, ex + 3, ey, METAL_D);
  rect(c, 22, 15 + bob, 3, 5, TUNIC);
  rect(c, 22, 19 + bob, 3, 4, SKIN);
  if (f === 2) { // ヒット時の欠片
    px(c, 29, 26, GRAY); px(c, 26, 28, GRAY); px(c, 30, 30, GRAY_D);
  }
  return c;
}
function heroFarming(f) {
  const { c, bob } = baseHero(f);
  drawArmL(c);
  const ends = [[29, 8], [30, 16], [29, 25], [30, 16]];
  const [ex, ey] = ends[f];
  line(c, 23, 20 + bob, ex, ey, WOOD);
  rect(c, ex - 2, ey, 5, 2, METAL_D); // 鍬の刃
  rect(c, 22, 15 + bob, 3, 5, TUNIC);
  rect(c, 22, 19 + bob, 3, 4, SKIN);
  if (f === 2) { px(c, 27, 30, SOIL); px(c, 30, 32, SOIL); px(c, 25, 33, SOIL); }
  return c;
}
function heroMerchant(f) {
  const { c, bob } = baseHero(f);
  const bounce = [0, -1, 0, -1][f];
  // 左手に金袋
  rect(c, 7, 15 + bob, 3, 5, TUNIC);
  rect(c, 5, 20 + bob + bounce, 6, 2, GOLD);
  rect(c, 4, 22 + bob + bounce, 8, 7, [168, 124, 74]);
  rect(c, 4, 28 + bob + bounce, 8, 1, WOOD_D);
  px(c, 7, 24 + bob + bounce, GOLD); px(c, 8, 25 + bob + bounce, GOLD);
  // 右手は小さく振る
  const wave = f % 2 === 0 ? 0 : -3;
  rect(c, 22, 15 + bob + wave, 3, 5, TUNIC);
  rect(c, 22, 20 + bob + wave, 3, 4, SKIN);
  return c;
}
function heroAdventure(f) {
  const { c, bob } = baseHero(f);
  // 左手に盾
  rect(c, 2, 15 + bob, 7, 12, WOOD);
  rect(c, 2, 15 + bob, 7, 1, METAL_D); rect(c, 2, 26 + bob, 7, 1, METAL_D);
  rect(c, 5, 20 + bob, 2, 2, GOLD);
  // 右手の剣: 上→斜め→斬り下ろし→斜め
  const blades = [
    [[26, 2], [26, 13]],
    [[31, 8], [25, 15]],
    [[31, 22], [24, 19]],
    [[31, 8], [25, 15]],
  ];
  const [[bx0, by0], [bx1, by1]] = blades[f];
  line(c, bx0, by0 + bob, bx1, by1 + bob, METAL);
  line(c, bx0 + 1, by0 + bob, bx1 + 1, by1 + bob, WHITE);
  rect(c, 22, 18 + bob, 5, 2, GOLD); // 鍔
  rect(c, 22, 15 + bob, 3, 5, TUNIC);
  rect(c, 22, 20 + bob, 3, 3, SKIN);
  return c;
}
function heroOffice(f) {
  const { c, bob } = baseHero(f);
  drawArmL(c);
  drawArmR(c);
  // 両手で書類を持つ（小さく上下）
  const dy = f % 2 === 0 ? 0 : 1;
  rect(c, 12, 18 + bob + dy, 8, 10, PAPER);
  rect(c, 12, 18 + bob + dy, 8, 1, METAL_D);
  rect(c, 14, 21 + bob + dy, 4, 1, METAL_D);
  rect(c, 14, 23 + bob + dy, 5, 1, METAL_D);
  rect(c, 14, 25 + bob + dy, 3, 1, METAL_D);
  return c;
}
function heroRemote(f) {
  const { c, bob } = baseHero(f);
  drawArmL(c);
  drawArmR(c);
  // 胸元にノートPC
  rect(c, 11, 20 + bob, 10, 7, HOOD);
  rect(c, 12, 21 + bob, 8, 5, f === 3 ? [110, 150, 160] : [159, 216, 232]);
  rect(c, 11, 27 + bob, 10, 1, METAL_D);
  return c;
}
function heroShady(f) {
  const { c, bob } = baseHero(f, { hood: true, tunic: [66, 71, 80], tunicD: [50, 55, 62] });
  drawArmL(c, 0, 0, [66, 71, 80]);
  // 右手に短剣
  const sway = f % 2 === 0 ? 0 : 1;
  line(c, 24, 22 + bob, 28 + sway, 16 + bob, METAL);
  rect(c, 22, 15 + bob, 3, 5, [66, 71, 80]);
  rect(c, 22, 20 + bob, 3, 3, SKIN);
  return c;
}
function heroRest(f) {
  // 横たわる勇者 + 立ち上る Zzz（足元アンカーは底辺固定）
  const c = canvas(32, 48);
  rect(c, 2, 40, 12, 5, WHITE); // 枕
  rect(c, 3, 38, 9, 4, HAIR);
  rect(c, 4, 39, 8, 5, SKIN);
  px(c, 6, 41, K); // 閉じ目
  rect(c, 12, 40, 16, 6, TUNIC); // 体（布団代わりの上着）
  rect(c, 12, 45, 16, 1, TUNIC_D);
  rect(c, 28, 41, 4, 4, PANTS);
  rect(c, 30, 39, 2, 3, BOOT); // 飛び出た足
  rect(c, 1, 46, 30, 1, [196, 178, 150]); // ござ
  // Zzz がフレームごとに上昇
  const zy = [22, 18, 14, 10][f];
  const zx = 20 + (f % 2);
  const drawZ = (x, y, s, col) => {
    rect(c, x, y, s, 1, col); rect(c, x, y + s - 1, s, 1, col);
    for (let i = 0; i < s; i++) px(c, x + s - 1 - i, y + i, col);
  };
  drawZ(zx, zy, 5, [120, 150, 190]);
  drawZ(zx + 7, zy + 6, 3, [150, 175, 205]);
  return c;
}
const HERO_BUILDERS = {
  fishing: heroFishing,
  woodcutting: heroWoodcutting,
  mining: heroMining,
  farming: heroFarming,
  merchant: heroMerchant,
  adventure: heroAdventure,
  office: heroOffice,
  remote: heroRemote,
  shady: heroShady,
  rest: heroRest,
};
for (const [job, build] of Object.entries(HERO_BUILDERS)) {
  saveSheet(Array.from({ length: FRAMES }, (_, f) => build(f)), `hero-${job}.png`);
}

// ---------- props (32x32, bottom-center) ----------
function propFishing() {
  const c = canvas(32, 32);
  for (let y = 24; y < 32; y++) {
    const inset = y === 24 ? 4 : y === 25 ? 2 : 0;
    rect(c, 1 + inset, y, 30 - inset * 2, 1, y % 2 ? WATER : WATER_D);
  }
  px(c, 7, 27, WHITE); px(c, 8, 27, WHITE); px(c, 21, 29, WHITE); px(c, 24, 26, WHITE);
  return c;
}
function propWoodcutting() {
  const c = canvas(32, 32);
  rect(c, 14, 14, 4, 18, WOOD_D);
  const leaf = (x, y, w, h, col) => rect(c, x, y, w, h, col);
  leaf(8, 4, 16, 5, GREEN_D); leaf(5, 8, 22, 6, GREEN); leaf(7, 13, 18, 5, GREEN_D);
  leaf(11, 2, 9, 3, GREEN); px(c, 10, 6, GREEN); px(c, 22, 10, GREEN_D);
  return c;
}
function propMining() {
  const c = canvas(32, 32);
  rect(c, 6, 20, 20, 4, GRAY_D); rect(c, 3, 24, 26, 8, GRAY);
  rect(c, 9, 16, 13, 4, GRAY); rect(c, 12, 13, 7, 3, GRAY_D);
  px(c, 15, 10, CYAN); rect(c, 14, 11, 3, 3, CYAN); px(c, 21, 18, CYAN); px(c, 8, 22, CYAN);
  return c;
}
function propFarming() {
  const c = canvas(32, 32);
  rect(c, 1, 26, 30, 6, SOIL);
  rect(c, 1, 26, 30, 1, WOOD_D);
  for (const x of [6, 15, 24]) {
    rect(c, x, 21, 1, 5, GREEN_D);
    px(c, x - 2, 20, GREEN); px(c, x + 2, 20, GREEN); px(c, x, 19, GREEN);
    px(c, x, 28, WHITE); px(c, x, 29, WHITE); // 大根の白
  }
  return c;
}
function propMerchant() {
  const c = canvas(32, 32);
  rect(c, 4, 17, 24, 15, WOOD);
  rect(c, 4, 17, 24, 2, WOOD_D); rect(c, 4, 24, 24, 1, WOOD_D);
  rect(c, 6, 12, 5, 5, RED); rect(c, 13, 11, 5, 6, GOLD); rect(c, 20, 12, 5, 5, GREEN);
  px(c, 8, 10, GREEN_D); px(c, 15, 9, GOLD);
  return c;
}
function propAdventure() {
  const c = canvas(32, 32);
  rect(c, 15, 10, 2, 22, WOOD_D);
  rect(c, 7, 8, 17, 5, WOOD);
  px(c, 22, 10, WOOD_D); px(c, 21, 11, WOOD_D); // 矢印の先
  rect(c, 10, 16, 12, 4, WOOD);
  return c;
}
function propRest() {
  const c = canvas(32, 32);
  rect(c, 3, 23, 26, 8, [140, 170, 205]);
  rect(c, 3, 23, 26, 1, [110, 140, 175]);
  rect(c, 4, 20, 9, 4, WHITE);
  rect(c, 20, 26, 6, 2, [110, 140, 175]);
  return c;
}
function propOffice() {
  const c = canvas(32, 32);
  rect(c, 3, 18, 26, 3, WOOD);
  rect(c, 4, 21, 3, 11, WOOD_D); rect(c, 25, 21, 3, 11, WOOD_D);
  rect(c, 6, 14, 8, 4, PAPER); rect(c, 7, 12, 8, 4, WHITE); // 書類の山
  rect(c, 22, 13, 4, 5, RED); px(c, 24, 11, K); // カップ
  return c;
}
function propRemote() {
  const c = canvas(32, 32);
  rect(c, 5, 20, 22, 3, WOOD);
  rect(c, 6, 23, 3, 9, WOOD_D); rect(c, 23, 23, 3, 9, WOOD_D);
  rect(c, 12, 12, 9, 7, HOOD); rect(c, 13, 13, 7, 5, [159, 216, 232]); // ノートPC
  rect(c, 24, 16, 4, 4, GOLD); // マグ
  return c;
}
function propShady() {
  const c = canvas(32, 32);
  rect(c, 9, 13, 13, 19, WOOD);
  rect(c, 9, 17, 13, 2, WOOD_D); rect(c, 9, 27, 13, 2, WOOD_D);
  rect(c, 8, 13, 15, 2, WOOD_D);
  rect(c, 23, 24, 7, 8, [168, 124, 74]); px(c, 26, 22, GOLD); // 袋
  px(c, 15, 21, K); // 樽の「？」
  rect(c, 14, 20, 3, 1, K); px(c, 16, 22, K); px(c, 15, 23, K);
  return c;
}
const PROP_BUILDERS = {
  fishing: propFishing, woodcutting: propWoodcutting, mining: propMining, farming: propFarming,
  merchant: propMerchant, adventure: propAdventure, rest: propRest, office: propOffice,
  remote: propRemote, shady: propShady,
};
for (const [job, build] of Object.entries(PROP_BUILDERS)) saveSingle(build(), `prop-${job}.png`);

// ---------- ambient: cloud (64x32) & leaf (16x16) ----------
// 2026-10-26 作り直し: 単色ブロック→丸みのある2トーン雲 / 輪郭のはっきりした葉
{
  const c = canvas(64, 32);
  const W = [255, 255, 255, 235], SHADE = [206, 222, 236, 235], HI = [255, 255, 255, 245];
  // 下地（影色で輪郭を作る）
  rect(c, 8, 20, 48, 7, SHADE);
  rect(c, 12, 14, 16, 8, SHADE); rect(c, 24, 10, 18, 12, SHADE); rect(c, 38, 15, 14, 7, SHADE);
  rect(c, 18, 6, 12, 6, SHADE); rect(c, 44, 18, 8, 4, SHADE);
  // 本体（白）
  rect(c, 9, 19, 46, 6, W);
  rect(c, 13, 13, 15, 7, W); rect(c, 25, 9, 16, 11, W); rect(c, 39, 14, 12, 6, W);
  rect(c, 19, 5, 10, 5, W);
  // ハイライトと底面の丸み
  rect(c, 20, 6, 8, 2, HI); rect(c, 27, 10, 10, 2, HI);
  rect(c, 12, 25, 40, 2, SHADE); px(c, 10, 25, SHADE); px(c, 53, 25, SHADE);
  saveSingle(c, 'cloud.png');
}
{
  const c = canvas(16, 16);
  const G = [106, 178, 98], Gd = [58, 122, 58], GL = [156, 216, 140];
  // 葉の輪郭（左下→右上に対角の葉）
  const body = [[4, 12], [5, 11], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5], [12, 4], [13, 3], [13, 4], [12, 6], [11, 8], [10, 10], [9, 11], [7, 12], [5, 13], [4, 12]];
  body.forEach(([x, y]) => px(c, x, y, G));
  [[6, 11], [7, 10], [8, 9], [9, 8], [10, 7], [11, 6], [12, 5], [8, 10], [9, 9], [10, 8], [11, 7], [7, 11], [9, 10], [10, 9]].forEach(([x, y]) => px(c, x, y, G));
  px(c, 12, 4, GL); px(c, 10, 6, GL); px(c, 8, 8, GL);
  line(c, 3, 14, 12, 4, Gd); // 葉脈＋茎
  px(c, 2, 15, Gd);
  saveSingle(c, 'leaf.png');
}
// ---------- monsters (48x48 x2 frames, bottom-center) ----------
const SLIME_B = [104, 196, 168], SLIME_D = [62, 158, 138], SLIME_L = [168, 232, 210];
function monsterSlime(f) {
  const c = canvas(48, 48);
  const squash = f === 1 ? 2 : 0; // frame2: 低く広く
  const top = 22 + squash, hw = 15 - squash; // 半幅
  for (let y = top; y <= 44; y++) {
    const t = (y - top) / (44 - top);
    const w = Math.round(hw * Math.sin(Math.min(1, t * 0.85 + 0.18) * Math.PI * 0.62));
    rect(c, 24 - w, y, w * 2, 1, y < top + 4 ? SLIME_L : SLIME_B);
  }
  rect(c, 9 + squash, 44, 30 - squash * 2, 3, SLIME_D);
  rect(c, 10 + squash, 46, 28 - squash * 2, 1, SLIME_D);
  px(c, 15, 26 + squash, WHITE); px(c, 16, 25 + squash, WHITE); px(c, 14, 27 + squash, WHITE); // ハイライト
  px(c, 18, 34, K); px(c, 19, 34, K); px(c, 18, 35, K); px(c, 19, 35, K); // 目
  px(c, 29, 34, K); px(c, 30, 34, K); px(c, 29, 35, K); px(c, 30, 35, K);
  rect(c, 22, 40, 4, 1, SLIME_D); // 口
  return c;
}
const GOB_SKIN = [110, 172, 84], GOB_D = [78, 132, 56];
function monsterGoblin(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 脚と腰布
  rect(c, 19, 38, 4, 7, GOB_D); rect(c, 25, 38, 4, 7, GOB_D);
  rect(c, 18, 45, 5, 2, K); rect(c, 25, 45, 5, 2, K);
  rect(c, 17, 32, 14, 7, [146, 106, 62]);
  rect(c, 17, 32, 14, 2, WOOD_D);
  // 胴
  rect(c, 18, 22 + bob, 12, 10, GOB_SKIN);
  rect(c, 18, 22 + bob, 12, 2, GOB_D);
  // 左腕 / 右腕＋短剣（frame で振り位置が変わる）
  rect(c, 14, 23 + bob, 4, 8, GOB_SKIN);
  const dx = f === 1 ? 2 : 0;
  rect(c, 30, 23 + bob, 4, 8, GOB_SKIN);
  line(c, 33 + dx, 29 + bob, 38 + dx, 22 + bob, METAL);
  px(c, 39 + dx, 21 + bob, METAL);
  // 頭と長い耳
  rect(c, 18, 10 + bob, 12, 11, GOB_SKIN);
  rect(c, 12, 12 + bob, 6, 3, GOB_SKIN); rect(c, 30, 12 + bob, 6, 3, GOB_SKIN);
  px(c, 11, 13 + bob, GOB_D); px(c, 36, 13 + bob, GOB_D);
  rect(c, 20, 9 + bob, 8, 2, GOB_D); // もじゃ髪
  px(c, 21, 15 + bob, RED); px(c, 26, 15 + bob, RED); // 目
  rect(c, 22, 19 + bob, 4, 1, K); px(c, 23, 20 + bob, WHITE); // 口と牙
  return c;
}
const WOLF_B = [148, 150, 158], WOLF_D = [104, 106, 116], WOLF_L = [196, 198, 204];
function monsterWolf(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  const tailUp = f === 1 ? 0 : 2;
  // 尾
  line(c, 40, 30 - tailUp, 46, 24 - tailUp, WOLF_D);
  line(c, 40, 31 - tailUp, 46, 26 - tailUp, WOLF_B);
  // 体
  rect(c, 14, 26 + bob, 27, 10, WOLF_B);
  rect(c, 14, 26 + bob, 27, 2, WOLF_D);
  rect(c, 16, 34 + bob, 22, 2, WOLF_L); // 腹
  // 脚
  for (const x of [16, 23, 33, 38]) rect(c, x, 36 + bob, 3, 9, WOLF_D);
  for (const x of [16, 23, 33, 38]) rect(c, x, 44 + bob, 3, 2, K);
  // 頭（左向き）
  rect(c, 3, 20 + bob, 13, 10, WOLF_B);
  rect(c, 1, 26 + bob, 7, 5, WOLF_L); // 口先
  px(c, 1, 27 + bob, K); // 鼻
  px(c, 7, 30 + bob, WHITE); px(c, 9, 30 + bob, WHITE); // 牙
  rect(c, 5, 15 + bob, 4, 6, WOLF_D); rect(c, 11, 16 + bob, 4, 5, WOLF_D); // 耳
  px(c, 8, 23 + bob, RED); px(c, 9, 23 + bob, RED); // 目
  return c;
}
const RUST = [172, 102, 66], RUST_D = [128, 72, 44], RUST_L = [206, 146, 102];
function monsterRustArmor(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 脚（鎧の足）
  rect(c, 18 + sway, 38, 5, 8, RUST_D); rect(c, 25 + sway, 38, 5, 8, RUST_D);
  rect(c, 17 + sway, 45, 6, 2, K); rect(c, 25 + sway, 45, 6, 2, K);
  // スカート状の鎧
  rect(c, 16 + sway, 32, 16, 6, RUST);
  rect(c, 16 + sway, 36, 16, 2, RUST_D);
  // 胴
  rect(c, 16 + sway, 20, 16, 12, RUST);
  rect(c, 16 + sway, 20, 16, 2, RUST_L);
  rect(c, 23 + sway, 24, 2, 7, RUST_D); // 胸の継ぎ目
  px(c, 19 + sway, 27, RUST_D); px(c, 28 + sway, 29, RUST_D); px(c, 21 + sway, 22, RUST_L); // 錆と傷
  // 腕（右腕は錆びた剣を下げる）
  rect(c, 12 + sway, 21, 4, 11, RUST_D);
  rect(c, 32 + sway, 21, 4, 11, RUST_D);
  line(c, 35 + sway, 31, 39 + sway, 42, METAL_D);
  // 兜
  rect(c, 17 + sway, 8, 14, 11, RUST);
  rect(c, 17 + sway, 8, 14, 2, RUST_L);
  rect(c, 19 + sway, 13, 10, 3, K); // バイザーの闇
  px(c, 21 + sway, 14, [255, 120, 90]); px(c, 26 + sway, 14, [255, 120, 90]); // 闇に光る目
  rect(c, 22 + sway, 2, 4, 6, RUST_D); // 前立て
  px(c, 23 + sway, 1, RUST_L);
  return c;
}
const PAPER_W = [250, 248, 240], PAPER_S = [222, 216, 200];
function monsterBillWraith(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? -2 : 0; // 浮遊: frame で上下
  // 紙の体（下端は波形）
  rect(c, 13, 8 + bob, 22, 32, PAPER_W);
  rect(c, 13, 8 + bob, 22, 2, PAPER_S);
  for (let x = 13; x < 35; x += 4) rect(c, x, 40 + bob, 2, 3, PAPER_W);
  rect(c, 15, 38 + bob, 18, 2, PAPER_S);
  // 罫線と金額欄
  rect(c, 17, 16 + bob, 14, 1, [178, 172, 158]);
  rect(c, 17, 20 + bob, 14, 1, [178, 172, 158]);
  rect(c, 17, 24 + bob, 9, 1, [178, 172, 158]);
  rect(c, 17, 30 + bob, 14, 2, [238, 226, 198]);
  // 目と口（請求書の亡霊）
  px(c, 20, 12 + bob, K); px(c, 27, 12 + bob, K);
  rect(c, 22, 34 + bob, 4, 2, K);
  // 督促の赤丸スタンプ
  const stamp = [206, 62, 52];
  for (let a = 0; a < 8; a++) {
    const sx = 29 + Math.round(3.4 * Math.cos(a * Math.PI / 4)), sy = 28 + bob + Math.round(3.4 * Math.sin(a * Math.PI / 4));
    px(c, sx, sy, stamp);
  }
  px(c, 29, 26 + bob, stamp); px(c, 29, 28 + bob, stamp); px(c, 29, 30 + bob, stamp);
  rect(c, 27, 28 + bob, 5, 1, stamp);
  // 小さな腕
  rect(c, 9, 22 + bob, 4, 2, PAPER_S); rect(c, 35, 22 + bob, 4, 2, PAPER_S);
  return c;
}
const MIMIC_W = [146, 96, 52], MIMIC_D = [106, 66, 34];
function monsterTaxMimic(f) {
  const c = canvas(48, 48);
  const open = f === 1 ? 2 : 0; // frame2: 蓋が少し開く
  // 本体（箱）
  rect(c, 8, 28, 32, 17, MIMIC_W);
  rect(c, 8, 28, 32, 2, MIMIC_D);
  rect(c, 8, 42, 32, 3, MIMIC_D);
  rect(c, 22, 28, 4, 17, GOLD); // 金の帯
  rect(c, 22, 36, 4, 4, GOLD); // 錠前
  px(c, 23, 37, K);
  // 蓋（開くと牙が見える）
  rect(c, 7, 18 - open, 34, 10, MIMIC_D);
  rect(c, 7, 18 - open, 34, 2, [178, 124, 74]);
  if (open) {
    rect(c, 10, 28 - open, 28, 2, [120, 30, 30]); // 口内
    for (const x of [12, 18, 24, 30]) { px(c, x, 30 - open, WHITE); px(c, x + 1, 30 - open, WHITE); } // 下の牙
    for (const x of [15, 21, 27]) px(c, x, 27 - open, WHITE); // 上の牙
  }
  // 蓋の上の目
  px(c, 16, 22 - open, WHITE); px(c, 17, 22 - open, WHITE); px(c, 16, 23 - open, K);
  px(c, 30, 22 - open, WHITE); px(c, 31, 22 - open, WHITE); px(c, 31, 23 - open, K);
  // 申告書の紙切れが挟まる
  rect(c, 36, 24 - open, 5, 7, PAPER_W);
  rect(c, 37, 26 - open, 3, 1, [178, 172, 158]);
  return c;
}
const KING_C = [44, 48, 74], KING_D = [28, 30, 48], KING_F = [226, 220, 205];
function monsterQuietKing(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // マント（裾広がり）
  for (let y = 18; y <= 46; y++) {
    const w = 8 + Math.round((y - 18) * 0.32);
    rect(c, 24 - w + sway, y, w * 2, 1, y > 42 ? KING_D : KING_C);
  }
  rect(c, 23 + sway, 20, 2, 24, KING_D); // 前の合わせ
  px(c, 24 + sway, 30, GOLD); px(c, 24 + sway, 38, GOLD); // 留め金
  // 肩と腕
  rect(c, 13 + sway, 19, 6, 4, KING_D); rect(c, 29 + sway, 19, 6, 4, KING_D);
  // 顔（影の中に白い顔）
  rect(c, 18 + sway, 9, 12, 10, KING_F);
  rect(c, 18 + sway, 9, 12, 2, [198, 192, 176]);
  px(c, 21 + sway, 14, K); px(c, 27 + sway, 14, K); // 目
  rect(c, 22 + sway, 17, 4, 1, [178, 172, 158]); // 口
  // 王冠
  rect(c, 17 + sway, 5, 14, 3, GOLD);
  for (const x of [17, 21, 25, 29]) rect(c, x + sway, 2, 2, 3, GOLD);
  px(c, 23 + sway, 6, RED);
  if (f === 1) { px(c, 18 + sway, 3, WHITE); px(c, 30 + sway, 4, WHITE); } // 冠のきらめき
  return c;
}
const MUSH_CAP = [190, 90, 70], MUSH_CAP_D = [150, 62, 48], MUSH_STEM = [246, 238, 214];
function monsterForestMushroom(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 茎（眠そうな顔つき）
  rect(c, 19, 28 + bob, 10, 16, MUSH_STEM);
  rect(c, 19, 28 + bob, 10, 2, [210, 198, 170]);
  rect(c, 17, 44 + bob, 4, 2, MUSH_STEM); rect(c, 27, 44 + bob, 4, 2, MUSH_STEM);
  // 傘（段状のドーム）
  rect(c, 15, 18 + bob, 18, 4, MUSH_CAP);
  rect(c, 12, 22 + bob, 24, 4, MUSH_CAP);
  rect(c, 10, 26 + bob, 28, 3, MUSH_CAP_D);
  px(c, 16, 20 + bob, WHITE); px(c, 30, 20 + bob, WHITE); px(c, 23, 23 + bob, WHITE); // 傘の斑点
  // 眠そうな目と小さな口
  rect(c, 20, 33 + bob, 3, 1, K); rect(c, 25, 33 + bob, 3, 1, K);
  rect(c, 22, 38 + bob, 4, 1, K);
  return c;
}
const GOLEM = [150, 148, 142], GOLEM_D = [108, 106, 100];
function monsterPebbleGolem(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 脚
  rect(c, 18, 38 + bob, 5, 8, GOLEM_D); rect(c, 25, 38 + bob, 5, 8, GOLEM_D);
  rect(c, 17, 45 + bob, 6, 2, K); rect(c, 25, 45 + bob, 6, 2, K);
  // 胴と苔むした頭
  rect(c, 15, 20 + bob, 18, 18, GOLEM);
  rect(c, 15, 20 + bob, 18, 2, GOLEM_D);
  rect(c, 17, 18 + bob, 14, 3, GREEN);
  px(c, 20, 24 + bob, GOLEM_D); px(c, 27, 30 + bob, GOLEM_D); // ひび
  // 腕
  rect(c, 11, 22 + bob, 4, 12, GOLEM_D); rect(c, 33, 22 + bob, 4, 12, GOLEM_D);
  // 頭と光る目
  rect(c, 18, 11 + bob, 12, 8, GOLEM);
  px(c, 21, 14 + bob, GOLD); px(c, 26, 14 + bob, GOLD);
  rect(c, 22, 17 + bob, 4, 1, K);
  return c;
}
const BAT = [88, 72, 120], BAT_WING = [120, 100, 150];
function monsterCaveBat(f) {
  const c = canvas(48, 48);
  const flap = f === 1 ? -3 : 0; // frame2: 翼を上げる
  // 翼
  rect(c, 5, 20 + flap, 15, 8, BAT_WING); rect(c, 5, 26 + flap, 15, 2, BAT);
  rect(c, 28, 20 + flap, 15, 8, BAT_WING); rect(c, 28, 26 + flap, 15, 2, BAT);
  // 体と耳
  rect(c, 20, 22, 8, 14, BAT);
  rect(c, 20, 17, 3, 6, BAT); rect(c, 25, 17, 3, 6, BAT);
  px(c, 20, 17, [246, 238, 214]); px(c, 26, 17, [246, 238, 214]);
  // 目と牙
  px(c, 22, 26, RED); px(c, 25, 26, RED);
  px(c, 22, 30, WHITE); px(c, 25, 30, WHITE);
  rect(c, 18, 36, 3, 2, BAT); rect(c, 27, 36, 3, 2, BAT);
  return c;
}
function monsterGatekeeperArmor(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 脚とスカート状の鎧（錆びた鎧より一回り大きく、門番らしい重さ）
  rect(c, 17 + sway, 38, 6, 8, RUST_D); rect(c, 25 + sway, 38, 6, 8, RUST_D);
  rect(c, 16 + sway, 45, 7, 2, K); rect(c, 25 + sway, 45, 7, 2, K);
  rect(c, 15 + sway, 32, 18, 6, RUST);
  rect(c, 15 + sway, 36, 18, 2, RUST_D);
  // 胴（門の紋章つき）
  rect(c, 15 + sway, 20, 18, 12, RUST);
  rect(c, 15 + sway, 20, 18, 2, RUST_L);
  rect(c, 22 + sway, 24, 4, 4, GOLD); // 紋章
  px(c, 24 + sway, 26, RUST_D);
  // 腕（右手に大きな門の鍵）
  rect(c, 11 + sway, 21, 4, 11, RUST_D);
  rect(c, 33 + sway, 21, 4, 11, RUST_D);
  rect(c, 36 + sway, 31, 2, 11, GOLD);
  rect(c, 35 + sway, 31, 4, 4, GOLD); px(c, 36 + sway, 32, K);
  rect(c, 38 + sway, 36, 3, 2, GOLD);
  // 兜（縦長の前立てと横スリット）
  rect(c, 16 + sway, 7, 16, 12, RUST);
  rect(c, 16 + sway, 7, 16, 2, RUST_L);
  rect(c, 22 + sway, 1, 4, 6, RUST_D);
  rect(c, 18 + sway, 12, 12, 3, K);
  px(c, 21 + sway, 13, GOLD); px(c, 26 + sway, 13, GOLD);
  return c;
}
const FOUNTAIN_W = [110, 186, 224], FOUNTAIN_D = [70, 144, 196];
function monsterDryFountainSpirit(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? -1 : 0;
  // 枯れた噴水の鉢（水はほとんどない）
  rect(c, 10, 36, 28, 8, GRAY_D);
  rect(c, 8, 34, 32, 3, GRAY);
  rect(c, 12, 38, 4, 2, WATER_D); // 残り水
  // 水の精の体（しずく形）
  rect(c, 19, 12 + bob, 10, 6, FOUNTAIN_W);
  rect(c, 16, 18 + bob, 16, 14, FOUNTAIN_W);
  rect(c, 16, 30 + bob, 16, 2, FOUNTAIN_D);
  px(c, 22, 10 + bob, FOUNTAIN_W); px(c, 25, 10 + bob, FOUNTAIN_W);
  // 眠そうな目と小さな口（水不足で元気がない）
  rect(c, 19, 21 + bob, 3, 1, K); rect(c, 26, 21 + bob, 3, 1, K);
  rect(c, 22, 26 + bob, 4, 1, K);
  // 両手に小さな水滴
  px(c, 14, 24 + bob, WATER); px(c, 15, 24 + bob, WATER);
  px(c, 32, 24 + bob, WATER); px(c, 33, 24 + bob, WATER);
  return c;
}
function monsterSilentGardener(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 脚と長い外套（庭仕事の土色）
  rect(c, 18 + sway, 38, 5, 8, [92, 74, 52]); rect(c, 25 + sway, 38, 5, 8, [92, 74, 52]);
  for (let y = 20; y <= 46; y++) {
    const w = 7 + Math.round((y - 20) * 0.28);
    rect(c, 24 - w + sway, y, w * 2, 1, y > 40 ? GREEN_D : GREEN);
  }
  // 帽子と影の顔
  rect(c, 14 + sway, 8, 20, 3, [92, 74, 52]);
  rect(c, 17 + sway, 5, 14, 3, [92, 74, 52]);
  rect(c, 18 + sway, 11, 12, 8, [52, 58, 50]);
  px(c, 21 + sway, 14, GOLD); px(c, 27 + sway, 14, GOLD); // 影に光る目
  // 両手の剪定ばさみ
  rect(c, 12 + sway, 22, 4, 8, GREEN_D);
  line(c, 34 + sway, 24, 40 + sway, 32, METAL_D);
  line(c, 34 + sway, 32, 40 + sway, 24, METAL_D);
  px(c, 37 + sway, 28, K);
  return c;
}
function monsterSighMoss(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 苔むした土台（ため息をつくたび少し沈む）
  rect(c, 12, 38 + bob, 24, 6, GREEN_D);
  rect(c, 10, 34 + bob, 28, 4, GREEN);
  rect(c, 14, 30 + bob, 20, 4, GREEN);
  rect(c, 12, 28 + bob, 24, 2, [120, 190, 116]);
  // ため息の気配（小さな丸い泡）
  px(c, 8, 26 + bob, CYAN); px(c, 36, 24 + bob, CYAN); px(c, 38, 27 + bob, CYAN);
  // 眠そうな目とため息の口
  rect(c, 18, 32 + bob, 3, 1, K); rect(c, 27, 32 + bob, 3, 1, K);
  rect(c, 21, 36 + bob, 6, 1, K);
  return c;
}
function monsterRollingRock(f) {
  const c = canvas(48, 48);
  const roll = f === 1 ? 2 : 0;
  // 転がる勢いの線
  rect(c, 6, 30, 5, 2, GRAY_D); rect(c, 4, 36, 7, 2, GRAY_D);
  // 岩玉（転がっても形が保たれる丸い岩）
  rect(c, 14 + roll, 20, 20, 4, GOLEM);
  rect(c, 12 + roll, 24, 24, 12, GOLEM);
  rect(c, 14 + roll, 36, 20, 4, GOLEM_D);
  px(c, 19 + roll, 27, GOLEM_D); px(c, 27 + roll, 32, GOLEM_D);
  // 目（転がりながらもこちらを見ている）
  px(c, 21 + roll, 28, GOLD); px(c, 27 + roll, 28, GOLD);
  rect(c, 22 + roll, 33, 4, 1, K);
  return c;
}
function monsterDarkMushroom(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 茎（暗闇でも白く浮かぶ）
  rect(c, 19, 28 + bob, 10, 16, MUSH_STEM);
  rect(c, 17, 44 + bob, 4, 2, MUSH_STEM); rect(c, 27, 44 + bob, 4, 2, MUSH_STEM);
  // 暗い傘（斑点だけ光る）
  rect(c, 15, 18 + bob, 18, 4, [64, 52, 84]);
  rect(c, 12, 22 + bob, 24, 4, [64, 52, 84]);
  rect(c, 10, 26 + bob, 28, 3, [44, 36, 60]);
  px(c, 16, 20 + bob, CYAN); px(c, 30, 20 + bob, CYAN); px(c, 23, 23 + bob, CYAN);
  // 暗闇で光る目
  px(c, 21, 33 + bob, CYAN); px(c, 26, 33 + bob, CYAN);
  rect(c, 22, 38 + bob, 4, 1, K);
  return c;
}
function monsterWhisperVine(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 2 : 0;
  // 垂れ下がるツタ
  rect(c, 14 + sway, 8, 3, 30, GREEN_D); rect(c, 28 - sway, 10, 3, 28, GREEN);
  rect(c, 18, 16, 12, 3, GREEN); rect(c, 20, 26, 8, 3, GREEN_D);
  // 葉とささやきの気配
  rect(c, 10 + sway, 14, 6, 4, GREEN); rect(c, 30 - sway, 22, 6, 4, GREEN);
  px(c, 8 + sway, 30, CYAN); px(c, 36 - sway, 28, CYAN);
  // 細い目
  rect(c, 19, 20, 3, 1, K); rect(c, 26, 20, 3, 1, K);
  return c;
}
function monsterCliffGoat(f) {
  const c = canvas(48, 48);
  const step = f === 1 ? 2 : 0;
  // 崖の足場
  rect(c, 8, 40, 32, 4, GRAY_D);
  // ヤギの体と角
  rect(c, 14, 26 + step, 20, 10, GOLEM); rect(c, 30, 22 + step, 8, 8, GOLEM);
  rect(c, 30, 18 + step, 3, 4, GOLD); rect(c, 35, 18 + step, 3, 4, GOLD);
  px(c, 33, 25 + step, K); px(c, 36, 25 + step, K);
  rect(c, 16, 36 + step, 3, 4, K); rect(c, 28, 36 + step, 3, 4, K);
  return c;
}
function monsterShadowRat(f) {
  const c = canvas(48, 48);
  const dart = f === 1 ? 3 : 0;
  // 影の尾と体
  rect(c, 6 + dart, 32, 10, 2, [44, 36, 60]);
  rect(c, 14 + dart, 26, 20, 10, [44, 36, 60]); rect(c, 30 + dart, 22, 8, 8, [44, 36, 60]);
  // 耳と光る目
  rect(c, 31 + dart, 18, 3, 4, [64, 52, 84]); rect(c, 35 + dart, 18, 3, 4, [64, 52, 84]);
  px(c, 32 + dart, 26, CYAN); px(c, 36 + dart, 26, CYAN);
  return c;
}
function monsterRustyMessenger(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 脚と錆びた外套
  rect(c, 18 + sway, 38, 5, 8, RUST_D); rect(c, 25 + sway, 38, 5, 8, RUST_D);
  rect(c, 15 + sway, 30, 18, 10, RUST);
  rect(c, 15 + sway, 30, 18, 2, RUST_L);
  // 胴と肩当て
  rect(c, 16 + sway, 20, 16, 10, RUST);
  rect(c, 16 + sway, 20, 16, 2, RUST_L);
  // 兜と目のスリット
  rect(c, 17 + sway, 8, 14, 11, RUST);
  rect(c, 17 + sway, 8, 14, 2, RUST_L);
  rect(c, 19 + sway, 13, 10, 2, K);
  px(c, 21 + sway, 14, GOLD); px(c, 27 + sway, 14, GOLD);
  // 手にした封筒（届け先不明の伝令）
  rect(c, 34 + sway, 24, 8, 6, WHITE);
  rect(c, 34 + sway, 24, 8, 1, METAL_D);
  line(c, 34 + sway, 24, 38 + sway, 28, METAL_D); line(c, 42 + sway, 24, 38 + sway, 28, METAL_D);
  // 小さな鐘（伝令の合図）
  rect(c, 10 + sway, 22, 4, 4, GOLD); px(c, 12 + sway, 26, K);
  return c;
}
function monsterCrackedFlagstone(f) {
  const c = canvas(48, 48);
  const shift = f === 1 ? 1 : 0;
  // 石畳の板（地面に伏せた低い姿）
  rect(c, 8, 34, 32, 8, GRAY);
  rect(c, 8, 34, 32, 2, GRAY_D);
  rect(c, 6, 40, 36, 3, GRAY_D);
  // ひび割れ
  line(c, 14 + shift, 36, 20 + shift, 40, K); line(c, 20 + shift, 40, 24 + shift, 37, K);
  line(c, 28 - shift, 36, 32 - shift, 41, K);
  // 苔と目（割れ目からこちらを見ている）
  rect(c, 10, 34, 5, 2, GREEN_D); rect(c, 33, 34, 5, 2, GREEN_D);
  px(c, 19 + shift, 38, GOLD); px(c, 28 - shift, 38, GOLD);
  rect(c, 22, 40, 4, 1, K);
  return c;
}
function monsterQuietStatue(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 台座
  rect(c, 12, 42, 24, 4, GRAY_D);
  rect(c, 14, 39, 20, 3, GRAY);
  // 石像の体（苔むした石）
  rect(c, 16 + sway, 22, 16, 17, GRAY);
  rect(c, 16 + sway, 22, 16, 2, GRAY_D);
  rect(c, 12 + sway, 24, 4, 10, GRAY_D); rect(c, 32 + sway, 24, 4, 10, GRAY_D);
  px(c, 17 + sway, 23, GREEN_D); px(c, 30 + sway, 23, GREEN_D);
  // 頭と小さな冠
  rect(c, 18 + sway, 10, 12, 12, GRAY);
  rect(c, 18 + sway, 10, 12, 2, GRAY_D);
  rect(c, 21 + sway, 6, 6, 4, GOLD);
  px(c, 23 + sway, 7, K); px(c, 25 + sway, 7, K);
  // 静かに閉じた目
  rect(c, 20 + sway, 16, 3, 1, K); rect(c, 25 + sway, 16, 3, 1, K);
  return c;
}
function monsterSleepyMushroom(f) {
  const c = canvas(48, 48);
  const nod = f === 1 ? 2 : 0;
  // 茎と寝ぼけた傘
  rect(c, 20, 30, 8, 12, [226, 220, 205]);
  rect(c, 12, 16 + nod, 24, 14, [196, 84, 84]);
  px(c, 17, 20 + nod, [255, 220, 220]); px(c, 26, 18 + nod, [255, 220, 220]); px(c, 30, 22 + nod, [255, 220, 220]);
  // 閉じた目と「Z」の気配
  rect(c, 18, 32, 3, 1, K); rect(c, 27, 32, 3, 1, K);
  px(c, 36, 14, K); px(c, 38, 12, K); px(c, 40, 10, K);
  return c;
}
function monsterLeftBackpack(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りのリュック
  rect(c, 14 + sway, 16, 20, 24, [150, 100, 60]);
  rect(c, 14 + sway, 16, 20, 4, [120, 78, 44]);
  rect(c, 18 + sway, 26, 12, 8, [180, 130, 80]);
  rect(c, 12 + sway, 20, 3, 12, K); rect(c, 33 + sway, 20, 3, 12, K);
  // こちらを見る目
  px(c, 20 + sway, 22, K); px(c, 27 + sway, 22, K);
  rect(c, 14 + sway, 40, 20, 2, GRAY_D);
  return c;
}
function monsterForgottenHelmet(f) {
  const c = canvas(48, 48);
  const tilt = f === 1 ? 1 : 0;
  // 忘れられたヘルメット
  rect(c, 12 + tilt, 16, 24, 16, GRAY);
  rect(c, 12 + tilt, 16, 24, 3, GRAY_D);
  rect(c, 8 + tilt, 30, 32, 3, GRAY_D);
  // バイザーの光
  rect(c, 18 + tilt, 24, 12, 2, CYAN);
  px(c, 20 + tilt, 20, GOLD); px(c, 27 + tilt, 20, GOLD);
  rect(c, 20 + tilt, 36, 8, 4, GRAY_D);
  return c;
}
function monsterOldNoticeBoard(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 古い掲示板（木枠と貼り紙）
  rect(c, 12 + sway, 14, 24, 26, [150, 100, 60]);
  rect(c, 12 + sway, 14, 24, 3, [120, 78, 44]);
  rect(c, 15 + sway, 18, 8, 10, WHITE);
  rect(c, 24 + sway, 18, 8, 10, WHITE);
  rect(c, 15 + sway, 28, 8, 10, [226, 220, 205]);
  px(c, 19 + sway, 18, GOLD); px(c, 28 + sway, 18, GOLD);
  px(c, 19 + sway, 28, GOLD); px(c, 28 + sway, 28, GOLD);
  // こちらを見る目（貼り紙の隙間から）
  px(c, 22 + sway, 23, K); px(c, 26 + sway, 23, K);
  rect(c, 14 + sway, 40, 20, 3, [120, 78, 44]);
  return c;
}
function monsterSealedGateDoor(f) {
  const c = canvas(48, 48);
  const shift = f === 1 ? 1 : 0;
  // 閉ざされた門扉（鉄の扉と閂）
  rect(c, 10 + shift, 6, 28, 38, GRAY_D);
  rect(c, 10 + shift, 6, 28, 3, GRAY);
  rect(c, 22 + shift, 6, 4, 38, METAL_D);
  rect(c, 10 + shift, 20, 28, 4, METAL);
  rect(c, 12 + shift, 20, 4, 4, GOLD);
  // 鍵穴からのぞく目
  px(c, 19 + shift, 14, GOLD); px(c, 27 + shift, 14, GOLD);
  px(c, 23 + shift, 30, K); px(c, 25 + shift, 30, K);
  rect(c, 12 + shift, 44, 24, 2, GRAY);
  return c;
}
function monsterMoonlitGardener(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 月夜の庭師（夜色の長い外套）
  rect(c, 18 + sway, 38, 5, 8, [28, 30, 48]); rect(c, 25 + sway, 38, 5, 8, [28, 30, 48]);
  for (let y = 20; y <= 46; y++) {
    const w = 7 + Math.round((y - 20) * 0.28);
    rect(c, 24 - w + sway, y, w * 2, 1, y > 40 ? [28, 30, 48] : [44, 48, 74]);
  }
  // 月光の帽子と影の顔
  rect(c, 14 + sway, 8, 20, 3, [28, 30, 48]);
  rect(c, 17 + sway, 5, 14, 3, [28, 30, 48]);
  rect(c, 18 + sway, 11, 12, 8, [52, 58, 50]);
  px(c, 21 + sway, 14, CYAN); px(c, 27 + sway, 14, CYAN);
  // 三日月と剪定ばさみ
  px(c, 36 + sway, 10, GOLD); px(c, 38 + sway, 11, GOLD); px(c, 39 + sway, 13, GOLD);
  line(c, 34 + sway, 24, 40 + sway, 32, METAL_D);
  line(c, 34 + sway, 32, 40 + sway, 24, METAL_D);
  px(c, 37 + sway, 28, K);
  return c;
}
function monsterLostUmbrella(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 迷子の傘（閉じた傘を逆さに立てた姿）
  rect(c, 22 + sway, 30, 4, 14, [150, 100, 60]);
  rect(c, 14 + sway, 12, 20, 16, [196, 84, 84]);
  rect(c, 14 + sway, 12, 20, 3, [150, 60, 60]);
  rect(c, 24 + sway, 12, 2, 16, [226, 220, 205]);
  px(c, 19 + sway, 20, K); px(c, 27 + sway, 20, K);
  rect(c, 20 + sway, 28, 8, 2, [150, 100, 60]);
  px(c, 38, 10, CYAN); px(c, 40, 8, CYAN);
  return c;
}
function monsterLeftWaterBottle(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りの水筒（金属ボトル）
  rect(c, 18 + sway, 8, 12, 6, METAL_D);
  rect(c, 16 + sway, 14, 16, 26, CYAN);
  rect(c, 16 + sway, 14, 16, 3, METAL);
  rect(c, 20 + sway, 40, 8, 2, GRAY_D);
  px(c, 20 + sway, 22, K); px(c, 27 + sway, 22, K);
  rect(c, 14 + sway, 20, 3, 12, K); rect(c, 31 + sway, 20, 3, 12, K);
  return c;
}
function monsterForgottenFlashlight(f) {
  const c = canvas(48, 48);
  const tilt = f === 1 ? 1 : 0;
  // 忘れられた懐中電灯（横向きに置かれた姿）
  rect(c, 10 + tilt, 20, 26, 10, GRAY_D);
  rect(c, 10 + tilt, 20, 26, 2, GRAY);
  rect(c, 36 + tilt, 18, 4, 14, GOLD);
  px(c, 40 + tilt, 22, WHITE); px(c, 40 + tilt, 26, WHITE);
  px(c, 18 + tilt, 23, K); px(c, 26 + tilt, 23, K);
  rect(c, 12 + tilt, 32, 20, 2, GRAY);
  return c;
}
function monsterLostBoot(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 迷子の長靴（片方だけの長靴）
  rect(c, 16 + sway, 10, 12, 22, WOOD);
  rect(c, 16 + sway, 10, 12, 3, WOOD_D);
  rect(c, 16 + sway, 28, 22, 8, WOOD);
  rect(c, 16 + sway, 34, 22, 3, WOOD_D);
  rect(c, 34 + sway, 28, 4, 8, WOOD_D);
  px(c, 20 + sway, 18, K); px(c, 25 + sway, 18, K);
  rect(c, 14 + sway, 40, 26, 2, GREEN_D);
  return c;
}
function monsterLeftLunchbox(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りの弁当箱（蓋のずれた弁当箱）
  rect(c, 10 + sway, 14, 28, 6, [196, 84, 84]);
  rect(c, 10 + sway, 20, 28, 16, [226, 220, 205]);
  rect(c, 10 + sway, 20, 28, 3, RED);
  rect(c, 16 + sway, 24, 6, 6, [244, 179, 61]);
  rect(c, 26 + sway, 24, 6, 6, GREEN);
  px(c, 18 + sway, 27, K); px(c, 29 + sway, 27, K);
  rect(c, 12 + sway, 36, 24, 3, [196, 84, 84]);
  return c;
}
function monsterForgottenScarf(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 忘れられたマフラー（垂れ下がったマフラー）
  rect(c, 14 + sway, 8, 20, 10, RED);
  rect(c, 14 + sway, 8, 20, 3, [150, 60, 60]);
  rect(c, 16 + sway, 18, 7, 22, RED);
  rect(c, 25 + sway, 18, 7, 18, RED);
  for (const y of [24, 30, 36]) rect(c, 16 + sway, y, 7, 2, [150, 60, 60]);
  for (const y of [24, 30]) rect(c, 25 + sway, y, 7, 2, [150, 60, 60]);
  px(c, 19 + sway, 12, K); px(c, 27 + sway, 12, K);
  rect(c, 16 + sway, 40, 7, 3, [150, 60, 60]);
  return c;
}
function monsterLeftHat(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りの帽子（つばの広い帽子）
  rect(c, 10 + sway, 26, 28, 6, [168, 124, 74]);
  rect(c, 10 + sway, 26, 28, 2, WOOD_D);
  rect(c, 16 + sway, 12, 16, 14, [196, 158, 104]);
  rect(c, 16 + sway, 12, 16, 3, [168, 124, 74]);
  rect(c, 16 + sway, 22, 16, 4, BLUE);
  px(c, 21 + sway, 18, K); px(c, 27 + sway, 18, K);
  rect(c, 14 + sway, 40, 20, 2, GREEN_D);
  return c;
}
function monsterForgottenRaincoat(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 忘れられた雨具（フード付きのレインコート）
  rect(c, 16 + sway, 8, 16, 10, [244, 179, 61]);
  rect(c, 16 + sway, 8, 16, 3, [206, 150, 40]);
  rect(c, 20 + sway, 11, 8, 5, WHITE);
  rect(c, 14 + sway, 18, 20, 22, [244, 179, 61]);
  rect(c, 14 + sway, 18, 20, 3, [206, 150, 40]);
  rect(c, 14 + sway, 36, 20, 4, [206, 150, 40]);
  px(c, 20 + sway, 26, K); px(c, 27 + sway, 26, K);
  rect(c, 12 + sway, 22, 3, 12, [206, 150, 40]); rect(c, 33 + sway, 22, 3, 12, [206, 150, 40]);
  px(c, 38, 10, CYAN); px(c, 40, 8, CYAN);
  return c;
}
function monsterForgottenMap(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 忘れられた地図（折りたたまれた古い地図）
  rect(c, 10 + sway, 10, 28, 28, PAPER);
  rect(c, 10 + sway, 10, 28, 2, [222, 214, 190]);
  rect(c, 10 + sway, 36, 28, 2, [222, 214, 190]);
  line(c, 12 + sway, 22, 34 + sway, 30, BLUE);
  line(c, 34 + sway, 30, 20 + sway, 34, BLUE);
  px(c, 30 + sway, 14, RED); px(c, 31 + sway, 15, RED); px(c, 32 + sway, 16, RED);
  px(c, 32 + sway, 14, RED); px(c, 31 + sway, 15, RED); px(c, 30 + sway, 16, RED);
  px(c, 16 + sway, 28, K); px(c, 24 + sway, 18, K);
  rect(c, 14 + sway, 40, 20, 2, WOOD_D);
  return c;
}
function monsterLeftHandkerchief(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りのハンカチ（ほつれた白いハンカチ）
  rect(c, 12 + sway, 14, 24, 24, WHITE);
  rect(c, 12 + sway, 14, 24, 2, [120, 160, 220]);
  rect(c, 12 + sway, 36, 24, 2, [120, 160, 220]);
  rect(c, 12 + sway, 14, 2, 24, [120, 160, 220]);
  rect(c, 34 + sway, 14, 2, 24, [120, 160, 220]);
  px(c, 20 + sway, 22, K); px(c, 28 + sway, 22, K);
  rect(c, 21 + sway, 26, 6, 1, [120, 160, 220]);
  // ほつれた糸
  px(c, 38 + sway, 30, [120, 160, 220]); px(c, 39 + sway, 32, [120, 160, 220]); px(c, 37 + sway, 34, [120, 160, 220]);
  rect(c, 14 + sway, 40, 20, 2, GREEN_D);
  return c;
}
function monsterLeftNotebook(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りの手帳（表紙と栞ひも）
  rect(c, 12 + sway, 8, 24, 32, [90, 110, 160]);
  rect(c, 12 + sway, 8, 24, 3, [70, 88, 130]);
  rect(c, 16 + sway, 12, 16, 24, PAPER);
  rect(c, 18 + sway, 16, 12, 1, GRAY_D); rect(c, 18 + sway, 20, 12, 1, GRAY_D); rect(c, 18 + sway, 24, 12, 1, GRAY_D); rect(c, 18 + sway, 28, 8, 1, GRAY_D);
  rect(c, 30 + sway, 36, 3, 6, RED);
  px(c, 20 + sway, 14, K); px(c, 28 + sway, 14, K);
  rect(c, 14 + sway, 42, 20, 2, WOOD_D);
  return c;
}
function monsterForgottenMatches(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 忘れられたマッチ箱（マッチ棒つき）
  rect(c, 12 + sway, 20, 24, 16, [168, 124, 74]);
  rect(c, 12 + sway, 20, 24, 3, WOOD_D);
  rect(c, 12 + sway, 26, 24, 4, [90, 90, 90]);
  px(c, 18 + sway, 28, WHITE); px(c, 24 + sway, 28, WHITE); px(c, 30 + sway, 28, WHITE);
  // 飛び出したマッチ棒
  rect(c, 30 + sway, 8, 3, 12, [222, 200, 160]);
  px(c, 31 + sway, 6, RED); px(c, 30 + sway, 7, RED); px(c, 32 + sway, 7, RED);
  px(c, 20 + sway, 16, K); px(c, 28 + sway, 16, K);
  rect(c, 14 + sway, 40, 20, 2, WOOD_D);
  return c;
}
function monsterLeftGloves(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き去りの手袋（片方だけ立っている手袋のペア）
  rect(c, 11 + sway, 12, 11, 22, [96, 160, 140]);
  rect(c, 11 + sway, 12, 11, 3, [70, 128, 112]);
  rect(c, 22 + sway, 10, 4, 6, [96, 160, 140]);
  rect(c, 27 + sway, 16, 11, 20, [120, 178, 158]);
  rect(c, 27 + sway, 16, 11, 3, [90, 148, 128]);
  px(c, 16 + sway, 20, K); px(c, 32 + sway, 24, K);
  rect(c, 14 + sway, 40, 20, 2, GREEN_D);
  return c;
}
function monsterForgottenTowel(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 忘れられたタオル（物干し竿に掛かったままのタオル）
  rect(c, 8 + sway, 10, 32, 3, WOOD_D);
  rect(c, 13 + sway, 13, 22, 26, [178, 205, 220]);
  rect(c, 13 + sway, 13, 22, 3, [150, 185, 205]);
  rect(c, 13 + sway, 32, 22, 3, [150, 185, 205]);
  rect(c, 19 + sway, 13, 3, 26, [220, 225, 230]);
  px(c, 21 + sway, 22, K); px(c, 28 + sway, 22, K);
  rect(c, 14 + sway, 41, 20, 2, GREEN_D);
  return c;
}
function monsterForgottenLantern(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 忘れられたランタン（芯の燃え尽きたランタン）
  rect(c, 22 + sway, 8, 4, 5, [90, 90, 90]);
  rect(c, 14 + sway, 13, 20, 4, [90, 90, 90]);
  rect(c, 14 + sway, 17, 3, 20, [90, 90, 90]);
  rect(c, 31 + sway, 17, 3, 20, [90, 90, 90]);
  rect(c, 17 + sway, 17, 14, 20, [244, 230, 190]);
  rect(c, 22 + sway, 24, 4, 8, [70, 60, 50]);
  px(c, 23 + sway, 22, [120, 110, 100]); px(c, 24 + sway, 21, [120, 110, 100]);
  px(c, 21 + sway, 26, K); px(c, 27 + sway, 26, K);
  rect(c, 14 + sway, 37, 20, 4, [90, 90, 90]);
  rect(c, 14 + sway, 41, 20, 2, WOOD_D);
  return c;
}
function monsterPastSelfShadow(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 過去の自分の影（フードの影、目だけが淡く光る）
  rect(c, 16 + sway, 6, 16, 12, [40, 40, 56]);
  rect(c, 14 + sway, 16, 20, 24, [52, 52, 70]);
  rect(c, 14 + sway, 16, 20, 3, [40, 40, 56]);
  px(c, 20 + sway, 12, [200, 220, 255]); px(c, 21 + sway, 12, [200, 220, 255]);
  px(c, 26 + sway, 12, [200, 220, 255]); px(c, 27 + sway, 12, [200, 220, 255]);
  rect(c, 12 + sway, 22, 3, 12, [40, 40, 56]); rect(c, 33 + sway, 22, 3, 12, [40, 40, 56]);
  rect(c, 14 + sway, 40, 20, 2, [90, 90, 110]);
  return c;
}
function monsterSamsaraBlossom(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 輪廻の花（四季の花びらを一度に咲かせる花）
  rect(c, 22 + sway, 24, 4, 18, GREEN_D);
  rect(c, 14 + sway, 38, 20, 2, GREEN_D);
  // 花びら：桜色・緑・紅葉・雪白
  rect(c, 20 + sway, 8, 8, 8, [244, 170, 200]);
  rect(c, 12 + sway, 14, 8, 8, [140, 200, 120]);
  rect(c, 28 + sway, 14, 8, 8, [230, 130, 60]);
  rect(c, 20 + sway, 20, 8, 8, WHITE);
  px(c, 23 + sway, 15, GOLD); px(c, 24 + sway, 15, GOLD); px(c, 23 + sway, 16, GOLD); px(c, 24 + sway, 16, GOLD);
  px(c, 16 + sway, 30, K); px(c, 32 + sway, 30, K);
  return c;
}
function monsterLostPicnicBasket(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 置き忘れのピクニックかご（編みかごとチェックの布）
  rect(c, 12 + sway, 22, 24, 18, [196, 158, 104]);
  rect(c, 12 + sway, 22, 24, 3, WOOD_D);
  for (const y of [29, 35]) rect(c, 12 + sway, y, 24, 2, WOOD_D);
  for (const x of [18, 24, 30]) rect(c, x + sway, 25, 2, 15, WOOD_D);
  // 蓋とチェック柄の布
  rect(c, 10 + sway, 16, 28, 6, WHITE);
  for (const x of [14, 22, 30]) rect(c, x + sway, 16, 3, 6, RED);
  rect(c, 10 + sway, 20, 28, 2, RED);
  // 蓋の隙間からのぞく目
  px(c, 20 + sway, 27, K); px(c, 27 + sway, 27, K);
  rect(c, 14 + sway, 40, 20, 2, WOOD_D);
  return c;
}
function monsterMossTurtle(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 苔ガメ（苔むした甲羅）
  for (let y = 22; y <= 36; y++) {
    const w = 6 + Math.round(Math.sin((y - 22) / 14 * Math.PI) * 10);
    rect(c, 24 - w, y + bob, w * 2, 1, GREEN_D);
  }
  rect(c, 14, 24 + bob, 20, 3, GREEN);
  px(c, 18, 26 + bob, GREEN); px(c, 27, 25 + bob, [120, 190, 110]); px(c, 22, 29 + bob, GREEN);
  px(c, 30, 30 + bob, [120, 190, 110]); px(c, 16, 31 + bob, GREEN);
  // 頭と足
  rect(c, 36, 30 + bob, 6, 5, [120, 170, 100]);
  px(c, 39, 32 + bob, K);
  rect(c, 14, 37 + bob, 5, 3, GREEN_D); rect(c, 29, 37 + bob, 5, 3, GREEN_D);
  rect(c, 10, 38 + bob, 28, 2, [90, 120, 70]);
  return c;
}
function monsterTiltedSignpost(f) {
  const c = canvas(48, 48);
  // 傾いた道しるべ（柱と矢印板）
  for (let y = 12; y <= 42; y++) rect(c, 22 + Math.round((y - 12) * 0.08), y, 4, 1, WOOD_D);
  rect(c, 10, 14, 18, 6, WOOD);
  rect(c, 24, 22, 16, 6, WOOD);
  px(c, 27, 17, WOOD_D); px(c, 12, 25, WOOD_D);
  // 板の裏からのぞく目
  px(c, 16, 17, K); px(c, 32, 25, K);
  rect(c, 16, 42, 16, 3, GRAY_D);
  px(c, 34, 10, GOLD);
  return c;
}
function monsterSummitCrow(f) {
  const c = canvas(48, 48);
  const tilt = f === 1 ? 1 : 0;
  // 山頂のカラス（岩の上に止まる黒い鳥）
  rect(c, 12, 40, 24, 5, GRAY_D);
  rect(c, 16, 36, 16, 4, GRAY);
  // 体と尾
  rect(c, 16 + tilt, 20, 18, 12, [40, 40, 48]);
  rect(c, 14 + tilt, 28, 6, 8, [30, 30, 38]);
  rect(c, 18 + tilt, 22, 12, 3, [58, 58, 70]);
  // 頭とくちばし
  rect(c, 30 + tilt, 14, 9, 9, [40, 40, 48]);
  px(c, 39 + tilt, 17, GOLD); px(c, 40 + tilt, 18, GOLD); px(c, 39 + tilt, 19, [200, 150, 50]);
  px(c, 33 + tilt, 17, WHITE);
  // 脚
  rect(c, 22 + tilt, 32, 2, 4, GOLD); rect(c, 28 + tilt, 32, 2, 4, GOLD);
  return c;
}
function monsterCrystalCrab(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 水晶ガニ（甲羅に水晶が生えたカニ）
  rect(c, 12 + sway, 24, 24, 12, [168, 84, 90]);
  rect(c, 12 + sway, 24, 24, 3, [140, 62, 70]);
  // 背中の水晶
  px(c, 18 + sway, 16, CYAN); px(c, 19 + sway, 18, CYAN); px(c, 19 + sway, 20, WATER);
  px(c, 24 + sway, 13, CYAN); px(c, 25 + sway, 15, CYAN); px(c, 25 + sway, 18, WATER); px(c, 25 + sway, 21, WATER);
  px(c, 30 + sway, 17, CYAN); px(c, 31 + sway, 19, WATER);
  // 目玉
  rect(c, 19 + sway, 20, 2, 4, [140, 62, 70]); rect(c, 27 + sway, 20, 2, 4, [140, 62, 70]);
  px(c, 19 + sway, 19, K); px(c, 28 + sway, 19, K);
  // ハサミと脚
  rect(c, 4 + sway, 20, 7, 6, [168, 84, 90]); px(c, 5 + sway, 18, [140, 62, 70]);
  rect(c, 37 + sway, 20, 7, 6, [168, 84, 90]); px(c, 41 + sway, 18, [140, 62, 70]);
  for (const x of [13, 20, 27, 33]) { line(c, x + sway, 36, x - 2 + sway, 42, [140, 62, 70]); }
  return c;
}
function monsterIcicleSnail(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // つららのカタツムリ（氷の殻）
  rect(c, 10 + sway, 34, 26, 6, [150, 190, 200]);
  rect(c, 10 + sway, 34, 26, 2, [120, 165, 180]);
  // 渦巻きの殻
  for (let y = 16; y <= 33; y++) for (let x = 12; x <= 31; x++) {
    const d = Math.hypot(x - 21.5, y - 24.5);
    if (d <= 9) px(c, x + sway, y, d > 6.5 ? WATER : [170, 215, 240]);
  }
  px(c, 21 + sway, 24, WHITE); px(c, 20 + sway, 23, WHITE);
  // 垂れるつらら
  for (const x of [15, 21, 27]) { px(c, x + sway, 34, WATER); px(c, x + sway, 36, WATER_D); }
  // 頭と触角
  rect(c, 34 + sway, 28, 6, 7, [150, 190, 200]);
  line(c, 37 + sway, 28, 35 + sway, 22, [120, 165, 180]); line(c, 39 + sway, 28, 40 + sway, 22, [120, 165, 180]);
  px(c, 35 + sway, 21, CYAN); px(c, 40 + sway, 21, CYAN);
  px(c, 37 + sway, 30, K);
  return c;
}
function monsterRustedBell(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 錆びた呼び鈴（大きなベル）
  rect(c, 21 + sway, 6, 6, 4, RUST_D);
  for (let y = 10; y <= 34; y++) {
    const w = 5 + Math.round((y - 10) * 0.42);
    rect(c, 24 - w + sway, y, w * 2, 1, y % 6 === 0 ? RUST_D : RUST);
  }
  rect(c, 12 + sway, 34, 24, 4, RUST_D);
  px(c, 18 + sway, 18, RUST_L); px(c, 28 + sway, 24, RUST_L); px(c, 22 + sway, 28, RUST_D);
  // ひびと目
  line(c, 27 + sway, 12, 25 + sway, 20, RUST_D); line(c, 25 + sway, 20, 27 + sway, 26, RUST_D);
  px(c, 20 + sway, 22, K); px(c, 26 + sway, 22, K);
  // 舌（音を鳴らす玉）
  px(c, 23 + sway, 40, GOLD); px(c, 24 + sway, 41, GOLD);
  rect(c, 16 + sway, 43, 16, 2, GRAY_D);
  return c;
}
function monsterFountainKoi(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? 1 : 0;
  // 噴水のコイ（乾いた噴水で泳ぐつもりの鯉）
  rect(c, 10, 36 + bob, 28, 5, [232, 120, 60]);
  rect(c, 10, 36 + bob, 28, 2, [200, 96, 44]);
  // 尾びれと背びれ
  rect(c, 4, 32 + bob, 7, 6, [232, 120, 60]); rect(c, 4, 40 + bob, 7, 4, [200, 96, 44]);
  rect(c, 22, 31 + bob, 8, 5, [200, 96, 44]);
  // 斑点と目
  px(c, 16, 38 + bob, WHITE); px(c, 24, 39 + bob, WHITE); px(c, 30, 37 + bob, [250, 220, 170]);
  px(c, 35, 38 + bob, K);
  // ひげと水しぶき（水はない）
  line(c, 38, 41 + bob, 42, 43 + bob, [200, 96, 44]);
  px(c, 14, 28 + bob, WATER); px(c, 20, 25 + bob, WATER); px(c, 27, 28 + bob, CYAN);
  rect(c, 8, 45, 32, 2, GRAY);
  return c;
}
function monsterThroneCat(f) {
  const c = canvas(48, 48);
  const tail = f === 1 ? 2 : 0;
  // 玉座の猫（中庭の玉座に座る猫）
  rect(c, 10, 12, 28, 30, GOLD);
  rect(c, 13, 15, 22, 24, [150, 48, 52]);
  px(c, 24, 8, GOLD); px(c, 22, 6, GOLD); px(c, 26, 6, GOLD);
  rect(c, 14, 40, 20, 4, [120, 90, 40]);
  // 猫の体
  rect(c, 18, 26, 12, 12, [200, 170, 130]);
  rect(c, 16, 36, 5, 4, [200, 170, 130]); rect(c, 27, 36, 5, 4, [200, 170, 130]);
  // 頭と耳
  rect(c, 18, 16, 12, 10, [200, 170, 130]);
  px(c, 18, 13, [200, 170, 130]); px(c, 19, 14, [240, 200, 170]);
  px(c, 29, 13, [200, 170, 130]); px(c, 28, 14, [240, 200, 170]);
  // 閉じ目と鼻（戦う気はない）
  rect(c, 20, 21, 3, 1, K); rect(c, 25, 21, 3, 1, K);
  px(c, 23, 24, [180, 110, 110]);
  // しっぽ（フレームで揺れる）
  rect(c, 30, 34 - tail, 6, 3, [200, 170, 130]);
  px(c, 35, 33 - tail, [170, 140, 105]);
  return c;
}
const THRONE_D = [184, 128, 30], DEMON_R = [168, 52, 48], DEMON_D = [120, 36, 34];
const ECHO_PALE = [190, 205, 238], ECHO_SOFT = [150, 168, 212], WISP_GOLD = [244, 196, 96];
function monsterPastLifeEcho(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? -2 : 0;
  // 前世の残響（薄く光る、自分の影のような幽霊）
  rect(c, 16, 10 + bob, 16, 22, ECHO_PALE);
  rect(c, 18, 8 + bob, 12, 4, ECHO_PALE);
  rect(c, 14, 26 + bob, 4, 8, ECHO_SOFT); rect(c, 30, 26 + bob, 4, 8, ECHO_SOFT);
  // 目（少しだけ寂しげ）
  rect(c, 20, 16 + bob, 3, 4, K); rect(c, 25, 16 + bob, 3, 4, K);
  px(c, 21, 17 + bob, WHITE); px(c, 26, 17 + bob, WHITE);
  // 残響のきらめき（フレームで揺れる）
  px(c, 12, 14 + bob, ECHO_PALE); px(c, 36, 20 + bob, ECHO_PALE);
  if (f === 1) { px(c, 24, 12 + bob, WHITE); px(c, 14, 22 + bob, ECHO_PALE); }
  return c;
}
function monsterNewLifeWisp(f) {
  const c = canvas(48, 48);
  const bob = f === 1 ? -2 : 0;
  // 新しい命の灯（小さな提灯のような灯）
  rect(c, 20, 20 + bob, 8, 12, WISP_GOLD);
  rect(c, 18, 18 + bob, 12, 3, [184, 128, 30]);
  rect(c, 18, 32 + bob, 12, 2, [184, 128, 30]);
  rect(c, 22, 10 + bob, 4, 8, WISP_GOLD);
  px(c, 23, 8 + bob, WISP_GOLD); px(c, 24, 7 + bob, [250, 230, 160]);
  // 灯の芯
  rect(c, 22, 24 + bob, 4, 4, WHITE);
  // きらめき（フレームで揺れる）
  px(c, 14, 18 + bob, WISP_GOLD); px(c, 34, 24 + bob, WISP_GOLD);
  if (f === 1) { px(c, 12, 26 + bob, [250, 230, 160]); px(c, 36, 16 + bob, [250, 230, 160]); }
  return c;
}
function monsterThroneMimic(f) {
  const c = canvas(48, 48);
  const jaw = f === 1 ? 2 : 0;
  // 玉座ミミック（座る場所そのものが敵）
  rect(c, 10, 6, 28, 26, GOLD); // 背もたれ
  rect(c, 10, 6, 28, 3, THRONE_D);
  px(c, 14, 9, GOLD); px(c, 34, 9, GOLD);
  rect(c, 8, 30, 32, 10, GOLD); // 座面
  rect(c, 8, 30, 32, 2, THRONE_D);
  rect(c, 10, 40, 6, 6, THRONE_D); rect(c, 32, 40, 6, 6, THRONE_D); // 脚
  // 目（背もたれに二つ）
  rect(c, 17, 14, 4, 4, WHITE); rect(c, 27, 14, 4, 4, WHITE);
  px(c, 19, 16, K); px(c, 29, 16, K);
  // 歯の並んだ口（座面の前面）
  rect(c, 14, 32 + jaw, 20, 3, K);
  for (let x = 14; x < 34; x += 4) { px(c, x, 32 + jaw, WHITE); px(c, x + 2, 34 + jaw, WHITE); }
  if (f === 1) { px(c, 24, 12, RED); px(c, 23, 20, RED); } // 怒りのきらめき
  return c;
}
function monsterRetiredHero(f) {
  const c = canvas(48, 48);
  const lean = f === 1 ? 1 : 0;
  // 引退した先輩勇者（剣を地面に刺して、もう戦わない）
  rect(c, 22 + lean, 10, 4, 26, METAL_D); // 刺さった剣の柄
  rect(c, 20 + lean, 8, 8, 3, WOOD_D);
  rect(c, 23 + lean, 36, 2, 10, METAL); // 刃（地面に）
  // 体（ゆるいチュニック）
  rect(c, 16 + lean, 18, 16, 22, TUNIC_D);
  rect(c, 16 + lean, 18, 16, 2, TUNIC);
  rect(c, 14 + lean, 40, 6, 4, [150, 120, 100]); rect(c, 28 + lean, 40, 6, 4, [150, 120, 100]); // スリッパ
  // 頭（白髪まじり）と閉じ目
  rect(c, 18 + lean, 8, 12, 10, SKIN);
  rect(c, 18 + lean, 8, 12, 3, GRAY);
  px(c, 20 + lean, 7, GRAY); px(c, 28 + lean, 7, GRAY);
  rect(c, 20 + lean, 13, 3, 1, K); rect(c, 25 + lean, 13, 3, 1, K);
  px(c, 23 + lean, 16, [180, 110, 110]);
  return c;
}
function monsterSilentDemonKing(f) {
  const c = canvas(48, 48);
  const sway = f === 1 ? 1 : 0;
  // 静かな魔王（声より先に圧が来る）
  for (let y = 18; y <= 46; y++) {
    const w = 9 + Math.round((y - 18) * 0.3);
    rect(c, 24 - w + sway, y, w * 2, 1, y > 42 ? DEMON_D : DEMON_R);
  }
  rect(c, 23 + sway, 20, 2, 24, DEMON_D);
  px(c, 24 + sway, 30, GOLD); px(c, 24 + sway, 38, GOLD);
  rect(c, 13 + sway, 19, 6, 4, DEMON_D); rect(c, 29 + sway, 19, 6, 4, DEMON_D);
  // 角
  rect(c, 16 + sway, 4, 3, 6, [240, 220, 180]); rect(c, 29 + sway, 4, 3, 6, [240, 220, 180]);
  // 顔（影の中に白い顔）
  rect(c, 18 + sway, 9, 12, 10, KING_F);
  rect(c, 18 + sway, 9, 12, 2, [198, 192, 176]);
  px(c, 21 + sway, 14, RED); px(c, 27 + sway, 14, RED); // 赤い目
  rect(c, 22 + sway, 17, 4, 1, [178, 172, 158]);
  // 王冠
  rect(c, 17 + sway, 5, 14, 3, GOLD);
  for (const x of [17, 21, 25, 29]) rect(c, x + sway, 2, 2, 3, GOLD);
  px(c, 23 + sway, 6, BLUE);
  if (f === 1) { px(c, 18 + sway, 3, WHITE); px(c, 30 + sway, 4, WHITE); }
  return c;
}
function monsterHouseholdDemonKing(f) {
  const c = canvas(48, 48);
  const wave = f === 1 ? 2 : 0;
  // 家計の魔王（請求書を掲げた最終形態）
  rect(c, 16, 14, 16, 26, DEMON_R);
  rect(c, 16, 14, 16, 2, DEMON_D);
  rect(c, 14, 40, 7, 5, DEMON_D); rect(c, 27, 40, 7, 5, DEMON_D);
  // 角と目
  rect(c, 15, 3, 4, 6, GOLD); rect(c, 29, 3, 4, 6, GOLD);
  rect(c, 17, 8, 14, 8, [226, 190, 170]);
  rect(c, 20, 11, 3, 2, K); rect(c, 25, 11, 3, 2, K);
  px(c, 24, 14, [120, 40, 40]);
  // 掲げた請求書（紙が揺れる）
  rect(c, 34, 8 + wave, 10, 14, PAPER);
  rect(c, 36, 12 + wave, 6, 1, GRAY_D); rect(c, 36, 15 + wave, 6, 1, GRAY_D); rect(c, 36, 18 + wave, 4, 1, GRAY_D);
  px(c, 39, 20 + wave, RED);
  rect(c, 32, 16, 4, 4, DEMON_R); // 腕
  // 腰の金袋
  rect(c, 21, 30, 6, 6, GOLD);
  px(c, 24, 29, THRONE_D);
  return c;
}
const MONSTER_BUILDERS = {
  slime: monsterSlime, goblin: monsterGoblin, wolf: monsterWolf, rust_armor: monsterRustArmor,
  bill_wraith: monsterBillWraith, tax_mimic: monsterTaxMimic, quiet_king: monsterQuietKing,
  forest_mushroom: monsterForestMushroom, pebble_golem: monsterPebbleGolem, cave_bat: monsterCaveBat,
  gatekeeper_armor: monsterGatekeeperArmor, dry_fountain_spirit: monsterDryFountainSpirit,
  silent_gardener: monsterSilentGardener,
  sigh_moss: monsterSighMoss, rolling_rock: monsterRollingRock, dark_mushroom: monsterDarkMushroom,
  whisper_vine: monsterWhisperVine, cliff_goat: monsterCliffGoat, shadow_rat: monsterShadowRat,
  rusty_messenger: monsterRustyMessenger, cracked_flagstone: monsterCrackedFlagstone, quiet_statue: monsterQuietStatue,
  sleepy_mushroom: monsterSleepyMushroom, left_backpack: monsterLeftBackpack, forgotten_helmet: monsterForgottenHelmet,
  old_notice_board: monsterOldNoticeBoard, sealed_gate_door: monsterSealedGateDoor, moonlit_gardener: monsterMoonlitGardener,
  lost_umbrella: monsterLostUmbrella, left_water_bottle: monsterLeftWaterBottle, forgotten_flashlight: monsterForgottenFlashlight,
  lost_picnic_basket: monsterLostPicnicBasket, moss_turtle: monsterMossTurtle, tilted_signpost: monsterTiltedSignpost,
  summit_crow: monsterSummitCrow, crystal_crab: monsterCrystalCrab, icicle_snail: monsterIcicleSnail,
  rusted_bell: monsterRustedBell, fountain_koi: monsterFountainKoi, throne_cat: monsterThroneCat,
  throne_mimic: monsterThroneMimic, retired_hero: monsterRetiredHero,
  silent_demon_king: monsterSilentDemonKing, household_demon_king: monsterHouseholdDemonKing,
  past_life_echo: monsterPastLifeEcho, new_life_wisp: monsterNewLifeWisp,
  lost_boot: monsterLostBoot, left_lunchbox: monsterLeftLunchbox, forgotten_scarf: monsterForgottenScarf,
  left_hat: monsterLeftHat, forgotten_raincoat: monsterForgottenRaincoat, forgotten_map: monsterForgottenMap,
  left_handkerchief: monsterLeftHandkerchief, left_notebook: monsterLeftNotebook, forgotten_matches: monsterForgottenMatches,
  left_gloves: monsterLeftGloves, forgotten_towel: monsterForgottenTowel, forgotten_lantern: monsterForgottenLantern,
  past_self_shadow: monsterPastSelfShadow, samsara_blossom: monsterSamsaraBlossom,
};
for (const [id, build] of Object.entries(MONSTER_BUILDERS)) {
  saveSheet([build(0), build(1)], `monster-${id}.png`);
}

// ---------- far layer: 遠景シルエット (256x48, 横タイル可能) ----------
{
  const c = canvas(256, 48);
  const COL = [88, 114, 96], COLD = [64, 90, 74], TREE = [50, 76, 60];
  const prof = (x) => Math.round(31 - 7 * Math.sin(2 * Math.PI * x / 256) - 4 * Math.sin(4 * Math.PI * x / 256 + 1.3) - 2 * Math.sin(6 * Math.PI * x / 256 + 0.5));
  for (let x = 0; x < 256; x++) {
    const y0 = prof(x);
    for (let y = y0; y < 48; y++) px(c, x, y, y === y0 ? COLD : COL);
  }
  const tree = (x) => {
    const y = prof(x);
    rect(c, x, y - 6, 1, 6, TREE);
    rect(c, x - 3, y - 11, 7, 6, TREE);
    rect(c, x - 2, y - 13, 5, 3, TREE);
  };
  [20, 58, 122, 170, 214, 246].forEach(tree);
  const cy = prof(88); // 遠くの小さな城
  rect(c, 82, cy - 15, 12, 15, COLD);
  rect(c, 84, cy - 20, 3, 5, COLD); rect(c, 89, cy - 20, 3, 5, COLD);
  px(c, 87, cy - 10, GOLD);
  saveSingle(c, 'far-hills.png');
}
// ---------- sun / moon (16x16) ----------
{
  const c = canvas(16, 16);
  for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d <= 3.8) px(c, x, y, d <= 2.6 ? [255, 214, 90] : [244, 179, 61]);
  }
  for (const [x, y] of [[7, 0], [7, 14], [0, 7], [14, 7], [2, 2], [12, 2], [2, 12], [12, 12]]) px(c, x, y, [244, 179, 61]);
  saveSingle(c, 'sun.png');
}
{
  const c = canvas(16, 16);
  for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    const cut = Math.hypot(x - 11, y - 5.5);
    if (d <= 5.6 && cut > 4.4) px(c, x, y, [240, 236, 208]);
  }
  px(c, 4, 4, [255, 248, 214]);
  saveSingle(c, 'moon.png');
}
// ---------- item icons (32x32) ----------
const RED2 = [206, 62, 52], TEAL = [96, 190, 170], BROWN = [122, 84, 47];
function iconCanvas(draw) { const c = canvas(32, 32); draw(c); return c; }
const ITEM_ICON_BUILDERS = {
  resolve_to_fish: (c) => { rect(c, 8, 4, 2, 24, WOOD_D); rect(c, 10, 5, 14, 9, RED2); px(c, 21, 8, WHITE); px(c, 20, 9, WHITE); px(c, 21, 10, WHITE); },
  permission_to_rest: (c) => { rect(c, 5, 14, 22, 10, WHITE); rect(c, 5, 14, 22, 2, [222, 226, 232]); rect(c, 7, 24, 18, 2, [200, 206, 216]); const z = (x, y, s) => { rect(c, x, y, s, 1, BLUE); rect(c, x, y + s - 1, s, 1, BLUE); for (let i = 0; i < s; i++) px(c, x + s - 1 - i, y + i, BLUE); }; z(20, 2, 6); z(14, 6, 4); },
  small_fish: (c) => { rect(c, 6, 13, 14, 7, BLUE); rect(c, 8, 11, 10, 2, BLUE); rect(c, 8, 20, 10, 2, WATER_D); px(c, 20, 12, BLUE); px(c, 20, 21, BLUE); rect(c, 21, 13, 5, 7, WATER_D); px(c, 9, 15, K); px(c, 10, 18, WATER_D); px(c, 14, 18, WATER_D); },
  quiet_scale: (c) => { px(c, 15, 4, CYAN); px(c, 16, 4, CYAN); rect(c, 13, 6, 6, 4, CYAN); rect(c, 11, 10, 10, 6, TEAL); rect(c, 12, 16, 8, 5, TEAL); rect(c, 14, 21, 4, 4, [62, 158, 138]); px(c, 14, 9, WHITE); px(c, 13, 12, WHITE); },
  field_note: (c) => { rect(c, 8, 4, 16, 24, PAPER); rect(c, 8, 4, 16, 2, [222, 214, 190]); rect(c, 11, 10, 10, 1, GRAY_D); rect(c, 11, 14, 10, 1, GRAY_D); rect(c, 11, 18, 7, 1, GRAY_D); px(c, 20, 23, GREEN_D); px(c, 21, 22, GREEN); px(c, 22, 23, GREEN_D); },
  twig: (c) => { line(c, 6, 26, 24, 8, WOOD); line(c, 7, 27, 25, 9, WOOD_D); line(c, 16, 16, 21, 12, WOOD); line(c, 13, 20, 12, 13, WOOD); px(c, 22, 11, GREEN); px(c, 23, 10, GREEN_D); },
  hinoki_stick: (c) => { line(c, 9, 24, 22, 9, WOOD); line(c, 10, 25, 23, 10, WOOD_D); rect(c, 7, 24, 4, 4, WOOD_D); px(c, 20, 10, [196, 158, 104]); px(c, 17, 13, [196, 158, 104]); },
  old_pickaxe: (c) => { line(c, 14, 14, 22, 26, WOOD); rect(c, 21, 25, 3, 4, WOOD_D); px(c, 6, 8, METAL); px(c, 8, 6, METAL); px(c, 11, 5, METAL); px(c, 14, 5, METAL); px(c, 17, 6, METAL); px(c, 20, 8, METAL); px(c, 6, 9, METAL_D); px(c, 20, 9, METAL_D); },
  pebble_ore: (c) => { rect(c, 8, 14, 16, 12, GRAY); rect(c, 11, 10, 10, 5, GRAY); rect(c, 8, 14, 16, 2, GRAY_D); px(c, 13, 18, CYAN); px(c, 19, 21, GOLD); px(c, 15, 23, [196, 198, 204]); },
  daikon_seed: (c) => { rect(c, 9, 6, 14, 20, [196, 158, 104]); rect(c, 9, 6, 14, 3, WOOD_D); px(c, 13, 14, SOIL); px(c, 18, 16, SOIL); px(c, 15, 20, SOIL); px(c, 19, 12, SOIL); px(c, 12, 18, SOIL); },
  daikon: (c) => { rect(c, 13, 10, 6, 12, WHITE); rect(c, 14, 22, 4, 4, WHITE); px(c, 15, 26, WHITE); px(c, 16, 27, [222, 226, 232]); rect(c, 13, 10, 6, 2, [222, 226, 232]); px(c, 12, 6, GREEN_D); px(c, 15, 4, GREEN); px(c, 19, 5, GREEN_D); px(c, 16, 7, GREEN); rect(c, 11, 8, 10, 2, GREEN_D); },
  sleepy_herb: (c) => { line(c, 16, 28, 16, 16, GREEN_D); px(c, 10, 10, GREEN); px(c, 9, 13, GREEN); px(c, 11, 15, GREEN_D); px(c, 21, 8, GREEN); px(c, 22, 11, GREEN_D); px(c, 20, 14, GREEN); px(c, 13, 18, GREEN); px(c, 19, 19, GREEN_D); rect(c, 10, 27, 12, 3, SOIL); },
  safe_potato: (c) => { rect(c, 9, 11, 14, 13, [178, 132, 84]); rect(c, 11, 9, 10, 3, [178, 132, 84]); rect(c, 11, 23, 10, 3, [156, 112, 66]); px(c, 13, 15, BROWN); px(c, 18, 18, BROWN); px(c, 15, 21, BROWN); px(c, 20, 13, [196, 158, 104]); },
  moonbean: (c) => { rect(c, 10, 12, 12, 7, GREEN); rect(c, 11, 19, 10, 4, GREEN_D); rect(c, 12, 10, 8, 2, GREEN); px(c, 14, 15, [196, 232, 170]); px(c, 18, 16, [196, 232, 170]); px(c, 24, 5, GOLD); px(c, 25, 4, GOLD); px(c, 25, 6, [255, 226, 140]); },
  rent_rice: (c) => { rect(c, 7, 16, 18, 11, [168, 124, 74]); rect(c, 7, 16, 18, 2, WOOD_D); rect(c, 9, 10, 14, 6, WHITE); px(c, 11, 9, WHITE); px(c, 16, 8, WHITE); px(c, 20, 9, WHITE); px(c, 13, 12, [238, 232, 214]); px(c, 18, 12, [238, 232, 214]); px(c, 15, 21, GOLD); },
  slime_jelly: (c) => { rect(c, 10, 14, 12, 10, TEAL); rect(c, 12, 11, 8, 3, [168, 232, 210]); rect(c, 10, 22, 12, 2, [62, 158, 138]); px(c, 14, 17, K); px(c, 19, 17, K); px(c, 13, 14, WHITE); },
  rusty_armor_plate: (c) => { rect(c, 8, 7, 16, 18, RUST); rect(c, 8, 7, 16, 2, RUST_L); rect(c, 8, 23, 16, 2, RUST_D); px(c, 11, 11, RUST_D); px(c, 19, 16, RUST_D); px(c, 14, 20, RUST_L); px(c, 11, 8, K); px(c, 21, 8, K); px(c, 11, 23, K); px(c, 21, 23, K); },
  overdue_notice: (c) => { rect(c, 8, 4, 16, 24, PAPER); rect(c, 11, 9, 10, 1, GRAY_D); rect(c, 11, 13, 10, 1, GRAY_D); rect(c, 11, 17, 7, 1, GRAY_D); for (let a = 0; a < 8; a++) { const sx = 19 + Math.round(3 * Math.cos(a * Math.PI / 4)), sy = 22 + Math.round(3 * Math.sin(a * Math.PI / 4)); px(c, sx, sy, RED2); } px(c, 19, 20, RED2); px(c, 19, 22, RED2); px(c, 19, 24, RED2); },
  castle_key_fragment: (c) => { rect(c, 7, 12, 8, 8, GOLD); rect(c, 9, 14, 4, 4, [250, 246, 232]); rect(c, 15, 15, 6, 3, GOLD); rect(c, 19, 18, 3, 4, GOLD); px(c, 22, 14, GOLD); px(c, 23, 13, [250, 246, 232]); px(c, 24, 15, GOLD); px(c, 16, 13, [184, 128, 30]); },
  quiet_crown: (c) => { rect(c, 7, 17, 18, 6, GOLD); for (const x of [7, 12, 17, 22]) rect(c, x, 12, 3, 5, GOLD); px(c, 13, 19, BLUE); px(c, 19, 19, RED2); rect(c, 7, 23, 18, 2, [184, 128, 30]); },
  throne_key: (c) => { rect(c, 7, 12, 8, 8, GOLD); rect(c, 9, 14, 4, 4, [250, 246, 232]); rect(c, 15, 15, 7, 3, GOLD); rect(c, 20, 18, 3, 4, GOLD); px(c, 22, 14, GOLD); px(c, 23, 13, [250, 246, 232]); px(c, 24, 15, GOLD); px(c, 16, 13, [184, 128, 30]); px(c, 10, 18, BLUE); },
  rebirth_guidebook: (c) => { rect(c, 8, 8, 16, 18, [120, 90, 180]); rect(c, 8, 8, 16, 3, [150, 120, 210]); rect(c, 10, 13, 12, 2, GOLD); rect(c, 10, 17, 12, 1, [250, 246, 232]); rect(c, 10, 20, 8, 1, [250, 246, 232]); px(c, 16, 22, GOLD); },
  second_life_note: (c) => { rect(c, 9, 7, 14, 19, [250, 246, 232]); rect(c, 9, 7, 14, 2, [200, 190, 170]); rect(c, 12, 12, 8, 1, [120, 120, 130]); rect(c, 12, 16, 10, 1, [120, 120, 130]); rect(c, 12, 20, 6, 1, [120, 120, 130]); px(c, 20, 22, BLUE); },
  // 無限の塔（2026-11-08）: 階段のかけら。石段が3段、金の欠片が上にのる。
  tower_shard: (c) => { rect(c, 8, 20, 16, 6, GRAY); rect(c, 11, 14, 13, 6, GRAY_D); rect(c, 14, 8, 10, 6, GOLD); px(c, 16, 6, [250, 246, 232]); px(c, 20, 5, [250, 246, 232]); px(c, 11, 21, [196, 198, 204]); px(c, 18, 15, [196, 198, 204]); },
  retiree_tea: (c) => { rect(c, 9, 14, 13, 9, [210, 160, 110]); rect(c, 9, 14, 13, 2, [150, 110, 70]); rect(c, 22, 16, 3, 5, [210, 160, 110]); px(c, 13, 10, [200, 200, 200]); px(c, 16, 8, [200, 200, 200]); px(c, 19, 10, [200, 200, 200]); },
  life_stamp: (c) => { rect(c, 13, 5, 6, 8, WOOD_D); rect(c, 10, 13, 12, 4, WOOD); rect(c, 8, 17, 16, 9, RED2); rect(c, 10, 19, 12, 5, [226, 96, 84]); px(c, 14, 20, WHITE); px(c, 17, 20, WHITE); px(c, 15, 22, WHITE); },
  employee_badge: (c) => { rect(c, 10, 8, 12, 17, WHITE); rect(c, 10, 8, 12, 3, BLUE); rect(c, 14, 4, 4, 4, METAL_D); px(c, 13, 14, GRAY); px(c, 18, 14, GRAY); px(c, 13, 13, GRAY); px(c, 18, 13, GRAY); rect(c, 12, 19, 8, 1, GRAY_D); rect(c, 12, 22, 8, 1, GRAY_D); },
  mute_button: (c) => { rect(c, 8, 8, 16, 16, [84, 92, 104]); rect(c, 10, 10, 12, 12, [120, 130, 144]); px(c, 13, 14, WHITE); px(c, 19, 14, WHITE); px(c, 14, 15, WHITE); px(c, 18, 15, WHITE); line(c, 12, 20, 20, 12, RED2); },
  red_flag: (c) => { rect(c, 9, 4, 2, 24, WOOD_D); rect(c, 11, 5, 13, 8, RED2); px(c, 20, 7, [226, 96, 84]); px(c, 17, 9, [226, 96, 84]); },
  merchant_license: (c) => { rect(c, 6, 8, 20, 16, PAPER); rect(c, 6, 8, 20, 2, GOLD); rect(c, 9, 14, 9, 1, GRAY_D); rect(c, 9, 17, 9, 1, GRAY_D); for (let a = 0; a < 8; a++) { const sx = 21 + Math.round(2.6 * Math.cos(a * Math.PI / 4)), sy = 18 + Math.round(2.6 * Math.sin(a * Math.PI / 4)); px(c, sx, sy, RED2); } px(c, 21, 18, RED2); },
  bike_upgrade: (c) => { for (let a = 0; a < 12; a++) { const sx = 16 + Math.round(7 * Math.cos(a * Math.PI / 6)), sy = 16 + Math.round(7 * Math.sin(a * Math.PI / 6)); px(c, sx, sy, METAL_D); } rect(c, 13, 13, 6, 6, METAL); px(c, 15, 15, K); px(c, 16, 15, K); for (const [x, y] of [[16, 6], [16, 24], [6, 16], [24, 16]]) px(c, x, y, METAL_D); },
  delivery_app: (c) => { rect(c, 10, 4, 12, 24, HOOD); rect(c, 12, 7, 8, 16, [210, 232, 244]); px(c, 16, 11, RED2); rect(c, 15, 10, 2, 2, RED2); px(c, 16, 13, RED2); rect(c, 14, 19, 4, 1, GRAY_D); px(c, 15, 25, METAL_D); px(c, 16, 25, METAL_D); },
  webcam: (c) => { rect(c, 8, 11, 16, 11, HOOD); for (let y = 13; y <= 20; y++) for (let x = 12; x <= 19; x++) { const d = Math.hypot(x - 15.5, y - 16.5); if (d <= 3.6) px(c, x, y, d <= 1.6 ? [70, 144, 196] : [36, 40, 48]); } px(c, 14, 14, WHITE); rect(c, 13, 24, 6, 2, HOOD); },
  mic: (c) => { rect(c, 13, 4, 6, 12, METAL_D); rect(c, 13, 4, 6, 2, METAL); rect(c, 10, 10, 12, 8, [84, 92, 104]); rect(c, 15, 18, 2, 6, K); rect(c, 10, 24, 12, 2, K); px(c, 15, 7, RED2); },
  goblin_ear: (c) => { px(c, 8, 10, GOB_D); rect(c, 9, 11, 6, 3, GOB_SKIN); rect(c, 12, 14, 9, 4, GOB_SKIN); rect(c, 14, 18, 8, 3, GOB_SKIN); px(c, 20, 21, GOB_D); px(c, 15, 15, GOB_D); },
  wolf_fang: (c) => { rect(c, 11, 5, 10, 5, [238, 232, 214]); rect(c, 12, 10, 8, 5, WHITE); rect(c, 13, 15, 6, 5, WHITE); rect(c, 14, 20, 4, 4, WHITE); px(c, 15, 24, WHITE); px(c, 16, 25, [222, 216, 200]); px(c, 13, 8, [206, 198, 178]); },
  rusty_hook: (c) => { line(c, 14, 5, 14, 20, METAL_D); px(c, 14, 21, RUST); px(c, 14, 22, RUST); px(c, 15, 23, RUST); px(c, 16, 24, RUST); px(c, 17, 24, RUST); px(c, 18, 23, RUST); px(c, 18, 20, RUST); px(c, 18, 19, METAL); px(c, 12, 5, METAL_D); px(c, 16, 5, METAL_D); },
  acorn: (c) => { rect(c, 11, 7, 10, 5, BROWN); rect(c, 12, 12, 8, 11, [196, 158, 104]); px(c, 14, 23, [196, 158, 104]); px(c, 15, 24, [196, 158, 104]); px(c, 15, 5, WOOD_D); px(c, 16, 4, GREEN_D); px(c, 13, 9, WOOD_D); px(c, 17, 9, WOOD_D); px(c, 15, 15, [178, 132, 84]); },
  glimmer_pebble: (c) => { rect(c, 9, 14, 14, 11, GRAY); rect(c, 11, 11, 10, 4, GRAY); rect(c, 9, 14, 14, 2, GRAY_D); px(c, 14, 17, CYAN); px(c, 18, 19, WHITE); px(c, 15, 21, CYAN); px(c, 21, 13, WHITE); px(c, 12, 12, WHITE); },
  mossy_coin: (c) => { rect(c, 9, 9, 14, 14, GOLD); rect(c, 11, 11, 10, 10, [250, 220, 110]); px(c, 14, 14, [184, 128, 30]); px(c, 17, 17, [184, 128, 30]); px(c, 10, 10, GREEN); px(c, 21, 10, GREEN_D); px(c, 9, 20, GREEN_D); px(c, 20, 21, GREEN); px(c, 13, 9, GREEN); },
  echo_stone: (c) => { rect(c, 8, 12, 16, 12, GRAY); rect(c, 10, 10, 12, 3, GRAY); px(c, 12, 15, WHITE); px(c, 20, 15, WHITE); px(c, 12, 20, WHITE); px(c, 20, 20, WHITE); px(c, 16, 13, WATER); px(c, 16, 21, WATER); rect(c, 8, 12, 16, 2, GRAY_D); },
  cold_coffee: (c) => { rect(c, 10, 12, 12, 13, [210, 232, 244]); rect(c, 10, 12, 12, 2, [120, 80, 50]); rect(c, 22, 15, 4, 7, [210, 232, 244]); rect(c, 10, 25, 12, 2, [120, 80, 50]); px(c, 14, 16, WHITE); px(c, 17, 18, WHITE); px(c, 13, 8, GRAY); px(c, 16, 6, GRAY); },
  soggy_receipt: (c) => { rect(c, 9, 5, 14, 22, PAPER); rect(c, 9, 5, 14, 2, [222, 214, 190]); rect(c, 12, 11, 8, 1, GRAY_D); rect(c, 12, 15, 8, 1, GRAY_D); rect(c, 12, 19, 5, 1, GRAY_D); px(c, 18, 12, BLUE); px(c, 19, 16, BLUE); px(c, 16, 22, BLUE); },
  stray_sprout: (c) => { rect(c, 9, 24, 14, 4, SOIL); line(c, 16, 24, 16, 12, GREEN_D); px(c, 12, 10, GREEN); px(c, 13, 9, GREEN); px(c, 19, 11, GREEN); px(c, 20, 9, GREEN_D); px(c, 16, 8, GREEN); },
  tangled_cable: (c) => { line(c, 6, 8, 20, 20, K); line(c, 20, 8, 8, 22, K); line(c, 8, 22, 24, 12, K); px(c, 12, 14, METAL_D); px(c, 18, 16, METAL_D); px(c, 15, 19, METAL); },
  crumpled_coupon: (c) => { rect(c, 7, 9, 18, 14, PAPER); rect(c, 7, 9, 18, 2, GOLD); rect(c, 7, 21, 18, 2, GOLD); px(c, 10, 13, RED2); px(c, 14, 13, RED2); px(c, 18, 13, RED2); px(c, 12, 17, GRAY_D); px(c, 16, 17, GRAY_D); px(c, 20, 17, GRAY_D); },
  dusty_keycap: (c) => { rect(c, 9, 9, 14, 12, WHITE); rect(c, 9, 9, 14, 2, [222, 226, 232]); rect(c, 9, 19, 14, 2, GRAY_D); px(c, 13, 13, GRAY); px(c, 18, 14, GRAY); px(c, 15, 16, GRAY); px(c, 20, 11, GRAY); },
  folded_map: (c) => { rect(c, 7, 6, 18, 20, PAPER); rect(c, 7, 6, 18, 2, [222, 214, 190]); line(c, 7, 18, 25, 12, BLUE); px(c, 19, 10, RED2); px(c, 20, 9, RED2); px(c, 21, 10, RED2); px(c, 20, 11, RED2); px(c, 11, 20, GRAY_D); px(c, 15, 22, GRAY_D); },
  sunken_bottle_cap: (c) => { rect(c, 10, 10, 12, 12, METAL); rect(c, 12, 12, 8, 8, METAL_D); px(c, 14, 14, BLUE); px(c, 18, 14, BLUE); px(c, 14, 18, BLUE); px(c, 18, 18, BLUE); px(c, 16, 16, WHITE); },
  loose_blanket_thread: (c) => { rect(c, 7, 8, 18, 12, WHITE); rect(c, 7, 8, 18, 2, [222, 226, 232]); line(c, 10, 20, 22, 26, GRAY_D); px(c, 14, 22, GRAY_D); px(c, 18, 24, GRAY_D); },
  chipped_gear: (c) => { rect(c, 10, 10, 12, 12, METAL_D); rect(c, 13, 13, 6, 6, [250, 246, 232]); px(c, 14, 8, METAL); px(c, 18, 8, METAL); px(c, 8, 14, METAL); px(c, 8, 18, METAL); px(c, 22, 14, METAL); px(c, 22, 18, METAL); },
  wilted_clover: (c) => { px(c, 13, 10, GREEN); px(c, 18, 10, GREEN_D); px(c, 13, 15, GREEN_D); px(c, 18, 15, GREEN); line(c, 16, 18, 16, 26, GREEN_D); px(c, 12, 12, GREEN); px(c, 19, 12, GREEN); },
  peeled_shipping_label: (c) => { rect(c, 7, 9, 18, 14, PAPER); rect(c, 7, 9, 18, 2, [222, 214, 190]); rect(c, 10, 13, 9, 1, GRAY_D); rect(c, 10, 17, 9, 1, GRAY_D); px(c, 20, 14, RED2); px(c, 21, 19, RED2); },
  spare_thumbnail_sketch: (c) => { rect(c, 7, 7, 18, 14, PAPER); rect(c, 7, 7, 18, 2, GOLD); px(c, 13, 11, RED2); px(c, 18, 11, RED2); rect(c, 11, 15, 10, 1, GRAY_D); rect(c, 11, 18, 7, 1, GRAY_D); },
  bent_nail: (c) => { line(c, 14, 5, 14, 20, METAL_D); line(c, 14, 20, 19, 24, METAL_D); px(c, 19, 24, METAL); px(c, 11, 5, METAL); px(c, 17, 5, METAL); px(c, 13, 12, METAL); px(c, 16, 17, METAL); },
  dry_soil_clod: (c) => { rect(c, 9, 12, 14, 11, SOIL); rect(c, 11, 9, 10, 4, SOIL); rect(c, 9, 12, 14, 2, [104, 74, 46]); px(c, 13, 16, [160, 118, 76]); px(c, 18, 18, [160, 118, 76]); px(c, 15, 20, [104, 74, 46]); },
  rusty_screw: (c) => { rect(c, 13, 5, 6, 16, RUST); rect(c, 11, 5, 10, 4, RUST_D); rect(c, 13, 21, 6, 3, METAL_D); px(c, 15, 9, RUST_L); px(c, 17, 13, RUST_L); px(c, 14, 17, RUST_D); line(c, 13, 24, 19, 24, METAL); },
  wet_leaf: (c) => { rect(c, 9, 8, 14, 12, GREEN); rect(c, 11, 20, 10, 4, GREEN_D); line(c, 16, 24, 16, 27, GREEN_D); px(c, 12, 11, GREEN_D); px(c, 19, 10, GREEN_D); px(c, 10, 14, BLUE); px(c, 21, 16, BLUE); px(c, 14, 22, WATER); },
  scribbled_memo: (c) => { rect(c, 8, 5, 16, 22, PAPER); rect(c, 8, 5, 16, 2, [222, 214, 190]); line(c, 11, 11, 20, 13, GRAY_D); line(c, 20, 13, 12, 17, GRAY_D); line(c, 12, 17, 19, 19, GRAY_D); px(c, 21, 10, RED2); px(c, 22, 22, GRAY); },
  crushed_paper_bag: (c) => { rect(c, 9, 9, 14, 16, [196, 158, 104]); rect(c, 9, 9, 14, 2, WOOD_D); rect(c, 12, 13, 8, 2, [168, 124, 74]); rect(c, 11, 18, 10, 2, [168, 124, 74]); px(c, 15, 11, [168, 124, 74]); px(c, 18, 21, [168, 124, 74]); px(c, 11, 23, WOOD_D); },
  driftwood_piece: (c) => { line(c, 7, 22, 24, 10, WOOD); line(c, 7, 23, 24, 11, WOOD_D); line(c, 10, 20, 22, 11, [196, 158, 104]); px(c, 9, 21, WATER); px(c, 20, 12, WATER); px(c, 14, 17, [168, 124, 74]); px(c, 24, 10, WOOD_D); },
  slipped_slipper: (c) => { rect(c, 8, 20, 16, 4, WOOD_D); rect(c, 8, 16, 16, 4, [196, 158, 104]); rect(c, 11, 10, 10, 6, [168, 124, 74]); rect(c, 11, 10, 10, 2, [122, 84, 47]); px(c, 14, 12, [196, 158, 104]); px(c, 18, 13, [196, 158, 104]); px(c, 20, 22, WOOD_D); },
  peeled_bark: (c) => { rect(c, 9, 7, 14, 18, WOOD); rect(c, 9, 7, 3, 18, WOOD_D); rect(c, 20, 7, 3, 18, [196, 158, 104]); px(c, 13, 11, [168, 124, 74]); px(c, 17, 15, [168, 124, 74]); px(c, 14, 20, [122, 84, 47]); line(c, 11, 9, 21, 23, WOOD_D); },
  empty_seed_packet: (c) => { rect(c, 9, 8, 14, 18, PAPER); rect(c, 9, 8, 14, 3, [222, 214, 190]); rect(c, 9, 23, 14, 3, [222, 214, 190]); px(c, 13, 14, SOIL); px(c, 18, 16, SOIL); px(c, 15, 19, SOIL); px(c, 12, 18, GREEN_D); px(c, 19, 12, GREEN_D); },
  cracked_lantern: (c) => { rect(c, 12, 5, 8, 3, METAL_D); rect(c, 10, 8, 12, 16, GOLD); rect(c, 10, 8, 12, 2, METAL_D); rect(c, 10, 22, 12, 2, METAL_D); rect(c, 10, 8, 2, 16, METAL_D); rect(c, 20, 8, 2, 16, METAL_D); line(c, 13, 10, 17, 20, K); px(c, 15, 14, WHITE); px(c, 18, 12, [255, 236, 170]); },
  faded_sticky_note: (c) => { rect(c, 8, 8, 16, 16, [244, 224, 150]); rect(c, 8, 8, 16, 2, [230, 204, 110]); rect(c, 11, 13, 10, 1, GRAY_D); rect(c, 11, 17, 7, 1, GRAY_D); px(c, 19, 20, GRAY_D); px(c, 20, 9, RED2); },
  chipped_float: (c) => { rect(c, 13, 6, 6, 18, RED2); rect(c, 13, 6, 2, 18, [206, 62, 52]); rect(c, 15, 6, 2, 18, WHITE); px(c, 13, 12, WHITE); px(c, 18, 18, GRAY_D); line(c, 16, 24, 16, 27, GRAY_D); },
  torn_price_tag: (c) => { rect(c, 8, 10, 16, 12, PAPER); rect(c, 8, 10, 16, 2, [222, 214, 190]); line(c, 11, 14, 19, 19, GRAY_D); px(c, 20, 21, GRAY_D); px(c, 9, 21, RED2); rect(c, 21, 10, 3, 3, WHITE); },
  worn_mousepad: (c) => { rect(c, 6, 10, 20, 14, GRAY); rect(c, 6, 10, 20, 2, GRAY_D); rect(c, 10, 13, 12, 8, [170, 168, 162]); px(c, 14, 16, GRAY_D); px(c, 18, 19, GRAY_D); px(c, 12, 21, GRAY_D); },
  torn_delivery_slip: (c) => { rect(c, 9, 6, 14, 20, PAPER); rect(c, 9, 6, 14, 2, [222, 214, 190]); line(c, 12, 11, 20, 11, GRAY_D); line(c, 12, 15, 18, 15, GRAY_D); line(c, 12, 19, 16, 19, GRAY_D); px(c, 20, 24, WATER); px(c, 21, 23, WATER); },
  cracked_phone_stand: (c) => { rect(c, 8, 22, 16, 4, METAL_D); rect(c, 12, 8, 8, 14, METAL); rect(c, 14, 10, 4, 10, [84, 156, 214]); line(c, 14, 10, 16, 18, WHITE); line(c, 16, 18, 14, 14, WHITE); px(c, 17, 12, WHITE); },
  anonymous_letter: (c) => { rect(c, 8, 9, 16, 14, PAPER); rect(c, 8, 9, 16, 2, [222, 214, 190]); line(c, 8, 9, 16, 16, GRAY_D); line(c, 24, 9, 16, 16, GRAY_D); px(c, 16, 15, RED2); px(c, 12, 13, GRAY_D); },
  cracked_mug: (c) => { rect(c, 9, 10, 12, 14, WHITE); rect(c, 9, 10, 12, 2, [120, 80, 50]); rect(c, 21, 13, 4, 8, WHITE); line(c, 13, 12, 15, 18, GRAY_D); line(c, 15, 18, 13, 22, GRAY_D); px(c, 17, 15, GRAY_D); rect(c, 9, 24, 12, 2, [200, 206, 216]); },
  bent_hanger: (c) => { px(c, 15, 5, METAL_D); px(c, 16, 6, METAL_D); line(c, 16, 8, 7, 20, METAL_D); line(c, 16, 8, 25, 18, METAL_D); line(c, 7, 20, 24, 24, METAL_D); px(c, 24, 23, METAL); px(c, 11, 14, METAL); px(c, 20, 12, METAL); },
  dried_ink_pen: (c) => { line(c, 8, 24, 20, 12, BLUE); line(c, 9, 25, 21, 13, BLUE); rect(c, 20, 8, 5, 5, METAL_D); px(c, 7, 25, GRAY_D); px(c, 25, 6, GRAY); rect(c, 14, 16, 4, 3, GOLD); },
  faded_timetable: (c) => { rect(c, 8, 6, 16, 20, PAPER); rect(c, 8, 6, 16, 2, [222, 214, 190]); for (const y of [12, 17, 22]) rect(c, 10, y, 12, 1, [200, 196, 180]); for (const x of [13, 18]) rect(c, x, 10, 1, 14, [200, 196, 180]); px(c, 11, 9, RED2); },
  split_chopstick: (c) => { line(c, 10, 6, 13, 26, WOOD); line(c, 14, 6, 17, 26, WOOD); line(c, 20, 6, 22, 16, WOOD_D); line(c, 23, 18, 25, 26, WOOD_D); px(c, 21, 17, WOOD); px(c, 11, 10, WOOD_D); },
  dust_clump: (c) => { rect(c, 10, 16, 12, 9, GRAY); rect(c, 13, 12, 8, 5, GRAY); px(c, 12, 18, GRAY_D); px(c, 18, 20, GRAY_D); px(c, 15, 14, [196, 198, 204]); },
  loose_shoelace: (c) => { line(c, 8, 8, 22, 22, WHITE); line(c, 8, 10, 22, 24, [222, 226, 232]); px(c, 8, 8, GRAY_D); px(c, 22, 24, GRAY_D); px(c, 12, 14, RED2); px(c, 18, 18, RED2); },
  old_ticket: (c) => { rect(c, 7, 10, 18, 12, PAPER); rect(c, 7, 10, 18, 2, [222, 214, 190]); rect(c, 16, 10, 2, 12, [222, 214, 190]); px(c, 11, 14, RED2); px(c, 21, 14, GRAY_D); px(c, 13, 18, GRAY_D); px(c, 19, 18, GRAY_D); },
  chipped_bowl: (c) => { rect(c, 9, 12, 14, 10, [120, 156, 214]); rect(c, 9, 12, 14, 2, [84, 120, 180]); rect(c, 9, 22, 14, 2, [84, 120, 180]); px(c, 13, 14, WHITE); px(c, 19, 12, GRAY_D); px(c, 20, 15, WHITE); },
  wet_glove: (c) => { rect(c, 11, 6, 10, 14, BLUE); rect(c, 11, 6, 2, 14, [84, 156, 214]); rect(c, 21, 6, 2, 14, [84, 156, 214]); rect(c, 11, 20, 10, 6, [84, 156, 214]); px(c, 15, 10, WHITE); px(c, 18, 12, WATER); px(c, 13, 22, WATER); },
  frayed_rope: (c) => { line(c, 7, 10, 25, 20, BROWN); line(c, 7, 12, 25, 22, [154, 107, 63]); px(c, 12, 13, WOOD_D); px(c, 18, 16, WOOD_D); px(c, 22, 19, WOOD_D); px(c, 25, 20, GRAY_D); px(c, 7, 10, GRAY_D); },
  snapped_rubber_band: (c) => { line(c, 8, 14, 22, 14, RED2); line(c, 8, 18, 22, 18, RED2); px(c, 8, 14, [150, 60, 60]); px(c, 22, 18, [150, 60, 60]); px(c, 15, 14, WHITE); px(c, 15, 18, WHITE); },
  mossy_button: (c) => { rect(c, 10, 10, 12, 12, WHITE); rect(c, 10, 10, 12, 2, [222, 226, 232]); px(c, 14, 14, GRAY_D); px(c, 18, 14, GRAY_D); px(c, 14, 18, GRAY_D); px(c, 18, 18, GRAY_D); px(c, 12, 12, GREEN); px(c, 20, 20, GREEN_D); px(c, 19, 11, GREEN); },
  bent_compass: (c) => { for (let y = 6; y <= 25; y++) for (let x = 6; x <= 25; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 9.5 && d > 8) px(c, x, y, GOLD); else if (d <= 8) px(c, x, y, PAPER); } line(c, 16, 15, 21, 10, RED2); line(c, 15, 16, 10, 21, BLUE); px(c, 15, 15, K); px(c, 16, 15, K); px(c, 21, 10, [150, 60, 60]); },
  damp_torch: (c) => { rect(c, 13, 12, 6, 14, WOOD_D); rect(c, 13, 12, 6, 3, BROWN); rect(c, 11, 6, 10, 6, [244, 179, 61]); px(c, 14, 8, [255, 236, 170]); px(c, 17, 8, [255, 236, 170]); px(c, 13, 26, WATER); px(c, 17, 26, WATER); px(c, 15, 24, WATER_D); },
  lost_lure: (c) => { rect(c, 12, 10, 9, 6, RED2); rect(c, 12, 10, 9, 2, [226, 96, 84]); px(c, 18, 12, WHITE); px(c, 18, 13, K); line(c, 16, 10, 16, 4, GRAY_D); px(c, 14, 19, METAL_D); px(c, 15, 21, METAL_D); px(c, 14, 23, METAL_D); px(c, 18, 19, METAL_D); px(c, 17, 21, METAL_D); },
  chipped_chisel: (c) => { line(c, 12, 6, 18, 22, METAL); line(c, 13, 6, 19, 22, METAL_D); rect(c, 10, 4, 6, 4, WOOD_D); px(c, 18, 22, METAL); px(c, 19, 23, METAL_D); px(c, 11, 5, BROWN); px(c, 14, 10, GRAY_D); },
  bent_stapler: (c) => { rect(c, 7, 12, 18, 7, METAL_D); rect(c, 7, 12, 18, 2, METAL); rect(c, 7, 19, 18, 3, GRAY_D); line(c, 9, 12, 13, 8, METAL_D); line(c, 13, 8, 20, 12, METAL_D); px(c, 11, 14, GRAY); px(c, 20, 15, GRAY); px(c, 15, 10, METAL); },
  samsara_guidebook: (c) => { rect(c, 9, 5, 14, 22, [90, 110, 160]); rect(c, 9, 5, 14, 2, [70, 88, 130]); rect(c, 12, 8, 8, 16, PAPER); rect(c, 13, 11, 6, 1, GRAY_D); rect(c, 13, 14, 6, 1, GRAY_D); rect(c, 13, 17, 4, 1, GRAY_D); rect(c, 20, 24, 2, 4, RED); px(c, 14, 9, GOLD); px(c, 19, 9, GOLD); },
  samsara_petal: (c) => { for (const [x, y, col] of [[16, 8, [244, 170, 200]], [10, 14, [140, 200, 120]], [22, 14, [230, 130, 60]], [16, 20, WHITE]]) { rect(c, x - 3, y - 3, 6, 6, col); } px(c, 15, 15, GOLD); px(c, 16, 15, GOLD); px(c, 15, 16, GOLD); px(c, 16, 16, GOLD); px(c, 10, 24, [244, 170, 200]); px(c, 22, 26, [230, 130, 60]); },
  samsara_seed: (c) => { rect(c, 12, 12, 8, 10, [168, 124, 74]); rect(c, 12, 12, 8, 2, WOOD_D); px(c, 14, 16, WHITE); px(c, 17, 16, WHITE); rect(c, 15, 8, 2, 4, GREEN); rect(c, 13, 6, 4, 2, GREEN); px(c, 13, 22, GREEN_D); px(c, 18, 22, GREEN_D); },
  frayed_handkerchief: (c) => { rect(c, 8, 8, 16, 16, WHITE); rect(c, 8, 8, 16, 2, [120, 160, 220]); rect(c, 8, 22, 16, 2, [120, 160, 220]); px(c, 12, 14, K); px(c, 19, 14, K); px(c, 25, 26, [120, 160, 220]); px(c, 26, 27, [120, 160, 220]); px(c, 24, 27, [120, 160, 220]); },
  bent_bookmark: (c) => { rect(c, 11, 4, 10, 22, RED2); rect(c, 11, 4, 10, 2, [150, 60, 60]); rect(c, 14, 20, 4, 6, PAPER); px(c, 15, 10, WHITE); px(c, 16, 12, WHITE); line(c, 13, 26, 17, 22, [150, 60, 60]); },
  damp_candle: (c) => { rect(c, 13, 12, 6, 14, WHITE); rect(c, 13, 12, 6, 2, [222, 226, 232]); px(c, 15, 8, [255, 236, 170]); px(c, 16, 8, [255, 236, 170]); px(c, 13, 26, WATER); px(c, 17, 26, WATER); px(c, 15, 24, WATER_D); },
  lost_pass: (c) => { rect(c, 8, 9, 16, 12, [90, 110, 160]); rect(c, 8, 9, 16, 2, [70, 88, 130]); rect(c, 11, 13, 5, 5, PAPER); px(c, 12, 14, K); px(c, 14, 14, K); rect(c, 18, 13, 4, 1, GRAY_D); rect(c, 18, 16, 4, 1, GRAY_D); px(c, 20, 22, GOLD); },
  chipped_spoon: (c) => { rect(c, 14, 6, 4, 8, METAL); rect(c, 13, 5, 6, 3, METAL); rect(c, 15, 14, 2, 12, METAL_D); px(c, 14, 7, METAL_D); px(c, 16, 26, METAL); },
  bent_clip: (c) => { line(c, 10, 8, 20, 8, METAL); line(c, 20, 8, 20, 20, METAL_D); line(c, 20, 20, 12, 20, METAL); line(c, 12, 20, 12, 12, METAL_D); line(c, 12, 12, 17, 12, METAL); px(c, 22, 10, METAL); px(c, 22, 14, METAL_D); },
  single_glove: (c) => { rect(c, 12, 8, 8, 16, [168, 124, 74]); rect(c, 12, 8, 8, 2, WOOD_D); rect(c, 20, 12, 4, 8, [168, 124, 74]); px(c, 14, 24, WOOD_D); px(c, 16, 24, WOOD_D); px(c, 22, 22, [222, 226, 232]); },
  faded_towel: (c) => { rect(c, 8, 10, 16, 13, [178, 205, 220]); rect(c, 8, 10, 16, 2, [150, 185, 205]); rect(c, 8, 20, 16, 3, [150, 185, 205]); line(c, 12, 13, 20, 20, [220, 225, 230]); px(c, 12, 21, [150, 185, 205]); },
  burnt_wick: (c) => { rect(c, 14, 12, 4, 12, [70, 60, 50]); px(c, 15, 10, [120, 110, 100]); px(c, 16, 9, [120, 110, 100]); px(c, 15, 7, [150, 150, 150]); px(c, 16, 6, [150, 150, 150]); rect(c, 11, 24, 10, 2, [90, 90, 90]); },
  sunken_key: (c) => { rect(c, 10, 14, 8, 4, GOLD); px(c, 12, 15, K); px(c, 14, 15, K); line(c, 18, 15, 24, 15, METAL_D); px(c, 22, 17, METAL_D); px(c, 24, 17, METAL_D); px(c, 12, 20, WATER); px(c, 18, 22, WATER); px(c, 21, 24, WATER_D); },
  rusty_nail: (c) => { line(c, 11, 6, 19, 22, METAL); line(c, 12, 6, 20, 22, [150, 90, 60]); rect(c, 9, 4, 6, 4, [150, 90, 60]); px(c, 19, 22, METAL_D); px(c, 13, 12, [150, 90, 60]); },
  dried_ink: (c) => { rect(c, 12, 10, 8, 14, [40, 40, 60]); rect(c, 12, 10, 8, 2, [70, 70, 90]); rect(c, 14, 6, 4, 4, [70, 70, 90]); px(c, 14, 16, [90, 90, 120]); px(c, 17, 18, [90, 90, 120]); px(c, 15, 24, [40, 40, 60]); },
  // コンテンツ小バッチ（2026-11-09 15時台）：置き去りの日用品シリーズの続き。
  cracked_hand_mirror: (c) => { rect(c, 10, 5, 12, 12, [178, 205, 220]); rect(c, 10, 5, 12, 2, [150, 185, 205]); line(c, 12, 7, 20, 15, WHITE); line(c, 18, 6, 14, 16, [220, 230, 235]); rect(c, 14, 17, 4, 9, WOOD_D); px(c, 15, 26, WOOD_D); },
  clouded_hand_mirror: (c) => { rect(c, 10, 5, 12, 12, [150, 160, 165]); rect(c, 10, 5, 12, 2, [130, 140, 145]); px(c, 13, 9, [190, 200, 205]); px(c, 18, 13, [190, 200, 205]); rect(c, 14, 17, 4, 9, WOOD_D); px(c, 15, 26, WOOD_D); },
  cracked_compass: (c) => { rect(c, 9, 6, 14, 14, GOLD); rect(c, 11, 8, 10, 10, PAPER); line(c, 13, 16, 19, 10, RED2); line(c, 19, 10, 13, 16, RED2); px(c, 16, 13, K); line(c, 11, 9, 20, 17, [120, 120, 120]); px(c, 20, 20, GRAY_D); },
  rusty_compass_needle: (c) => { line(c, 10, 20, 22, 10, [150, 90, 60]); line(c, 11, 21, 21, 11, [120, 70, 45]); px(c, 16, 15, K); px(c, 15, 15, [200, 120, 80]); px(c, 17, 15, [200, 120, 80]); },
  melted_candle: (c) => { rect(c, 13, 12, 6, 10, WHITE); rect(c, 13, 12, 6, 2, [222, 226, 232]); rect(c, 11, 22, 10, 3, [240, 240, 240]); rect(c, 19, 20, 4, 2, [240, 240, 240]); px(c, 15, 8, [120, 110, 100]); px(c, 16, 9, [120, 110, 100]); },
  melted_candle_wick: (c) => { rect(c, 14, 10, 4, 14, [70, 60, 50]); px(c, 15, 8, [200, 120, 60]); px(c, 16, 7, [200, 120, 60]); px(c, 15, 24, [40, 40, 40]); rect(c, 12, 24, 8, 2, [240, 240, 240]); },
  // コンテンツ小バッチ（2026-11-10 05時台）：置き去りの日用品シリーズの続き。
  cracked_watering_can: (c) => { rect(c, 10, 12, 12, 10, [150, 160, 165]); rect(c, 10, 12, 12, 2, [130, 140, 145]); line(c, 10, 15, 4, 9, [150, 160, 165]); line(c, 4, 9, 6, 9, [130, 140, 145]); line(c, 12, 13, 19, 20, [100, 110, 115]); line(c, 22, 13, 22, 20, WOOD_D); px(c, 13, 10, [190, 200, 205]); },
  dented_watering_can: (c) => { rect(c, 10, 12, 12, 10, [130, 140, 145]); rect(c, 10, 12, 12, 2, [110, 120, 125]); px(c, 15, 16, [100, 110, 115]); px(c, 16, 17, [100, 110, 115]); line(c, 10, 15, 4, 9, [130, 140, 145]); line(c, 22, 13, 22, 20, WOOD_D); px(c, 13, 10, [170, 180, 185]); },
  cracked_telescope: (c) => { line(c, 8, 23, 22, 9, [120, 110, 90]); line(c, 9, 24, 23, 10, [100, 90, 70]); rect(c, 21, 6, 5, 5, [170, 200, 220]); line(c, 21, 6, 25, 10, [120, 120, 120]); px(c, 12, 19, [170, 200, 220]); rect(c, 7, 22, 4, 3, WOOD_D); },
  cracked_telescope_lens: (c) => { rect(c, 10, 10, 12, 12, [170, 200, 220]); rect(c, 12, 12, 8, 8, [200, 220, 235]); line(c, 11, 11, 20, 20, [120, 120, 120]); line(c, 20, 11, 12, 19, [120, 120, 120]); px(c, 16, 16, K); },
  torn_sleeping_bag: (c) => { rect(c, 10, 8, 12, 18, [90, 120, 90]); rect(c, 10, 8, 12, 2, [70, 100, 70]); line(c, 13, 12, 19, 18, [240, 240, 220]); line(c, 19, 12, 13, 18, [240, 240, 220]); px(c, 15, 14, WHITE); px(c, 17, 16, WHITE); rect(c, 14, 26, 4, 2, [70, 100, 70]); },
  broken_sleeping_bag_zipper: (c) => { line(c, 16, 6, 16, 26, [150, 150, 150]); for (const y of [8, 11, 14, 17, 20, 23]) { px(c, 15, y, GRAY_D); px(c, 17, y, GRAY_D); } rect(c, 13, 19, 6, 4, GOLD); px(c, 14, 21, K); line(c, 16, 23, 19, 26, [150, 150, 150]); },
  cracked_wristwatch: (c) => { rect(c, 13, 5, 6, 5, WOOD_D); rect(c, 13, 22, 6, 5, WOOD_D); rect(c, 10, 10, 12, 12, [200, 200, 190]); rect(c, 12, 12, 8, 8, WHITE); line(c, 11, 11, 20, 20, GRAY_D); line(c, 20, 11, 12, 19, GRAY_D); px(c, 16, 16, K); line(c, 16, 16, 16, 12, K); },
  stopped_wristwatch: (c) => { rect(c, 13, 5, 6, 5, GRAY_D); rect(c, 13, 22, 6, 5, GRAY_D); rect(c, 10, 10, 12, 12, [170, 170, 160]); rect(c, 12, 12, 8, 8, [220, 220, 210]); line(c, 16, 16, 16, 12, K); line(c, 16, 16, 19, 16, K); px(c, 16, 16, K); },
  cracked_camera: (c) => { rect(c, 7, 11, 18, 11, [90, 90, 95]); rect(c, 12, 8, 6, 3, [70, 70, 75]); rect(c, 13, 13, 6, 6, [170, 200, 220]); rect(c, 15, 15, 2, 2, K); line(c, 13, 13, 18, 18, GRAY_D); px(c, 9, 13, WHITE); rect(c, 23, 12, 2, 3, GOLD); },
  cracked_camera_lens: (c) => { rect(c, 9, 9, 14, 14, [170, 200, 220]); rect(c, 11, 11, 10, 10, [200, 220, 235]); rect(c, 13, 13, 6, 6, [140, 170, 200]); line(c, 10, 10, 22, 22, GRAY_D); line(c, 22, 10, 11, 21, GRAY_D); px(c, 16, 16, K); },
  bent_shovel: (c) => { line(c, 9, 24, 16, 12, WOOD_D); line(c, 16, 12, 21, 6, WOOD_D); rect(c, 17, 5, 7, 8, [150, 160, 165]); rect(c, 18, 6, 5, 6, [170, 180, 185]); px(c, 14, 14, K); },
  broken_shovel_handle: (c) => { line(c, 10, 6, 15, 14, WOOD_D); line(c, 17, 18, 22, 26, WOOD_D); px(c, 15, 15, K); px(c, 16, 16, K); px(c, 16, 17, K); px(c, 15, 17, [200, 190, 160]); },
  // コンテンツ小バッチ（2026-11-10 15時台）：置き去りの日用品シリーズの続き。
  frayed_ribbon: (c) => { line(c, 10, 8, 20, 12, [200, 80, 90]); line(c, 10, 12, 20, 16, [220, 100, 110]); line(c, 20, 12, 24, 10, [200, 80, 90]); line(c, 20, 16, 24, 18, [220, 100, 110]); px(c, 16, 14, [240, 140, 150]); px(c, 12, 9, WHITE); px(c, 22, 17, GRAY_D); },
  faded_ribbon: (c) => { line(c, 10, 8, 20, 12, [210, 180, 180]); line(c, 10, 12, 20, 16, [220, 195, 195]); line(c, 20, 12, 24, 10, [210, 180, 180]); line(c, 20, 16, 24, 18, [220, 195, 195]); px(c, 16, 14, [230, 210, 210]); px(c, 12, 9, [240, 235, 230]); px(c, 22, 17, GRAY_D); },
  dented_bottle: (c) => { rect(c, 11, 8, 10, 4, [170, 200, 220]); rect(c, 13, 12, 6, 14, [190, 215, 230]); rect(c, 11, 12, 3, 14, [160, 190, 210]); rect(c, 13, 12, 6, 3, [150, 180, 205]); px(c, 17, 18, [120, 160, 190]); px(c, 12, 14, WHITE); rect(c, 12, 26, 8, 2, [150, 180, 205]); },
  bottle_cap: (c) => { rect(c, 10, 12, 12, 8, [220, 90, 60]); rect(c, 10, 12, 12, 2, [240, 120, 90]); px(c, 12, 14, WHITE); px(c, 15, 14, WHITE); px(c, 18, 14, WHITE); px(c, 12, 17, [180, 60, 40]); px(c, 15, 17, [180, 60, 40]); px(c, 18, 17, [180, 60, 40]); },
  tangled_rope: (c) => { line(c, 8, 10, 24, 22, [190, 165, 120]); line(c, 8, 22, 24, 10, [200, 175, 130]); line(c, 10, 8, 20, 24, [180, 155, 110]); px(c, 16, 16, [160, 135, 95]); px(c, 12, 14, [210, 185, 140]); px(c, 20, 18, [210, 185, 140]); px(c, 16, 12, K); },
  snapped_rope: (c) => { line(c, 8, 10, 14, 16, [190, 165, 120]); line(c, 18, 18, 24, 24, [190, 165, 120]); px(c, 15, 17, [210, 185, 140]); px(c, 16, 18, [210, 185, 140]); px(c, 17, 17, K); px(c, 14, 15, [160, 135, 95]); px(c, 20, 20, [160, 135, 95]); },
  // コンテンツ小バッチ（2026-11-10 17時台）：置き去りの日用品シリーズの続き。
  chipped_comb: (c) => { rect(c, 8, 8, 16, 4, [200, 170, 120]); line(c, 10, 12, 10, 20, [200, 170, 120]); line(c, 13, 12, 13, 20, [200, 170, 120]); line(c, 16, 12, 16, 20, [200, 170, 120]); line(c, 19, 12, 19, 20, [200, 170, 120]); line(c, 22, 12, 22, 17, [200, 170, 120]); px(c, 22, 18, GRAY_D); px(c, 10, 20, GRAY_D); px(c, 13, 20, GRAY_D); },
  missing_comb_tooth: (c) => { line(c, 14, 8, 14, 22, [200, 170, 120]); px(c, 13, 9, [220, 195, 150]); px(c, 15, 9, [220, 195, 150]); px(c, 14, 22, GRAY_D); px(c, 14, 12, K); px(c, 18, 16, [160, 135, 95]); },
  single_work_glove: (c) => { rect(c, 11, 8, 10, 12, [120, 130, 160]); rect(c, 11, 20, 10, 6, [120, 130, 160]); line(c, 11, 8, 11, 14, [100, 110, 140]); line(c, 14, 8, 14, 14, [100, 110, 140]); line(c, 17, 8, 17, 14, [100, 110, 140]); line(c, 20, 8, 20, 14, [100, 110, 140]); px(c, 13, 18, WHITE); px(c, 18, 22, GRAY_D); },
  frayed_work_glove: (c) => { rect(c, 11, 8, 10, 12, [140, 145, 160]); rect(c, 11, 20, 10, 6, [140, 145, 160]); line(c, 11, 8, 11, 14, [115, 120, 135]); line(c, 14, 8, 14, 14, [115, 120, 135]); line(c, 17, 8, 17, 14, [115, 120, 135]); line(c, 20, 8, 20, 14, [115, 120, 135]); line(c, 12, 26, 14, 28, [160, 165, 180]); line(c, 17, 26, 19, 28, [160, 165, 180]); px(c, 13, 18, [200, 205, 215]); },
  bent_spoon: (c) => { line(c, 12, 24, 16, 14, GRAY_D); line(c, 16, 14, 20, 8, GRAY_D); rect(c, 17, 4, 8, 8, [200, 206, 216]); rect(c, 19, 6, 4, 4, [180, 186, 196]); px(c, 14, 20, K); px(c, 21, 6, WHITE); },
  rusty_spoon: (c) => { line(c, 14, 24, 15, 14, [150, 110, 70]); rect(c, 11, 5, 9, 9, [170, 130, 90]); rect(c, 13, 7, 5, 5, [150, 110, 70]); px(c, 12, 6, [120, 85, 50]); px(c, 18, 12, [120, 85, 50]); px(c, 15, 20, [120, 85, 50]); },
  // コンテンツ小バッチ（2026-11-10 19時台）：置き去りの日用品シリーズの続き。
  worn_slipper: (c) => { rect(c, 8, 20, 16, 4, WOOD_D); rect(c, 8, 16, 16, 4, [170, 135, 85]); rect(c, 11, 10, 10, 6, [140, 105, 60]); rect(c, 11, 10, 10, 2, [105, 75, 42]); px(c, 14, 12, [170, 135, 85]); px(c, 18, 13, [170, 135, 85]); px(c, 20, 22, WOOD_D); },
  faded_slipper: (c) => { rect(c, 8, 20, 16, 4, [150, 140, 125]); rect(c, 8, 16, 16, 4, [205, 195, 180]); rect(c, 11, 10, 10, 6, [185, 170, 150]); rect(c, 11, 10, 10, 2, [150, 140, 125]); px(c, 14, 12, [205, 195, 180]); px(c, 18, 13, [205, 195, 180]); px(c, 20, 22, [150, 140, 125]); },
  empty_wallet: (c) => { rect(c, 8, 12, 16, 10, [120, 70, 50]); rect(c, 8, 12, 16, 3, [150, 95, 65]); rect(c, 10, 15, 12, 4, [70, 40, 30]); px(c, 20, 17, [200, 160, 90]); px(c, 12, 13, WHITE); px(c, 18, 13, [150, 95, 65]); },
  loose_coins: (c) => { rect(c, 9, 9, 6, 6, [230, 190, 80]); rect(c, 17, 13, 6, 6, [230, 190, 80]); rect(c, 12, 18, 6, 6, [210, 170, 60]); px(c, 11, 11, [250, 220, 140]); px(c, 19, 15, [250, 220, 140]); px(c, 14, 20, [250, 220, 140]); },
  // コンテンツ小バッチ（2026-11-10 21時台）：置き去りの日用品シリーズの続き。
  single_earring: (c) => { for (let y = 8; y <= 23; y++) for (let x = 8; x <= 23; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 7.5 && d > 5) px(c, x, y, GOLD); } px(c, 15, 7, GOLD); px(c, 16, 7, GOLD); px(c, 15, 6, [240, 200, 120]); px(c, 12, 12, WHITE); px(c, 19, 19, [200, 160, 80]); },
  rusty_earring: (c) => { for (let y = 8; y <= 23; y++) for (let x = 8; x <= 23; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 7.5 && d > 5) px(c, x, y, [150, 100, 60]); } px(c, 15, 7, [150, 100, 60]); px(c, 16, 7, [150, 100, 60]); px(c, 15, 6, [170, 120, 70]); px(c, 12, 12, [120, 90, 60]); px(c, 19, 19, [100, 70, 45]); },
  parasol_rib: (c) => { line(c, 16, 6, 16, 26, [180, 180, 185]); line(c, 16, 10, 8, 22, [200, 200, 205]); line(c, 16, 10, 24, 22, [200, 200, 205]); line(c, 16, 14, 9, 26, [160, 160, 165]); line(c, 16, 14, 23, 26, [160, 160, 165]); px(c, 16, 6, GOLD); px(c, 16, 26, GRAY_D); },
  broken_parasol: (c) => { line(c, 16, 6, 16, 26, [180, 180, 185]); line(c, 8, 12, 24, 12, [220, 90, 60]); line(c, 8, 12, 16, 22, [220, 90, 60]); line(c, 24, 12, 16, 22, [220, 90, 60]); line(c, 10, 13, 14, 20, GRAY_D); line(c, 22, 13, 18, 20, GRAY_D); px(c, 16, 6, GOLD); },
  music_box_spring: (c) => { rect(c, 10, 10, 12, 12, [200, 200, 190]); rect(c, 12, 12, 8, 8, [220, 220, 205]); rect(c, 14, 14, 4, 4, GOLD); line(c, 16, 10, 16, 6, GOLD); line(c, 16, 6, 20, 6, GOLD); px(c, 20, 6, [240, 200, 120]); px(c, 12, 12, K); px(c, 19, 19, K); },
  stopped_music_box: (c) => { rect(c, 8, 12, 16, 12, [150, 100, 60]); rect(c, 8, 12, 16, 3, [180, 130, 80]); rect(c, 11, 15, 10, 6, [220, 200, 160]); line(c, 24, 15, 27, 15, GOLD); px(c, 27, 15, GOLD); px(c, 13, 17, K); px(c, 18, 17, K); px(c, 16, 18, [200, 160, 80]); },
  // コンテンツ小バッチ（2026-11-10 09時台）：置き去りの日用品シリーズの続き。
  broken_mug: (c) => { rect(c, 9, 12, 12, 12, WHITE); rect(c, 9, 12, 12, 2, [120, 80, 50]); rect(c, 21, 14, 4, 7, WHITE); line(c, 12, 13, 18, 20, GRAY_D); line(c, 18, 20, 14, 23, GRAY_D); px(c, 19, 12, GRAY_D); px(c, 20, 13, [200, 206, 216]); rect(c, 9, 24, 12, 2, [200, 206, 216]); },
  dented_mug: (c) => { rect(c, 9, 10, 12, 14, [200, 206, 216]); rect(c, 9, 10, 12, 2, [120, 80, 50]); rect(c, 21, 13, 4, 8, [200, 206, 216]); px(c, 14, 15, GRAY_D); px(c, 15, 16, GRAY_D); px(c, 16, 15, [180, 186, 196]); line(c, 13, 12, 15, 18, GRAY_D); rect(c, 9, 24, 12, 2, [180, 186, 196]); },
  broken_hiking_boots: (c) => { rect(c, 10, 8, 8, 12, [150, 90, 60]); rect(c, 10, 20, 16, 6, [120, 70, 45]); rect(c, 10, 26, 16, 2, [90, 55, 35]); px(c, 13, 11, WHITE); px(c, 15, 13, WHITE); px(c, 13, 15, WHITE); line(c, 12, 18, 20, 18, [90, 55, 35]); px(c, 22, 22, [200, 206, 216]); px(c, 24, 21, [200, 206, 216]); },
  frayed_hiking_boot_lace: (c) => { line(c, 8, 8, 22, 22, [222, 226, 232]); line(c, 8, 10, 22, 24, WHITE); px(c, 8, 8, GRAY_D); px(c, 22, 24, GRAY_D); px(c, 12, 14, [150, 90, 60]); px(c, 18, 18, [150, 90, 60]); px(c, 22, 22, GRAY_D); px(c, 24, 24, GRAY_D); px(c, 10, 10, WHITE); },
  broken_pocket_watch: (c) => { for (let y = 6; y <= 25; y++) for (let x = 6; x <= 25; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 9.5 && d > 8) px(c, x, y, GOLD); else if (d <= 8) px(c, x, y, PAPER); } line(c, 16, 15, 21, 10, RED2); line(c, 15, 16, 10, 21, BLUE); px(c, 15, 15, K); px(c, 16, 15, K); line(c, 11, 9, 20, 17, [120, 120, 120]); px(c, 16, 4, GOLD); px(c, 15, 5, GOLD); px(c, 17, 5, GOLD); },
  stopped_pocket_watch: (c) => { for (let y = 6; y <= 25; y++) for (let x = 6; x <= 25; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 9.5 && d > 8) px(c, x, y, GOLD); else if (d <= 8) px(c, x, y, [200, 196, 180]); } line(c, 16, 15, 16, 22, K); line(c, 15, 16, 10, 16, K); px(c, 15, 15, RED2); px(c, 16, 15, RED2); px(c, 16, 4, GOLD); px(c, 15, 5, GOLD); px(c, 17, 5, GOLD); },
  // コンテンツ小バッチ（2026-11-10 09時台の統合分。08時台バッチから移植）：置き去りの日用品シリーズの続き。
  frayed_plushie: (c) => { rect(c, 11, 7, 10, 10, [190, 160, 120]); rect(c, 10, 9, 3, 3, [190, 160, 120]); rect(c, 19, 9, 3, 3, [190, 160, 120]); px(c, 14, 11, K); px(c, 18, 11, K); px(c, 16, 14, K); rect(c, 12, 17, 8, 8, [190, 160, 120]); line(c, 14, 18, 18, 22, [150, 120, 85]); line(c, 18, 18, 14, 22, [150, 120, 85]); px(c, 13, 25, [150, 120, 85]); },
  plushie_button: (c) => { rect(c, 11, 11, 10, 10, [120, 100, 80]); rect(c, 13, 13, 6, 6, [140, 120, 95]); px(c, 14, 15, K); px(c, 17, 15, K); px(c, 14, 18, K); px(c, 17, 18, K); },
  broken_radio: (c) => { rect(c, 8, 12, 16, 11, [150, 100, 60]); rect(c, 8, 12, 16, 2, [170, 120, 75]); rect(c, 11, 15, 6, 5, [220, 220, 200]); line(c, 12, 16, 16, 19, [120, 120, 120]); px(c, 19, 16, RED2); px(c, 20, 19, GOLD); rect(c, 10, 8, 2, 4, METAL); line(c, 11, 8, 14, 5, METAL); },
  broken_radio_dial: (c) => { rect(c, 10, 10, 12, 12, [200, 200, 190]); rect(c, 12, 12, 8, 8, [230, 230, 220]); line(c, 12, 13, 20, 13, [120, 120, 120]); line(c, 12, 16, 20, 16, [120, 120, 120]); line(c, 12, 19, 20, 19, [120, 120, 120]); px(c, 16, 16, RED2); },
  pocket_watch_hand: (c) => { line(c, 12, 24, 20, 8, [180, 150, 60]); line(c, 13, 24, 21, 9, [200, 170, 80]); px(c, 16, 16, K); rect(c, 11, 23, 4, 3, GOLD); },
  worn_rag: (c) => { rect(c, 8, 10, 16, 13, [178, 190, 200]); rect(c, 8, 10, 16, 2, [150, 164, 176]); line(c, 11, 14, 15, 19, [150, 164, 176]); line(c, 16, 13, 20, 20, [150, 164, 176]); px(c, 12, 21, [150, 164, 176]); },
  lost_glove: (c) => { rect(c, 12, 8, 8, 16, TEAL); rect(c, 12, 8, 8, 2, [62, 158, 138]); rect(c, 20, 12, 4, 8, TEAL); px(c, 14, 24, [62, 158, 138]); px(c, 16, 24, [62, 158, 138]); },
  backlit_photo: (c) => { rect(c, 7, 7, 18, 18, PAPER); rect(c, 9, 9, 14, 14, [255, 240, 190]); rect(c, 9, 16, 14, 7, [90, 90, 100]); rect(c, 14, 13, 4, 10, [60, 60, 70]); px(c, 20, 11, WHITE); },
  blurry_cat_photo: (c) => { rect(c, 7, 7, 18, 18, PAPER); rect(c, 9, 9, 14, 14, [200, 220, 230]); rect(c, 12, 14, 8, 6, [220, 150, 80]); rect(c, 13, 12, 2, 3, [220, 150, 80]); rect(c, 18, 12, 2, 3, [220, 150, 80]); line(c, 11, 17, 21, 17, [220, 150, 80]); },
  undeveloped_film: (c) => { rect(c, 8, 6, 16, 20, [50, 50, 60]); for (const y of [8, 13, 18, 23]) { px(c, 10, y, GRAY); px(c, 21, y, GRAY); } rect(c, 12, 10, 8, 8, [90, 90, 110]); px(c, 14, 12, [140, 140, 160]); },
  patrol_log: (c) => { rect(c, 8, 5, 16, 22, PAPER); rect(c, 8, 5, 16, 2, [222, 214, 190]); line(c, 11, 11, 13, 13, GREEN_D); line(c, 13, 13, 17, 9, GREEN_D); line(c, 11, 16, 13, 18, GREEN_D); line(c, 13, 18, 17, 14, GREEN_D); rect(c, 11, 21, 10, 1, GRAY_D); },
  spare_battery: (c) => { rect(c, 12, 8, 8, 18, [200, 80, 60]); rect(c, 14, 5, 4, 3, METAL); rect(c, 12, 8, 8, 3, [220, 110, 90]); px(c, 14, 14, WHITE); px(c, 16, 14, WHITE); px(c, 15, 17, WHITE); },
  night_shift_cookie: (c) => { rect(c, 9, 9, 14, 14, [196, 150, 90]); rect(c, 11, 11, 10, 10, [214, 170, 110]); px(c, 13, 13, BROWN); px(c, 18, 15, BROWN); px(c, 15, 19, BROWN); px(c, 19, 19, BROWN); },
  faded_paperback: (c) => { rect(c, 9, 6, 14, 20, [200, 190, 170]); rect(c, 9, 6, 3, 20, [180, 168, 148]); rect(c, 12, 10, 8, 1, GRAY_D); rect(c, 12, 14, 8, 1, GRAY_D); rect(c, 12, 18, 5, 1, GRAY_D); },
  torn_bookmark: (c) => { line(c, 14, 5, 14, 22, RED2); line(c, 17, 5, 17, 18, RED2); px(c, 14, 23, RED2); px(c, 15, 24, RED2); px(c, 16, 23, RED2); px(c, 17, 19, RED2); px(c, 18, 20, RED2); },
  annotated_textbook: (c) => { rect(c, 8, 6, 16, 20, BLUE); rect(c, 8, 6, 3, 20, WATER_D); rect(c, 11, 10, 10, 1, WHITE); rect(c, 11, 14, 10, 1, WHITE); line(c, 12, 18, 20, 21, RED2); line(c, 20, 18, 14, 22, RED2); },
  tangled_earphones: (c) => { rect(c, 8, 8, 5, 7, WHITE); rect(c, 19, 7, 5, 7, WHITE); px(c, 10, 11, K); px(c, 21, 10, K); line(c, 10, 15, 14, 20, GRAY_D); line(c, 21, 14, 17, 21, GRAY_D); line(c, 14, 20, 20, 24, GRAY_D); line(c, 20, 24, 12, 26, GRAY_D); px(c, 16, 22, METAL_D); },
  tangled_fishing_line: (c) => { line(c, 6, 8, 20, 20, GRAY_D); line(c, 20, 8, 8, 22, GRAY_D); line(c, 8, 22, 24, 12, GRAY_D); px(c, 12, 14, METAL_D); px(c, 18, 16, METAL); px(c, 15, 19, METAL_D); },
  soggy_bait_bag: (c) => { rect(c, 9, 9, 14, 14, [196, 158, 104]); rect(c, 9, 9, 14, 2, WOOD_D); rect(c, 11, 13, 10, 6, [168, 124, 74]); px(c, 13, 15, WATER); px(c, 18, 17, WATER); px(c, 15, 20, WATER); rect(c, 12, 23, 8, 2, [168, 124, 74]); },
  flat_pillow: (c) => { rect(c, 6, 12, 20, 10, WHITE); rect(c, 6, 12, 20, 2, [222, 226, 232]); rect(c, 6, 20, 20, 2, [200, 206, 216]); px(c, 10, 16, GRAY_D); px(c, 16, 15, GRAY_D); px(c, 21, 17, GRAY_D); },
  broken_pruning_shears: (c) => { line(c, 8, 24, 18, 8, METAL_D); line(c, 22, 24, 14, 8, METAL); px(c, 19, 6, METAL); px(c, 13, 6, METAL_D); rect(c, 6, 22, 4, 4, RED2); rect(c, 20, 22, 4, 4, RED2); px(c, 16, 12, GRAY_D); },
  cracked_ice_pack: (c) => { rect(c, 8, 10, 16, 12, [210, 232, 244]); rect(c, 8, 10, 16, 2, WATER); line(c, 12, 12, 16, 20, WHITE); line(c, 16, 20, 13, 14, WHITE); px(c, 19, 14, WATER_D); px(c, 11, 18, WATER_D); },
  rusty_spout: (c) => { rect(c, 9, 12, 12, 12, RUST); rect(c, 9, 12, 12, 2, RUST_L); line(c, 21, 16, 26, 12, RUST_D); px(c, 26, 12, RUST); px(c, 12, 15, RUST_D); px(c, 17, 19, RUST_L); rect(c, 9, 24, 12, 2, RUST_D); },
  dusty_gloves: (c) => { rect(c, 8, 8, 8, 12, [196, 158, 104]); rect(c, 16, 8, 8, 12, [178, 132, 84]); rect(c, 8, 20, 8, 4, [168, 124, 74]); rect(c, 16, 20, 8, 4, [168, 124, 74]); px(c, 10, 11, GRAY); px(c, 19, 12, GRAY); px(c, 13, 16, GRAY_D); },
  loose_shirt_button: (c) => { rect(c, 10, 10, 12, 12, WHITE); rect(c, 10, 10, 12, 2, [222, 226, 232]); px(c, 14, 14, GRAY_D); px(c, 18, 14, GRAY_D); px(c, 14, 18, GRAY_D); px(c, 18, 18, GRAY_D); px(c, 12, 12, GRAY); px(c, 20, 20, GRAY); },
  bent_paperclip: (c) => { line(c, 10, 8, 10, 24, METAL_D); line(c, 10, 24, 20, 24, METAL_D); line(c, 20, 24, 20, 12, METAL_D); line(c, 20, 12, 14, 12, METAL_D); line(c, 14, 12, 14, 20, METAL_D); px(c, 22, 10, METAL); },
  dented_lunchbox: (c) => { rect(c, 7, 10, 18, 12, [226, 96, 84]); rect(c, 7, 10, 18, 2, RED2); rect(c, 7, 20, 18, 2, RED2); px(c, 11, 13, WHITE); px(c, 18, 16, [200, 60, 50]); px(c, 14, 19, [200, 60, 50]); rect(c, 12, 8, 8, 2, METAL_D); },
  flickering_desk_lamp: (c) => { rect(c, 8, 24, 16, 2, METAL_D); line(c, 16, 24, 16, 12, METAL_D); rect(c, 11, 6, 10, 6, GOLD); px(c, 13, 8, WHITE); px(c, 19, 8, [255, 236, 170]); px(c, 16, 4, GOLD); px(c, 22, 10, GOLD); },
  mossy_pinecone: (c) => { rect(c, 11, 6, 10, 4, BROWN); rect(c, 10, 10, 12, 4, [122, 84, 47]); rect(c, 9, 14, 14, 4, BROWN); rect(c, 10, 18, 12, 4, [122, 84, 47]); rect(c, 12, 22, 8, 4, BROWN); px(c, 12, 11, GREEN); px(c, 19, 15, GREEN_D); px(c, 14, 19, GREEN); },
  upgrade_better_rod: (c) => { line(c, 8, 26, 24, 6, WOOD_D); line(c, 24, 6, 24, 16, [230, 236, 240]); px(c, 24, 17, RED2); px(c, 24, 18, WHITE); px(c, 12, 20, GOLD); px(c, 17, 14, GOLD); },
  upgrade_wrist_care: (c) => { rect(c, 9, 10, 14, 12, WHITE); rect(c, 9, 10, 14, 2, [222, 226, 232]); rect(c, 9, 15, 14, 2, [240, 200, 200]); rect(c, 9, 19, 14, 2, [222, 226, 232]); px(c, 15, 12, RED2); px(c, 16, 12, RED2); px(c, 15, 13, RED2); px(c, 16, 13, RED2); },
  upgrade_small_shelf: (c) => { rect(c, 6, 8, 20, 2, WOOD); rect(c, 6, 18, 20, 2, WOOD); rect(c, 6, 26, 20, 2, WOOD); rect(c, 6, 8, 2, 20, WOOD_D); rect(c, 24, 8, 2, 20, WOOD_D); rect(c, 10, 12, 4, 6, BLUE); rect(c, 16, 13, 3, 5, RED2); rect(c, 12, 21, 5, 5, TEAL); },
};
for (const [id, draw] of Object.entries(ITEM_ICON_BUILDERS)) saveSingle(iconCanvas(draw), `item-${id}.png`);
// 未知アイテム用フォールバック（小包）
saveSingle(iconCanvas((c) => { rect(c, 8, 11, 16, 13, [168, 124, 74]); rect(c, 8, 11, 16, 2, WOOD_D); rect(c, 15, 11, 2, 13, WOOD_D); rect(c, 8, 17, 16, 2, WOOD_D); }), 'item-fallback.png');

// ---------- equipment icons (32x32, by baseId) ----------
const EQUIP_ICON_BUILDERS = {
  better_stick: ITEM_ICON_BUILDERS.hinoki_stick,
  clockout_dagger: (c) => { line(c, 12, 20, 22, 8, METAL); line(c, 13, 21, 23, 9, WHITE); rect(c, 9, 20, 5, 3, GOLD); rect(c, 6, 22, 4, 5, WOOD_D); },
  paid_leave_sword: (c) => { line(c, 13, 19, 23, 5, [255, 236, 170]); line(c, 14, 20, 24, 6, GOLD); rect(c, 9, 19, 6, 3, GOLD); rect(c, 6, 21, 4, 6, [84, 156, 214]); px(c, 25, 4, WHITE); px(c, 21, 3, GOLD); px(c, 26, 9, WHITE); },
  cheap_gloves: (c) => { rect(c, 8, 12, 6, 10, [196, 158, 104]); rect(c, 8, 12, 6, 3, BROWN); rect(c, 18, 12, 6, 10, [196, 158, 104]); rect(c, 18, 12, 6, 3, BROWN); px(c, 9, 8, [196, 158, 104]); px(c, 12, 7, [196, 158, 104]); px(c, 19, 8, [196, 158, 104]); px(c, 22, 7, [196, 158, 104]); rect(c, 8, 22, 6, 2, BROWN); rect(c, 18, 22, 6, 2, BROWN); },
  back_friendly_belt: (c) => { rect(c, 5, 13, 22, 7, BROWN); rect(c, 5, 13, 22, 2, WOOD_D); rect(c, 13, 12, 6, 9, GOLD); rect(c, 15, 15, 2, 3, [184, 128, 30]); },
  holiday_shield: (c) => { rect(c, 9, 5, 14, 12, BLUE); rect(c, 11, 17, 10, 5, BLUE); px(c, 15, 22, BLUE); px(c, 16, 22, BLUE); px(c, 15, 23, WATER_D); rect(c, 9, 5, 14, 2, WATER_D); px(c, 16, 9, WHITE); rect(c, 15, 12, 2, 5, WHITE); rect(c, 13, 13, 6, 2, WHITE); },
  unearned_cloak: (c) => { for (let y = 8; y <= 27; y++) { const w = 5 + Math.round((y - 8) * 0.36); rect(c, 16 - w, y, w * 2, 1, y > 23 ? [50, 55, 62] : [66, 71, 80]); } rect(c, 13, 5, 6, 4, GOLD); px(c, 15, 6, RED2); },
  merchant_abacus: (c) => { rect(c, 6, 9, 20, 14, WOOD_D); rect(c, 8, 11, 16, 10, [240, 226, 190]); rect(c, 8, 15, 16, 1, WOOD_D); for (const x of [10, 14, 18, 22]) { px(c, x, 12, RED2); px(c, x, 13, RED2); px(c, x, 18, BROWN); px(c, x, 19, BROWN); } px(c, 12, 18, RED2); px(c, 12, 19, RED2); px(c, 20, 12, BROWN); px(c, 20, 13, BROWN); },
  quiet_lure: (c) => { rect(c, 12, 10, 9, 6, RED2); rect(c, 12, 10, 9, 2, [226, 96, 84]); px(c, 18, 12, WHITE); px(c, 18, 13, K); line(c, 16, 10, 16, 4, GRAY_D); px(c, 14, 19, METAL_D); px(c, 15, 21, METAL_D); px(c, 14, 23, METAL_D); px(c, 18, 19, METAL_D); px(c, 17, 21, METAL_D); },
  notification_ward: (c) => { rect(c, 11, 6, 10, 20, [240, 236, 220]); rect(c, 11, 6, 10, 3, RED2); rect(c, 14, 13, 4, 5, GRAY_D); px(c, 13, 21, K); px(c, 18, 21, K); line(c, 12, 24, 20, 12, RED2); },
  freedom_compass: (c) => { for (let y = 6; y <= 25; y++) for (let x = 6; x <= 25; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 9.5 && d > 8) px(c, x, y, GOLD); else if (d <= 8) px(c, x, y, PAPER); } line(c, 16, 15, 21, 10, RED2); line(c, 15, 16, 10, 21, BLUE); px(c, 15, 15, K); px(c, 16, 15, K); },
  no_work_ring: (c) => { for (let y = 10; y <= 25; y++) for (let x = 8; x <= 23; x++) { const d = Math.hypot(x - 15.5, y - 17.5); if (d <= 7.5 && d > 5) px(c, x, y, GOLD); } rect(c, 13, 3, 5, 5, CYAN); px(c, 14, 4, WHITE); },
  lunch_break_hammer: (c) => { rect(c, 7, 7, 18, 7, METAL); rect(c, 7, 7, 18, 2, METAL_D); rect(c, 14, 14, 4, 14, WOOD_D); px(c, 10, 9, WHITE); px(c, 20, 9, WHITE); },
  weekend_bow: (c) => { line(c, 8, 6, 8, 26, WOOD); line(c, 8, 6, 20, 16, WOOD_D); line(c, 8, 26, 20, 16, WOOD_D); line(c, 8, 6, 8, 26, GRAY); px(c, 21, 16, METAL); px(c, 22, 16, WHITE); },
  warm_sweater: (c) => { rect(c, 9, 8, 14, 14, [196, 120, 110]); rect(c, 6, 9, 4, 10, [196, 120, 110]); rect(c, 22, 9, 4, 10, [196, 120, 110]); rect(c, 9, 22, 14, 4, [176, 104, 96]); px(c, 12, 12, WHITE); px(c, 18, 15, WHITE); px(c, 14, 18, WHITE); },
  raincoat_of_days_off: (c) => { for (let y = 6; y <= 26; y++) { const w = 4 + Math.round((y - 6) * 0.3); rect(c, 16 - w, y, w * 2, 1, TEAL); } rect(c, 12, 4, 8, 3, [250, 220, 90]); px(c, 15, 8, WHITE); px(c, 17, 11, WHITE); },
  morning_coffee_charm: (c) => { rect(c, 9, 12, 12, 13, WHITE); rect(c, 9, 12, 12, 2, [120, 80, 50]); rect(c, 21, 15, 4, 7, WHITE); rect(c, 9, 25, 12, 2, [120, 80, 50]); px(c, 12, 8, GRAY); px(c, 14, 6, GRAY); px(c, 16, 8, GRAY); },
  receipt_charm: (c) => { rect(c, 10, 5, 12, 22, PAPER); rect(c, 10, 5, 12, 2, GRAY); for (const y of [10, 14, 18, 22]) rect(c, 12, y, 8, 1, GRAY); px(c, 18, 10, RED2); px(c, 19, 10, RED2); },
  overtime_frying_pan: (c) => { for (let y = 8; y <= 23; y++) for (let x = 8; x <= 23; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d <= 7.5) px(c, x, y, METAL_D); else if (d <= 8.5) px(c, x, y, METAL); } rect(c, 22, 14, 8, 3, WOOD_D); px(c, 12, 12, WHITE); px(c, 19, 19, METAL); },
  punctual_boomerang: (c) => { line(c, 8, 8, 20, 20, WOOD); line(c, 20, 20, 26, 10, WOOD); line(c, 8, 8, 12, 12, GOLD); line(c, 22, 14, 26, 10, GOLD); px(c, 20, 20, RED2); px(c, 21, 21, RED2); },
  blanket_armor: (c) => { rect(c, 8, 8, 16, 16, [196, 120, 110]); rect(c, 8, 8, 16, 3, [220, 150, 140]); for (const y of [14, 18]) rect(c, 8, y, 16, 1, WHITE); px(c, 12, 12, WHITE); px(c, 19, 20, WHITE); },
  rain_shelter_scarf: (c) => { rect(c, 6, 12, 20, 5, TEAL); rect(c, 8, 17, 16, 4, [90, 170, 180]); px(c, 10, 13, WHITE); px(c, 18, 15, WHITE); px(c, 7, 21, TEAL); px(c, 22, 21, TEAL); px(c, 12, 22, TEAL); },
  front_door_key_charm: (c) => { for (let y = 6; y <= 13; y++) for (let x = 12; x <= 19; x++) { const d = Math.hypot(x - 15.5, y - 9.5); if (d <= 3.5 && d > 1.5) px(c, x, y, GOLD); } rect(c, 15, 13, 2, 13, GOLD); rect(c, 17, 20, 4, 2, GOLD); rect(c, 17, 24, 4, 2, GOLD); },
  paid_leave_calendar_charm: (c) => { rect(c, 7, 7, 18, 18, PAPER); rect(c, 7, 7, 18, 4, RED2); for (const y of [14, 19]) for (const x of [10, 15, 20]) px(c, x, y, GRAY); px(c, 10, 14, GOLD); px(c, 15, 19, GOLD); px(c, 20, 14, GOLD); px(c, 11, 5, GOLD); px(c, 20, 5, GOLD); },
  nap_pillow_mace: (c) => { rect(c, 7, 10, 18, 12, WHITE); rect(c, 7, 10, 18, 3, [220, 220, 210]); rect(c, 12, 22, 3, 8, WOOD_D); rect(c, 12, 22, 8, 3, WOOD_D); px(c, 11, 14, TEAL); px(c, 19, 17, TEAL); },
  last_train_spear: (c) => { line(c, 8, 24, 20, 8, WOOD); line(c, 9, 25, 21, 9, WOOD_D); rect(c, 20, 4, 8, 8, METAL); px(c, 24, 3, WHITE); px(c, 22, 6, RED2); px(c, 25, 9, WHITE); },
  kotatsu_armor: (c) => { rect(c, 6, 10, 20, 5, WOOD_D); rect(c, 8, 15, 16, 9, [196, 120, 110]); rect(c, 8, 15, 16, 2, [220, 150, 140]); rect(c, 10, 24, 3, 4, WOOD_D); rect(c, 19, 24, 3, 4, WOOD_D); px(c, 13, 19, WHITE); },
  day_off_hoodie: (c) => { rect(c, 9, 9, 14, 15, [150, 170, 190]); rect(c, 9, 9, 14, 4, [170, 190, 205]); rect(c, 12, 5, 8, 5, [130, 150, 170]); rect(c, 9, 24, 14, 3, [130, 150, 170]); px(c, 14, 15, WHITE); px(c, 18, 18, WHITE); },
  cat_nap_charm: (c) => { rect(c, 6, 14, 20, 10, [200, 170, 130]); rect(c, 6, 14, 6, 6, [200, 170, 130]); rect(c, 20, 14, 6, 6, [200, 170, 130]); px(c, 12, 17, K); px(c, 20, 17, K); px(c, 9, 12, [240, 200, 170]); px(c, 23, 12, [240, 200, 170]); },
  evening_bath_charm: (c) => { rect(c, 9, 14, 14, 12, [110, 186, 224]); rect(c, 9, 14, 14, 2, WATER_D); px(c, 12, 10, GRAY); px(c, 15, 8, GRAY); px(c, 18, 10, GRAY); px(c, 13, 20, WHITE); px(c, 18, 22, WHITE); },
  folding_umbrella_sword: (c) => { line(c, 8, 26, 20, 10, METAL); line(c, 9, 27, 21, 11, WHITE); rect(c, 20, 4, 8, 7, RED2); px(c, 22, 3, RED2); rect(c, 6, 26, 4, 3, WOOD_D); px(c, 24, 6, WHITE); },
  midnight_fridge_axe: (c) => { rect(c, 9, 5, 14, 12, WHITE); rect(c, 9, 5, 14, 2, [222, 226, 232]); rect(c, 9, 17, 14, 11, [210, 232, 244]); rect(c, 9, 17, 14, 2, [222, 226, 232]); px(c, 20, 8, TEAL); px(c, 20, 20, GOLD); rect(c, 12, 26, 3, 4, WOOD_D); },
  bath_towel_armor: (c) => { rect(c, 8, 9, 16, 16, WHITE); rect(c, 8, 9, 16, 3, [222, 226, 232]); rect(c, 8, 22, 16, 3, [200, 206, 216]); px(c, 12, 14, TEAL); px(c, 18, 17, TEAL); px(c, 14, 20, [200, 206, 216]); },
  zabuton_armor: (c) => { rect(c, 7, 16, 18, 7, [196, 120, 110]); rect(c, 7, 16, 18, 2, [220, 150, 140]); rect(c, 9, 12, 14, 4, [220, 150, 140]); px(c, 12, 18, WHITE); px(c, 18, 18, WHITE); rect(c, 7, 23, 18, 2, [176, 104, 96]); },
  toothbrush_charm: (c) => { line(c, 10, 26, 10, 10, [110, 186, 224]); line(c, 11, 26, 11, 10, WATER_D); rect(c, 10, 6, 2, 4, WHITE); px(c, 13, 7, WHITE); px(c, 16, 6, WHITE); px(c, 19, 8, WHITE); px(c, 22, 7, WHITE); px(c, 13, 12, WHITE); px(c, 19, 12, WHITE); },
  balcony_stargazing_charm: (c) => { rect(c, 6, 20, 20, 3, WOOD_D); rect(c, 6, 23, 20, 2, WOOD); px(c, 10, 6, GOLD); px(c, 18, 4, WHITE); px(c, 22, 9, GOLD); px(c, 13, 11, WHITE); px(c, 20, 14, WHITE); px(c, 9, 14, GOLD); },
  alarm_clock_sword: (c) => { line(c, 10, 26, 20, 10, METAL); line(c, 11, 27, 21, 11, WHITE); rect(c, 18, 4, 10, 10, GOLD); px(c, 20, 6, K); px(c, 26, 6, K); line(c, 23, 9, 23, 12, K); line(c, 23, 9, 26, 9, K); rect(c, 8, 26, 4, 3, WOOD_D); },
  stationery_scissors_sword: (c) => { line(c, 8, 24, 20, 8, METAL); line(c, 20, 8, 26, 4, METAL); line(c, 8, 24, 14, 14, METAL_D); rect(c, 6, 22, 5, 5, RED2); rect(c, 10, 26, 5, 5, RED2); px(c, 22, 6, WHITE); },
  futon_armor: (c) => { rect(c, 8, 9, 16, 16, [240, 226, 190]); rect(c, 8, 9, 16, 3, WHITE); for (const y of [15, 19]) rect(c, 8, y, 16, 1, [200, 180, 150]); px(c, 12, 13, TEAL); px(c, 18, 21, TEAL); },
  loungewear_armor: (c) => { rect(c, 9, 8, 14, 14, [170, 190, 205]); rect(c, 6, 9, 4, 10, [170, 190, 205]); rect(c, 22, 9, 4, 10, [170, 190, 205]); rect(c, 9, 22, 14, 3, [130, 150, 170]); px(c, 13, 13, WHITE); px(c, 18, 16, WHITE); },
  plant_watering_charm: (c) => { rect(c, 9, 14, 14, 10, TEAL); rect(c, 9, 14, 14, 2, WATER_D); line(c, 23, 16, 27, 12, TEAL); px(c, 15, 8, [90, 180, 90]); px(c, 17, 6, [90, 180, 90]); px(c, 19, 9, [90, 180, 90]); px(c, 13, 10, [90, 180, 90]); },
  sunset_walk_charm: (c) => { rect(c, 6, 16, 20, 4, [250, 180, 90]); rect(c, 6, 20, 20, 2, [240, 140, 70]); px(c, 20, 6, GOLD); px(c, 10, 8, WHITE); px(c, 14, 5, WHITE); px(c, 22, 10, GOLD); line(c, 8, 24, 24, 24, WOOD_D); },
  laundry_pole_sword: (c) => { line(c, 6, 26, 22, 8, METAL); line(c, 7, 27, 23, 9, WHITE); rect(c, 19, 4, 6, 6, WHITE); rect(c, 19, 4, 6, 2, [200, 206, 216]); rect(c, 12, 12, 5, 5, [170, 190, 205]); px(c, 24, 6, METAL_D); },
  sticky_note_dagger: (c) => { line(c, 10, 26, 22, 10, METAL); line(c, 11, 27, 23, 11, WHITE); rect(c, 20, 4, 8, 8, [250, 220, 90]); rect(c, 20, 4, 8, 2, [240, 200, 70]); px(c, 22, 7, RED2); px(c, 25, 9, RED2); rect(c, 8, 24, 4, 4, GOLD); },
  rain_boots_armor: (c) => { rect(c, 8, 6, 6, 14, [90, 170, 180]); rect(c, 18, 6, 6, 14, [90, 170, 180]); rect(c, 8, 20, 8, 5, TEAL); rect(c, 18, 20, 8, 5, TEAL); px(c, 10, 10, WHITE); px(c, 20, 13, WHITE); px(c, 12, 22, WHITE); px(c, 22, 22, WHITE); },
  apron_armor: (c) => { rect(c, 9, 8, 14, 17, [220, 150, 140]); rect(c, 9, 8, 14, 3, [196, 120, 110]); line(c, 11, 8, 11, 4, BROWN); line(c, 21, 8, 21, 4, BROWN); rect(c, 11, 16, 10, 5, PAPER); px(c, 13, 18, RED2); px(c, 18, 18, RED2); px(c, 15, 20, TEAL); },
  morning_window_charm: (c) => { rect(c, 7, 7, 18, 18, WOOD_D); rect(c, 9, 9, 14, 14, [170, 210, 240]); line(c, 16, 9, 16, 23, WOOD_D); line(c, 9, 16, 23, 16, WOOD_D); px(c, 12, 12, GOLD); px(c, 13, 11, GOLD); px(c, 20, 10, WHITE); px(c, 11, 20, WHITE); },
  first_snow_charm: (c) => { rect(c, 8, 8, 16, 16, BLUE); rect(c, 8, 8, 16, 2, WATER_D); px(c, 12, 12, WHITE); px(c, 20, 14, WHITE); px(c, 16, 18, WHITE); px(c, 14, 16, WHITE); px(c, 18, 11, WHITE); px(c, 11, 20, GOLD); px(c, 21, 20, GOLD); px(c, 16, 10, WHITE); },
  broom_spear: (c) => { line(c, 9, 26, 21, 8, WOOD); line(c, 10, 27, 22, 9, WOOD_D); rect(c, 20, 4, 6, 6, METAL); px(c, 24, 3, WHITE); rect(c, 6, 24, 6, 4, BROWN); px(c, 7, 28, BROWN); px(c, 10, 28, BROWN); px(c, 8, 23, GOLD); },
  extension_cord_whip: (c) => { line(c, 6, 26, 20, 10, METAL_D); line(c, 20, 10, 26, 6, WHITE); rect(c, 23, 4, 6, 6, WHITE); rect(c, 23, 4, 6, 2, GRAY_D); px(c, 25, 6, GOLD); px(c, 26, 7, GOLD); px(c, 8, 24, METAL); px(c, 12, 20, METAL); px(c, 16, 16, METAL); },
  rubber_gloves_armor: (c) => { rect(c, 8, 10, 6, 12, TEAL); rect(c, 18, 10, 6, 12, TEAL); px(c, 9, 8, TEAL); px(c, 11, 8, TEAL); px(c, 19, 8, TEAL); px(c, 21, 8, TEAL); rect(c, 8, 22, 6, 2, [62, 158, 138]); rect(c, 18, 22, 6, 2, [62, 158, 138]); px(c, 10, 14, WHITE); px(c, 20, 14, WHITE); },
  hot_water_bottle_armor: (c) => { rect(c, 10, 8, 12, 16, RED2); rect(c, 10, 8, 12, 3, [226, 96, 84]); rect(c, 13, 5, 6, 3, BROWN); px(c, 13, 12, WHITE); px(c, 18, 18, WHITE); px(c, 14, 20, [226, 96, 84]); rect(c, 10, 24, 12, 2, [160, 40, 34]); },
  evening_newspaper_charm: (c) => { rect(c, 8, 6, 16, 20, PAPER); rect(c, 8, 6, 16, 2, [222, 214, 190]); rect(c, 11, 10, 10, 2, RED2); rect(c, 11, 14, 10, 1, GRAY_D); rect(c, 11, 17, 10, 1, GRAY_D); rect(c, 11, 20, 7, 1, GRAY_D); px(c, 20, 23, GRAY_D); },
  streetlight_charm: (c) => { rect(c, 14, 12, 4, 16, METAL_D); rect(c, 11, 6, 10, 6, GOLD); rect(c, 13, 12, 6, 2, GOLD); px(c, 16, 9, WHITE); px(c, 10, 12, GOLD); px(c, 22, 12, GOLD); px(c, 8, 16, GOLD); px(c, 24, 16, GOLD); rect(c, 12, 28, 8, 2, METAL_D); },
  mop_lance: (c) => { line(c, 16, 4, 16, 18, WOOD); line(c, 15, 4, 15, 18, WOOD_D); for (const x of [11, 14, 17, 20]) { line(c, x, 19, x - 1, 27, [200, 206, 216]); } rect(c, 11, 18, 11, 2, METAL_D); px(c, 16, 3, METAL); },
  rice_cooker_hammer: (c) => { rect(c, 8, 14, 16, 11, WHITE); rect(c, 8, 14, 16, 3, [200, 206, 216]); rect(c, 12, 10, 8, 4, METAL_D); px(c, 15, 19, RED2); px(c, 18, 19, GRAY_D); rect(c, 6, 17, 2, 5, [200, 206, 216]); rect(c, 24, 17, 2, 5, [200, 206, 216]); rect(c, 10, 25, 12, 2, METAL_D); },
  cardboard_armor: (c) => { rect(c, 8, 8, 16, 17, [196, 158, 104]); rect(c, 8, 8, 16, 2, WOOD_D); line(c, 16, 8, 16, 25, WOOD_D); line(c, 8, 16, 24, 16, WOOD_D); px(c, 11, 11, [168, 124, 74]); px(c, 19, 20, [168, 124, 74]); rect(c, 5, 10, 3, 9, [196, 158, 104]); rect(c, 24, 10, 3, 9, [196, 158, 104]); },
  electric_blanket_armor: (c) => { rect(c, 8, 9, 16, 15, [150, 90, 80]); rect(c, 8, 9, 16, 3, [176, 104, 96]); for (const y of [15, 19]) rect(c, 8, y, 16, 1, [220, 150, 140]); line(c, 22, 24, 26, 27, K); rect(c, 26, 26, 3, 3, K); px(c, 12, 12, GOLD); px(c, 18, 21, GOLD); },
  grocery_list_charm: (c) => { rect(c, 9, 6, 14, 20, PAPER); rect(c, 9, 6, 14, 2, [222, 214, 190]); rect(c, 11, 11, 3, 3, GRAY); rect(c, 11, 16, 3, 3, GRAY); rect(c, 11, 21, 3, 3, GRAY); px(c, 12, 12, TEAL); px(c, 12, 17, TEAL); rect(c, 16, 12, 6, 1, GRAY_D); rect(c, 16, 17, 6, 1, GRAY_D); rect(c, 16, 22, 4, 1, GRAY_D); },
  dawn_silence_charm: (c) => { rect(c, 9, 7, 14, 18, [44, 48, 74]); rect(c, 9, 7, 14, 2, [28, 30, 48]); px(c, 12, 11, WHITE); px(c, 19, 10, GOLD); px(c, 15, 14, WHITE); rect(c, 11, 20, 10, 2, [250, 180, 90]); rect(c, 13, 18, 6, 2, [240, 140, 70]); px(c, 16, 4, GOLD); },
  waribashi_swords: (c) => { line(c, 9, 26, 19, 6, WOOD); line(c, 10, 27, 20, 7, WOOD_D); line(c, 23, 26, 13, 6, WOOD); line(c, 22, 27, 12, 7, WOOD_D); px(c, 19, 5, METAL); px(c, 13, 5, METAL); rect(c, 7, 25, 5, 3, BROWN); rect(c, 20, 25, 5, 3, BROWN); },
  tv_remote_wand: (c) => { rect(c, 12, 8, 8, 18, [52, 58, 66]); rect(c, 12, 8, 8, 3, RED2); px(c, 14, 13, RED2); px(c, 17, 13, GREEN); px(c, 14, 16, BLUE); px(c, 17, 16, GOLD); px(c, 15, 20, WHITE); px(c, 16, 22, WHITE); line(c, 16, 8, 16, 3, GRAY_D); px(c, 16, 2, GOLD); px(c, 14, 4, GOLD); px(c, 18, 4, GOLD); },
  cardboard_box_armor: (c) => { rect(c, 8, 8, 16, 16, [196, 158, 104]); rect(c, 8, 8, 16, 2, WOOD_D); rect(c, 8, 8, 16, 1, [220, 190, 140]); rect(c, 15, 8, 2, 16, [170, 130, 80]); rect(c, 8, 15, 16, 2, [170, 130, 80]); px(c, 12, 12, BROWN); px(c, 20, 20, BROWN); rect(c, 10, 24, 12, 3, WOOD_D); },
  sleeping_bag_armor: (c) => { rect(c, 9, 5, 14, 22, [96, 168, 92]); rect(c, 9, 5, 14, 3, GREEN_D); rect(c, 9, 24, 14, 3, GREEN_D); line(c, 15, 5, 15, 27, GRAY_D); px(c, 18, 10, WHITE); px(c, 18, 16, GOLD); px(c, 12, 20, WHITE); rect(c, 9, 12, 14, 1, [120, 190, 110]); },
  radio_exercise_charm: (c) => { rect(c, 7, 12, 18, 12, [52, 58, 66]); rect(c, 7, 12, 18, 2, GRAY_D); px(c, 11, 17, GOLD); px(c, 13, 17, GOLD); px(c, 15, 17, GOLD); px(c, 18, 17, WHITE); px(c, 20, 17, WHITE); line(c, 22, 12, 27, 4, METAL_D); px(c, 27, 3, GOLD); px(c, 10, 9, RED2); px(c, 13, 7, RED2); px(c, 16, 9, RED2); },
  midnight_convenience_charm: (c) => { rect(c, 6, 10, 20, 16, BLUE); rect(c, 6, 10, 20, 3, GOLD); rect(c, 10, 18, 5, 8, WHITE); rect(c, 17, 18, 5, 8, WHITE); rect(c, 6, 26, 20, 2, METAL_D); px(c, 12, 13, WHITE); px(c, 20, 13, WHITE); px(c, 16, 7, GOLD); px(c, 8, 4, WHITE); px(c, 22, 5, WHITE); },
  // 季節限定のお守り（ロードマップ7）。アイコンは既存の32x32ドット絵パターンで描く。
  spring_sprout_charm: (c) => { line(c, 16, 26, 16, 12, GREEN_D); line(c, 16, 18, 9, 11, GREEN); line(c, 16, 18, 23, 11, GREEN); px(c, 8, 10, GREEN); px(c, 10, 9, GREEN); px(c, 22, 10, GREEN); px(c, 24, 9, GREEN); px(c, 16, 9, GREEN); px(c, 15, 8, GREEN); px(c, 17, 8, GREEN); rect(c, 12, 26, 8, 3, BROWN); },
  summer_lantern_charm: (c) => { rect(c, 11, 4, 10, 3, GOLD); rect(c, 8, 7, 16, 16, RED2); rect(c, 8, 7, 16, 2, [226, 96, 84]); rect(c, 8, 13, 16, 2, [226, 96, 84]); rect(c, 8, 19, 16, 2, [226, 96, 84]); rect(c, 11, 23, 10, 3, GOLD); px(c, 13, 10, GOLD); px(c, 18, 16, GOLD); px(c, 15, 11, WHITE); line(c, 16, 4, 16, 2, GRAY_D); },
  autumn_harvest_charm: (c) => { for (let y = 10; y <= 25; y++) for (let x = 9; x <= 22; x++) { const d = Math.hypot(x - 15.5, y - 17.5); if (d <= 7.5) px(c, x, y, BROWN); } rect(c, 9, 10, 14, 4, [120, 80, 50]); px(c, 13, 8, GREEN); px(c, 18, 7, GREEN); px(c, 15, 6, GREEN); px(c, 12, 15, [220, 180, 140]); px(c, 19, 20, [220, 180, 140]); },
  winter_lamp_charm: (c) => { rect(c, 12, 6, 8, 4, GOLD); rect(c, 10, 10, 12, 14, [250, 220, 140]); rect(c, 10, 10, 12, 2, GOLD); rect(c, 10, 22, 12, 2, GOLD); px(c, 16, 14, WHITE); px(c, 14, 17, WHITE); px(c, 18, 17, WHITE); line(c, 16, 6, 16, 3, GRAY_D); px(c, 8, 12, GOLD); px(c, 24, 12, GOLD); px(c, 6, 16, GOLD); px(c, 26, 16, GOLD); },
};
for (const [id, draw] of Object.entries(EQUIP_ICON_BUILDERS)) saveSingle(iconCanvas(draw), `equip-${id}.png`);
saveSingle(iconCanvas((c) => { rect(c, 10, 10, 12, 12, GRAY); rect(c, 10, 10, 12, 2, GRAY_D); px(c, 15, 15, WHITE); px(c, 16, 15, WHITE); px(c, 15, 16, WHITE); }), 'equip-fallback.png');
// ---------- treasure chest (48x48, 6 frames) — AI生成GIFからの作り直し ----------
function chestFrame(f) {
  const c = canvas(48, 48);
  const WD = WOOD_D, W = WOOD, BAND = GOLD, BAND_D = [184, 128, 30], DARK = [40, 30, 22, 255];
  const glow = f >= 3;
  // 本体
  rect(c, 10, 24, 28, 16, W);
  rect(c, 10, 24, 28, 2, WD); rect(c, 10, 38, 28, 2, WD);
  rect(c, 10, 24, 3, 16, WD); rect(c, 35, 24, 3, 16, WD);
  rect(c, 22, 24, 4, 16, BAND_D);
  if (glow) { // 内側の光とコインの山
    rect(c, 12, 20, 24, 4, [255, 214, 110]);
    rect(c, 15, 17, 18, 3, [255, 226, 140]);
    px(c, 17, 16, GOLD); px(c, 24, 15, GOLD); px(c, 30, 16, GOLD); px(c, 20, 18, [255, 240, 190]); px(c, 28, 18, [255, 240, 190]);
  } else if (f > 0) {
    rect(c, 12, 22, 24, 2, DARK);
  }
  // 蓋（開くにつれて上へ持ち上がり、最後は後ろに倒れる）
  if (f === 0) {
    rect(c, 10, 15, 28, 9, W); rect(c, 13, 12, 22, 4, W); rect(c, 10, 15, 28, 2, [150, 108, 62]);
    rect(c, 10, 22, 28, 2, WD); rect(c, 22, 12, 4, 12, BAND_D);
    rect(c, 21, 22, 6, 7, BAND); px(c, 23, 25, DARK); px(c, 24, 25, DARK);
  } else if (f === 1) {
    rect(c, 10, 12, 28, 8, W); rect(c, 13, 9, 22, 4, W); rect(c, 10, 18, 28, 2, WD); rect(c, 22, 9, 4, 11, BAND_D);
  } else if (f === 2) {
    rect(c, 11, 6, 26, 7, W); rect(c, 11, 6, 26, 2, [150, 108, 62]); rect(c, 22, 6, 4, 7, BAND_D);
    rect(c, 12, 14, 24, 2, DARK);
  } else {
    // 開いた蓋: 本体の上に薄く倒れた状態
    rect(c, 11, 8, 26, 5, W); rect(c, 11, 8, 26, 2, [150, 108, 62]); rect(c, 22, 8, 4, 5, BAND_D);
    rect(c, 13, 14, 22, 3, WD);
  }
  if (f === 4) { px(c, 8, 12, GOLD); px(c, 40, 10, GOLD); px(c, 24, 6, [255, 240, 190]); px(c, 14, 8, [255, 240, 190]); }
  if (f === 5) {
    for (const [x, y] of [[6, 8], [41, 6], [24, 3], [12, 4], [36, 12], [18, 8]]) { px(c, x, y, [255, 244, 200]); px(c, x - 1, y, GOLD); px(c, x + 1, y, GOLD); px(c, x, y - 1, GOLD); px(c, x, y + 1, GOLD); }
  }
  return c;
}
saveSheet([0, 1, 2, 3, 4, 5].map(chestFrame), 'chest-open-sheet.png');
saveSingle(chestFrame(0), 'chest-closed.png');
console.log('done');
