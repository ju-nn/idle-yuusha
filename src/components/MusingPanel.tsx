import { useMemo } from 'react';
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
  const isUnlock = activeMusing?.eventSubType === 'unlock' || (activeMusing?.eventType as string | undefined) === 'unlock';

  if (isUnlock) {
    return <div className="unlockModal"><div className="unlockModalContent"><p className="unlockKicker"><Icon name="key" /> Story Gate</p><h2>新しい仕事が解禁されました</h2><p className="unlockJobName">{activeMusing?.job}</p><p className="unlockText">{displayText}</p>{hasReward && <p className="reward">出来事で手に入った：{rewardText(activeMusing?.rewardItems)}</p>}<button className="primary" onClick={advanceMusing}><Icon name="play" /> 読み終えた</button></div></div>;
  }

  return <Card tone="musing"><div className="musingTop"><div className="musingMeta"><span><Icon name="message" /> ぼやきノベル</span><span>{activeMusing ? activeMusing.job : '勇者'}</span><span>{activeMusing ? activeMusing.area : '作業中'}</span><span>収集 {musingCount}/{totalMusings}</span>{unreadCount > 0 && <span className="unreadPill">未読 {unreadCount}</span>}</div><button className="primary musingNext" onClick={advanceMusing} disabled={!canAdvance}><Icon name="play" /> 次へ{unreadCount > 0 && <b className="buttonBadge">{unreadCount}</b>}</button></div><p className="musingText" key={displayText}>{displayText}</p>{hasReward && <p className="reward">出来事で手に入った：{rewardText(activeMusing?.rewardItems)}</p>}</Card>;
}
