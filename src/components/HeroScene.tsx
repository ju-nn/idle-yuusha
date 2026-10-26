import { useEffect, useState } from 'react';
import { SCENE_ART } from '../assets/sceneArt';

// シーン表示は 2026-10-27 の方針転換で、プログラム生成スプライトの合成から
// ドット絵風イラスト（静止画）へ置き換えた。キャラクターのアニメーションは行わない。
// 時間帯の色調変化だけは CSS の shade オーバーレイで残す。

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

export function HeroScene({ jobId }: { jobId: string }) {
  const tod = useTimePhase();
  const art = SCENE_ART[jobId] || SCENE_ART.fishing;
  return (
    <div className={`heroScene job-${jobId} tod-${tod}`} aria-hidden="true">
      <img className="sceneArt" src={art} alt="" draggable={false} />
      {tod === 'night' && <div className="sceneStars" />}
      <div className="sceneShade" />
    </div>
  );
}
