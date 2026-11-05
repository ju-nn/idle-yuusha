import { jobs } from '../data/gameData';
import { describeRequirement, isJobUnlocked } from '../game/requirements';
import { getChainForJob, getChainHintForJob } from '../game/synergy';
import { countOwnedUpgrades, getWorkSpeedMultiplier } from '../game/timing';
import type { GameState, Job } from '../types';
import { Icon } from './Icon';
import { SCENE_ART } from '../assets/sceneArtAll';

export function JobMenu({ state, selectJob }: { state: GameState; selectJob: (key: string) => void }) {
  return <section className="jobMenuPanel" aria-label="仕事選択"><div className="panelTitle"><h2>仕事</h2><small>選んで切替</small></div><div className="jobList">{Object.entries(jobs).map(([key, job]) => <JobButton key={key} id={key} job={job} state={state} selectJob={selectJob} />)}</div></section>;
}

function JobButton({ id, job, state, selectJob }: { id: string; job: Job; state: GameState; selectJob: (key: string) => void }) {
  const unlocked = isJobUnlocked(id, state);
  const active = id === state.activeJob;
  const data = state.jobData[id] || { level: 1 };
  const unlockHint = getUnlockHint(job, state);
  // 選択時点の比較：この仕事の基礎速度と、現在作業中の仕事の基礎速度を並べる。
  // 基礎速度はレベル＋拠点整備だけの倍率で、装備・永続強化は含まない（統計画面と同じ定義）。
  const baseSpeed = getWorkSpeedMultiplier(data.level, countOwnedUpgrades(job.upgrades.map((u) => u.id), state.items || {}));
  const activeJob = jobs[state.activeJob];
  const activeData = state.jobData[state.activeJob] || { level: 1 };
  const activeSpeed = activeJob
    ? getWorkSpeedMultiplier(activeData.level, countOwnedUpgrades(activeJob.upgrades.map((u) => u.id), state.items || {}))
    : 1;
  const compare = unlocked && !active && activeJob
    ? ` / 基礎速度：現在 ${activeJob.name} x${activeSpeed.toFixed(2)} → この仕事 x${baseSpeed.toFixed(2)}`
    : '';
  // 連鎖ヒント：この仕事を育てると、別の仕事が強くなる。未解禁の仕事には出さない。
  const chain = unlocked ? getChainForJob(state, id) : undefined;
  const chainHint = unlocked ? getChainHintForJob(state, id) : null;
  const chainTitle = chain ? ` / 連鎖：${chain.label}（${chain.active || chain.inactive}）` : '';
  const title = unlocked ? `${job.name} Lv.${data.level}：${job.description}${compare}${chainTitle}` : `${job.name}の解禁条件：${unlockHint}`;
  return <button onClick={() => selectJob(id)} disabled={!unlocked} className={`jobButton ${active ? 'active' : ''}`} aria-pressed={active} title={title}>{unlocked && SCENE_ART[id] ? <img className="jobArt" src={SCENE_ART[id]} alt="" aria-hidden="true" draggable={false} /> : <span className="jobIcon"><Icon name="lock" /></span>}<span className="jobButtonText"><b>{unlocked ? job.name : '？？？'}</b><small>{unlocked ? `Lv.${data.level}${chainHint ? ` · ${chainHint}` : ''}` : unlockHint}</small></span>{active && unlocked && <span className="badge">中</span>}</button>;
}

function getUnlockHint(job: Job, state: GameState) {
  // アイテム条件は「必要 0/1」ではなくアイテム名まで出す（例: 休む許可を手に入れると解禁）。
  return describeRequirement(job.unlock, state);
}
