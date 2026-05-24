import { jobs } from '../data/gameData';
import { isJobUnlocked } from '../game/requirements';
import type { GameState, Job } from '../types';
import { Icon, JobIcon } from './Icon';

export function JobMenu({ state, selectJob }: { state: GameState; selectJob: (key: string) => void }) {
  return <section className="jobMenuPanel"><div className="panelTitle"><h2>仕事</h2><small>今の収入源</small></div>{Object.entries(jobs).map(([key, job]) => <JobButton key={key} id={key} job={job} state={state} selectJob={selectJob} />)}</section>;
}

function JobButton({ id, job, state, selectJob }: { id: string; job: Job; state: GameState; selectJob: (key: string) => void }) {
  const unlocked = isJobUnlocked(id, state);
  const active = id === state.activeJob;
  const data = state.jobData[id] || { level: 1 };
  return <button onClick={() => selectJob(id)} disabled={!unlocked} className={`jobButton ${active ? 'active' : ''}`}>{unlocked ? <span className="jobIcon"><JobIcon id={id} /></span> : <span className="jobIcon"><Icon name="lock" /></span>}<span className="jobButtonText"><b>{unlocked ? job.name : '？？？'}</b><small>{unlocked ? `${job.type} / Lv.${data.level}` : '未解禁'}</small></span>{active && unlocked && <span className="badge">進行中</span>}</button>;
}
