import { jobs } from '../data/gameData';
import { isJobUnlocked } from '../game/requirements';
import type { GameState, Job } from '../types';
import { Icon, JobIcon } from './Icon';

export function JobMenu({ state, selectJob }: { state: GameState; selectJob: (key: string) => void }) {
  return <section className="jobMenuPanel" aria-label="仕事選択"><div className="panelTitle"><h2>仕事</h2><small>クリックで切替</small></div><div className="jobList">{Object.entries(jobs).map(([key, job]) => <JobButton key={key} id={key} job={job} state={state} selectJob={selectJob} />)}</div></section>;
}

function JobButton({ id, job, state, selectJob }: { id: string; job: Job; state: GameState; selectJob: (key: string) => void }) {
  const unlocked = isJobUnlocked(id, state);
  const active = id === state.activeJob;
  const data = state.jobData[id] || { level: 1 };
  const unlockHint = getUnlockHint(job, state);
  const title = unlocked ? `${job.name} Lv.${data.level}：${job.description}` : `${job.name}の解禁条件：${unlockHint}`;
  return <button onClick={() => selectJob(id)} disabled={!unlocked} className={`jobButton ${active ? 'active' : ''}`} aria-pressed={active} title={title}>{unlocked ? <span className="jobIcon"><JobIcon id={id} /></span> : <span className="jobIcon"><Icon name="lock" /></span>}<span className="jobButtonText"><b>{unlocked ? job.name : '？？？'}</b><small>{unlocked ? `Lv.${data.level}` : unlockHint}</small></span>{active && unlocked && <span className="badge">中</span>}</button>;
}

function getUnlockHint(job: Job, state: GameState) {
  const unlock = job.unlock;
  if (!unlock || unlock.type === 'start') return '最初から';
  if (unlock.type === 'jobLevel') {
    const level = state.jobData[unlock.job]?.level || 1;
    const name = jobs[unlock.job]?.name || unlock.job;
    return `${name}Lv${level}/${unlock.level}`;
  }
  if (unlock.type === 'item') {
    const count = state.items[unlock.item] || 0;
    return `必要 ${count}/${unlock.amount}`;
  }
  return '未解禁';
}
