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
{
  const c = canvas(64, 32);
  const W = [255, 255, 255, 235];
  rect(c, 10, 18, 44, 8, W);
  rect(c, 16, 12, 18, 8, W);
  rect(c, 30, 8, 16, 12, W);
  rect(c, 42, 14, 12, 6, W);
  rect(c, 14, 24, 38, 2, [240, 246, 250, 235]);
  saveSingle(c, 'cloud.png');
}
{
  const c = canvas(16, 16);
  const G = [96, 168, 92], Gd = [64, 128, 62];
  const pts = [[8, 1], [10, 3], [11, 5], [11, 8], [9, 11], [6, 13], [4, 12], [3, 9], [3, 6], [5, 3]];
  pts.forEach(([x, y]) => px(c, x, y, G));
  [[9, 4], [10, 6], [9, 9], [7, 11], [5, 9], [5, 6], [7, 6], [8, 8]].forEach(([x, y]) => px(c, x, y, G));
  line(c, 4, 13, 10, 4, Gd);
  saveSingle(c, 'leaf.png');
}
console.log('done');
