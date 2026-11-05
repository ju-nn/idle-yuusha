// シーンイラストの統合エントリ。既存の sceneArt.ts（12仕事）と
// 新規仕事ぶんの sceneArtExtra.ts をマージして SCENE_ART として提供します。
// コンポーネントは従来どおり SCENE_ART を import するだけで全仕事の絵が使えます。
import { SCENE_ART as BASE_SCENE_ART } from './sceneArt';
import { SCENE_ART_EXTRA } from './sceneArtExtra';

export const SCENE_ART: Record<string, string> = {
  ...BASE_SCENE_ART,
  ...SCENE_ART_EXTRA,
};
