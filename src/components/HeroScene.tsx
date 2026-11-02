import { useEffect, useState } from 'react';
import { SCENE_ART } from '../assets/sceneArt';

// シーン表示は 2026-10-27 の方針転換で、プログラム生成スプライトの合成から
// ドット絵風イラスト（静止画）へ置き換えた。キャラクターのアニメーションは行わない。
// 時間帯の色調変化だけは CSS の shade オーバーレイで残す。
//
// 2026-11-02 ユーザー実機指摘「画像が途切れて絵が途切れまくり。絵のパターン少ない」への対応:
// - イラスト（960x640 = 3:2）を細長いバナー枠に cover で流し込むと、スマホで約45%・
//   PCでは約19%しか縦が見えず、勇者の頭や足が切れていた。枠を原画と同じ 3:2 にして
//   全体がそのまま見えるようにした（styles.css の .heroScene）。
// - エリアごとに色調バリエーション（artVar0〜4）とエリア名チップを付け、
//   同じ仕事でも行き先で絵の見え方が変わるようにした（パターン不足の緩和）。

// ---------- 時間帯 ----------
type TimePhase = 'morning' | 'day' | 'dusk' | 'night';
function phaseForHour(hour: number): TimePhase {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'dusk';
  return 'night';
}
function useTimePhase(): TimePhase {
  const [phase, setPhase] = useState<TimePhase>(() => phaseForHour(new Date().getHours()));
  useEffect(() => {
    const timer = window.setInterval(() => setPhase(phaseForHour(new Date().getHours())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return phase;
}

export function HeroScene({ jobId, areaName, areaIndex = 0 }: { jobId: string; areaName?: string; areaIndex?: number }) {
  const tod = useTimePhase();
  const art = SCENE_ART[jobId] || SCENE_ART.fishing;
  const variant = ((areaIndex % 5) + 5) % 5;
  return (
    <div className={`heroScene job-${jobId} tod-${tod}`} aria-hidden="true">
      <img className={`sceneArt artVar${variant}`} src={art} alt="" draggable={false} />
      {tod === 'night' && <div className="sceneStars" />}
      <div className="sceneShade" />
      {areaName && <span className="sceneAreaChip">{areaName}</span>}
    </div>
  );
}
