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
const MONSTER_BUILDERS = {
  slime: monsterSlime, goblin: monsterGoblin, wolf: monsterWolf, rust_armor: monsterRustArmor,
  bill_wraith: monsterBillWraith, tax_mimic: monsterTaxMimic, quiet_king: monsterQuietKing,
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
