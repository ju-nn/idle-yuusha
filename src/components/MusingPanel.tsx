import { useEffect, useMemo } from 'react';
import { rewardText } from '../game/formatters';
import type { GameState } from '../types';
import { Icon } from './Icon';
import { Card } from './shared';

const idleMusingTexts = [
  '勇者は静かに仕事をしている。珍しく文句がない。たぶん、集中している。',
  '勇者は黙々と手を動かしている。今ぼやくと、作業のリズムが崩れるらしい。',
  '勇者は無言で仕事中だ。やる気があるというより、今は言葉を節約している。',
  '勇者は静かに働いている。あとでまとめてぼやくための余力を残している。',
  '勇者は淡々と作業している。平和な沈黙も、たまには進捗になる。',
];

export function MusingPanel({ state, totalMusings, musingCount, canAdvance, advanceMusing }: { state: GameState; totalMusings: number; musingCount: number; canAdvance: boolean; advanceMusing: () => void }) {
  const idleText = useMemo(() => idleMusingTexts[Math.floor(Math.random() * idleMusingTexts.length)], [canAdvance, musingCount]);
  const activeMusing = state.currentMusing && !state.currentMusing.readAt ? state.currentMusing : state.musingQueue[0];
  const displayText = activeMusing ? activeMusing.text : idleText;
  const unreadCount = state.musingQueue.length;
  const hasReward = Boolean(activeMusing?.rewardItems?.length);
  const isJobUnlock = Boolean(activeMusing?.id?.startsWith('job-unlock-'));
  const unlockPreview = displayText.length > 220 ? `${displayText.slice(0, 220).trim()}...` : displayText;

  useEffect(() => {
    if (!isJobUnlock) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isJobUnlock]);

  if (isJobUnlock) {
    return <div className="unlockModal" role="dialog" aria-modal="true" aria-labelledby="unlockTitle"><div className="unlockModalContent"><div className="unlockHero"><span className="unlockKicker"><Icon name="key" /> 仕事解禁</span><h2 id="unlockTitle">新しい生活ルートが増えました</h2><p className="unlockJobName">{activeMusing?.job}</p></div><p className="unlockText">{unlockPreview}</p>{hasReward && <p className="reward">出来事で手に入った：{rewardText(activeMusing?.rewardItems)}</p>}<button className="primary" onClick={advanceMusing}><Icon name="play" /> 確認する</button></div></div>;
  }

  return <Card tone="musing"><div className="musingTop"><div className="musingMeta"><span><Icon name="message" /> ぼやきノベル</span><span>{activeMusing ? activeMusing.job : '勇者'}</span><span>{activeMusing ? activeMusing.area : '作業中'}</span><span>収集 {musingCount}/{totalMusings}</span>{unreadCount > 0 && <span className="unreadPill">未読 {unreadCount}</span>}</div><button className="primary musingNext" onClick={advanceMusing} disabled={!canAdvance}><Icon name="play" /> 次へ{unreadCount > 0 && <b className="buttonBadge">{unreadCount}</b>}</button></div><p className="musingText" key={displayText}>{displayText}</p>{hasReward && <p className="reward">出来事で手に入った：{rewardText(activeMusing?.rewardItems)}</p>}</Card>;
}
