// 長期バランスの価格曲線（ロードマップ8「数値バランスの長期化」）。
// クッキークリッカー移植原則(1): コスト側は単一指数に寄せ、収入側は
// 連鎖・特性・実績・転生の乗算の層として整理する。以前は永続強化の
// 段階コストが強化ごとに手書きの配列で、長期の見通しが立たなかった。
// 以後は全ての永続強化が同じ指数カーブ `base × RATIO^stage` で決まる。
// RATIO はひとつだけ。初段の base だけが強化ごとの個性になる。
// 旧セーブの取得済み段階はそのまま残り、次段以降の価格だけが新曲線になる。
export const PRESTIGE_COST_RATIO = 1.5;

// 段階コストの一覧を作る。stage は 0 始まりで、costs[stage] が
// 「今 stage 段持っている状態で次に買う段」の価格になる。
// 例: base 4 なら [4, 6, 9, 14, 20]（各段は前段の 1.5 倍を四捨五入）。
export function prestigeCostCurve(baseCost: number, maxStage: number, ratio: number = PRESTIGE_COST_RATIO): number[] {
  const costs: number[] = [];
  for (let stage = 0; stage < maxStage; stage += 1) {
    costs.push(Math.max(1, Math.round(baseCost * Math.pow(ratio, stage))));
  }
  return costs;
}
