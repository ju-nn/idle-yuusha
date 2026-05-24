import { ACHIEVEMENTS, itemDesc, itemKind, itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import { getJobDropItems } from '../game/collection';
import { MUSING_LABELS } from '../game/musings';
import { isJobUnlocked } from '../game/requirements';
import type { GameState, Job, Musing } from '../types';
import { Icon } from './Icon';
import { Card, Modal } from './shared';

export function LogModal({ logs, onClose }: { logs: string[]; onClose: () => void }) {
  return <Modal title="作業ログ" description="最新の作業結果を確認する。" onClose={onClose}><div className="logList">{logs.map((log, index) => <p key={`${log}-${index}`} className={index === 0 ? 'freshLog' : ''}>{log}</p>)}</div></Modal>;
}

export function CollectionModal({ state, musings, achievements, onClose }: { state: GameState; musings: Musing[]; achievements: string[]; onClose: () => void }) {
  return <Modal title="図鑑" description="発見物・ぼやき・実績をまとめて確認する。" onClose={onClose} wide><CollectionSummary state={state} musings={musings} achievements={achievements} /><div className="bookGrid"><DiscoveryBook state={state} /><MusingBook musings={musings} /><AchievementBook achievements={achievements} /></div></Modal>;
}

export function SettingsModal({ onClose, reset }: { onClose: () => void; reset: () => void }) {
  return <Modal title="設定" description="音と表示、セーブ周りの設定。" onClose={onClose}><div className="settingsPanel"><SettingSlider icon="volume" label="BGM" value={60} /><SettingSlider icon="sliders" label="SE" value={75} /><div className="settingRow"><div><b>テキスト速度</b><p>ぼやきの表示演出の速さ。</p></div><div className="settingChoices"><button className="active">標準</button><button>速い</button></div></div><div className="dangerZone"><div><b>最初からやり直す</b><p>セーブデータを消して、勇者の労働生活を巻き戻す。</p></div><button onClick={reset}><Icon name="reset" /> リセット</button></div></div></Modal>;
}

function SettingSlider({ icon, label, value }: { icon: 'volume' | 'sliders'; label: string; value: number }) {
  return <label className="settingSlider"><span><Icon name={icon} /> {label}</span><input type="range" min="0" max="100" defaultValue={value} /><b>{value}%</b></label>;
}

function CollectionSummary({ state, musings, achievements }: { state: GameState; musings: Musing[]; achievements: string[] }) {
  const itemIds = Array.from(new Set(Object.keys(jobs).flatMap((jobKey) => getJobDropItems(jobKey))));
  const foundItems = itemIds.filter((id) => (state.items[id] || 0) > 0).length;
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;
  const unlockedJobs = Object.entries(jobs).filter(([jobKey]) => isJobUnlocked(jobKey, state)).length;
  const totalJobs = Object.keys(jobs).length;
  const ownedUpgrades = Object.values(jobs).flatMap((job) => job.upgrades).filter((upgrade) => state.items[upgrade.id]).length;
  const totalUpgrades = Object.values(jobs).reduce((sum, job) => sum + job.upgrades.length, 0);
  return <div className="collectionSummary"><SummaryPill label="発見物" value={`${foundItems}/${itemIds.length}`} /><SummaryPill label="ぼやき" value={`${musings.length}`} /><SummaryPill label="実績" value={`${achievements.length}/${totalAchievements}`} /><SummaryPill label="仕事" value={`${unlockedJobs}/${totalJobs}`} /><SummaryPill label="拠点整備" value={`${ownedUpgrades}/${totalUpgrades}`} /></div>;
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return <div className="summaryPill"><span>{label}</span><b>{value}</b></div>;
}

function DiscoveryBook({ state }: { state: GameState }) {
  return <Card title="発見物"><p className="sub">未発見は？？？。★は重要アイテム。</p>{Object.entries(jobs).map(([jobKey, job]) => <DiscoverySection key={jobKey} jobKey={jobKey} job={job} state={state} />)}</Card>;
}

function DiscoverySection({ jobKey, job, state }: { jobKey: string; job: Job; state: GameState }) {
  const allItems = getJobDropItems(jobKey);
  const found = allItems.filter((id) => (state.items[id] || 0) > 0);
  return <div className="discoverSection"><div><b>{isJobUnlocked(jobKey, state) ? job.name : '？？？'}</b><span>{found.length}/{allItems.length}</span></div>{allItems.map((id) => <DiscoveryItem key={id} id={id} count={state.items[id] || 0} />)}</div>;
}

function DiscoveryItem({ id, count }: { id: string; count: number }) {
  const found = count > 0;
  return <p className={`discoverItem ${found ? '' : 'unknown'}`} title={found ? itemDesc(id) : 'まだ見つけていない'}><span>{itemKind(id) === '重要' && <Icon name="key" />} {found ? itemName(id) : '？？？'}</span><b>{found ? count : '—'}</b></p>;
}

function MusingBook({ musings }: { musings: Musing[] }) {
  return <Card title="ぼやき図鑑"><p className="sub">読んだぼやきの本文と種類が残る。</p>{musings.length === 0 ? <p className="sub">まだ記録がない。</p> : musings.map((m, i) => <div className="musingArchive" key={`${m.text}-${i}`}><small>{m.eventType ? (MUSING_LABELS[m.eventType] || '出来事') : '出来事'} / {m.job} / {m.area}</small><p>{m.text}</p></div>)}</Card>;
}

function AchievementBook({ achievements }: { achievements: string[] }) {
  return <Card title="実績"><p className="sub">ユーモア寄りの節目。性能というより、勇者の人生ログ。</p>{Object.entries(ACHIEVEMENTS).map(([id, a]) => { const unlocked = achievements.includes(id); return <div className={`achievement ${unlocked ? 'unlocked' : ''}`} key={id}><b>{unlocked ? a.name : '？？？'}</b><p>{unlocked ? a.description : 'まだその瞬間は来ていない。来ないなら来ないで平和。'}</p></div>; })}</Card>;
}
