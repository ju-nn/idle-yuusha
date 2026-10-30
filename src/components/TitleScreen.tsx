import { useEffect, useMemo, useState } from 'react';
import { SCENE_ART } from '../assets/sceneArt';
import { APP_VERSION } from '../game/state';
import { Icon } from './Icon';

// ロード中のワンポイント。勇者の生活感が一読で伝わるものだけを置く（AGENTS.mdの文体ルール準拠）。
const LOADING_TIPS = [
  '勇者は布団の中で待機しています',
  '猫が先にソファを確保しました',
  '今日の生活費を数えています',
  '魔王より先に、家賃の心配をしています',
  '冷めたコーヒーを温め直しています',
];

// ロード表示の長さ。実ロードは済んでいる前提の「顔見せ」なので短く、タップで即スキップできる。
const LOADING_MS = 900;
const LEAVE_MS = 280;

type Phase = 'loading' | 'title' | 'leaving';

export function TitleScreen({ hasSave, onFinish, onOpenSettings }: { hasSave: boolean; onFinish: () => void; onOpenSettings: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const tip = useMemo(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)], []);
  // キーアートは既存の仕事シーンイラスト（休憩＝勇者と猫のいる部屋）を流用する。新規生成はしない。
  const art = SCENE_ART.rest || SCENE_ART.fishing;

  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = window.setTimeout(() => setPhase('title'), LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const start = () => {
    if (phase !== 'title') return;
    setPhase('leaving');
    window.setTimeout(onFinish, LEAVE_MS);
  };

  useEffect(() => {
    if (phase !== 'title') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // start は phase だけに依存する。effect の張り直しは phase 変化時のみで十分。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div
      className={`titleScreen ${phase === 'leaving' ? 'leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="タイトル画面"
      onPointerDown={() => { if (phase === 'loading') setPhase('title'); }}
    >
      <img className="titleArt" src={art} alt="" draggable={false} />
      <div className="titleShade" aria-hidden="true" />
      <div className="titleContent">
        <span className="titleKicker"><Icon name="home" /> 生活防衛RPG</span>
        <p className="titleLogo">勇者は<br />働きたくない<span className="titleLogoDot">。</span></p>
        <p className="titleTagline">魔王討伐より、まず今日を回す。</p>
        {phase === 'loading' ? (
          <div className="titleLoading" aria-live="polite">
            <div className="titleProgress" aria-hidden="true"><i /></div>
            <p className="titleTip">{tip}</p>
            <small className="titleSkipHint">タップでスキップ</small>
          </div>
        ) : (
          <div className="titleActions">
            <button type="button" className="primary titleStart" onClick={start} autoFocus>{hasSave ? 'つづきから' : 'はじめから'}</button>
            <button type="button" className="titleSettingsButton" onClick={onOpenSettings}><Icon name="settings" /> 設定</button>
            {hasSave && <p className="titleSaveNote">セーブデータを読み込みました</p>}
          </div>
        )}
      </div>
      <div className="titleFooter"><span>Ver {APP_VERSION}</span><span>© 2026 ju-nn</span></div>
    </div>
  );
}
