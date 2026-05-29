import { useEffect, useState } from 'react';
import { describeUpgradeEffects, formatResourceName } from '../game/formatters';
import { CROPS, formatFarmDuration, getCropRewards, getFarmingProgress, type CropId } from '../game/farming';
import { getAdventureEntryCost } from '../game/equipment';
import { rewardText } from '../game/formatters';
import { getFailChance, xpToNext } from '../game/progression';
import { isAreaUnlocked, isJobUnlocked } from '../game/requirements';
import { countOwnedUpgrades, GAME_SPEED_DIVISOR, getEffectiveDurationTicksForState } from '../game/timing';
import type { Area, GameState, Job, ResourceKey, Upgrade } from '../types';
import { Icon, JobIcon } from './Icon';
import { Card } from './shared';

export function CurrentJobCard(props: { job: Job; area: Area; data: { level: number; xp: number }; progress: number; speedMultiplier: number; effectiveDurationTicks: number; latestLog: string; openLog: () => void; openAreas?: () => void; openUpgrades?: () => void; farmingReady: boolean; state: GameState; plantCrop: (cropId: CropId) => void; harvestCrop: () => void; selectArea: (id: string) => void; buyUpgrade: (u: Upgrade) => void }) {
  const { job, area, data, progress, speedMultiplier, effectiveDurationTicks, latestLog, openLog, openAreas, openUpgrades, farmingReady, state, plantCrop, harvestCrop, selectArea, buyUpgrade } = props;
  const combat = job.type === 'combat';
  const showsBattleLog = job.type === 'combat' || job.type === 'adventure';
  const breaking = state.progressBreaking || false;
  return <Card tone={combat ? 'combat jobCard' : 'jobCard'}><div className="jobHeader"><div><small>現在の仕事</small><h2><JobIcon id={state.activeJob} /> {job.name}</h2><p>{job.description}</p><button className="latestLog" onClick={openLog}><span>最新ログ</span><span className="logText">{latestLog}</span></button></div><div className="levelBox"><small>仕事Lv</small><b>{data.level}</b></div></div><ComboStrip state={state} job={job} />{job.type === 'farming' ? <FarmingBox state={state} ready={farmingReady} plantCrop={plantCrop} harvestCrop={harvestCrop} /> : showsBattleLog ? <CombatBox area={area} data={data} progress={progress} combatLog={state.combatLog || []} breaking={breaking} speedMultiplier={speedMultiplier} effectiveDurationTicks={effectiveDurationTicks} isAdventure={job.type === 'adventure'} adventureCost={getAdventureEntryCost(state, area.adventureCost || 0)} /> : <ProgressBox area={area} data={data} progress={progress} breaking={breaking} job={job} ownedItems={state.items} speedMultiplier={speedMultiplier} effectiveDurationTicks={effectiveDurationTicks} />}<div className="jobDetailGrid"><div className="areaSection"><div className="sectionHead"><h3>仕事エリア</h3>{openAreas && <button onClick={openAreas}>一覧</button>}</div><AreaGrid job={job} state={state} selectArea={selectArea} compact /></div><div className="inlineUpgradeSection"><div className="sectionHead"><h3>拠点整備</h3>{openUpgrades && <button onClick={openUpgrades}>一覧</button>}</div><InlineUpgradeList state={state} job={job} buyUpgrade={buyUpgrade} /></div></div></Card>;
}

function ComboStrip({ state, job }: { state: GameState; job: Job }) {
  const boons = state.combo?.boons || {};
  const entries = [
    boons.rested ? `よく休んだ x${boons.rested}` : '',
    boons.home_meal ? `収穫飯 x${boons.home_meal}` : '',
    boons.market_sense ? `相場勘 x${boons.market_sense}` : '',
    boons.daily_rhythm ? `生活リズム x${boons.daily_rhythm}` : '',
    (state.combo?.lastJob === state.activeJob && (state.combo?.streak || 0) >= 2) ? `${job.name}連続 ${state.combo?.streak}周` : '',
  ].filter(Boolean);
  if (!entries.length) return null;
  return <div className="comboStrip"><b>生活コンボ</b>{entries.map((entry) => <span key={entry}>{entry}</span>)}</div>;
}

function ProgressBox({ area, data, progress, breaking, job, ownedItems, speedMultiplier, effectiveDurationTicks }: { area: Area; data: { level: number; xp: number }; progress: number; breaking?: boolean; job?: Job; ownedItems?: Record<string, number>; speedMultiplier?: number; effectiveDurationTicks?: number }) {
  const effectiveFailChance = job && ownedItems ? getFailChance(area, job.upgrades, ownedItems) : (area.failChance ?? 0);
  const cycleSeconds = effectiveDurationTicks ? Math.ceil(effectiveDurationTicks / GAME_SPEED_DIVISOR) : area.seconds;
  return (
    <div>
      <div className="progressLabel">
        <span>{area.name} の進行</span>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {effectiveFailChance > 0 && <span className={`failBadge${breaking ? ' failBadge--break' : ''}`}>失敗率 {Math.round(effectiveFailChance * 100)}%</span>}
          {speedMultiplier && speedMultiplier > 1 && <span className="speedBadge">速度 x{speedMultiplier.toFixed(2)}</span>}
          {Math.floor(progress)}%
        </span>
      </div>
      <div className={`bar${breaking ? ' breaking' : ''}`}><div style={{ width: `${progress}%` }} /></div>
      <p className="sub">1周：約{cycleSeconds}秒 / 次のLvまで：{data.xp} / {xpToNext(data.level)} XP</p>
    </div>
  );
}

function CombatBox({ area, data, progress, combatLog, breaking, speedMultiplier, effectiveDurationTicks, isAdventure = false, adventureCost = 0 }: { area: Area; data: { level: number; xp: number }; progress: number; combatLog: string[]; breaking?: boolean; speedMultiplier: number; effectiveDurationTicks: number; isAdventure?: boolean; adventureCost?: number }) {
  return <div className="combatBox"><ProgressBox area={{ ...area, name: `${area.name} ${isAdventure ? '探索' : '戦闘'}` }} data={data} progress={progress} breaking={breaking} speedMultiplier={speedMultiplier} effectiveDurationTicks={effectiveDurationTicks} />{isAdventure && adventureCost > 0 && <p className="adventureCost">出発費 {adventureCost}G。稼いだGを使って、宝箱を探しに行きます。</p>}<div className="battleLog"><b>{isAdventure ? '探索・戦闘ログ' : '戦闘ログ'}</b>{combatLog.length === 0 ? <p>まだ戦っていない。勇者、準備運動だけは一流。</p> : combatLog.slice(0, 5).map((log, i) => <p key={`${log}-${i}`}>{log}</p>)}</div></div>;
}

function FarmingBox({ state, ready, plantCrop, harvestCrop }: { state: GameState; ready: boolean; plantCrop: (cropId: CropId) => void; harvestCrop: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const progress = getFarmingProgress(state.farming, now);
  const crop = CROPS[(state.farming.cropId || 'daikon') as CropId] || CROPS.daikon;
  const farmingLevel = state.jobData.farming?.level || 1;
  const harvestPreview = state.farming.readyAt ? getCropRewards((state.farming.cropId || 'daikon') as CropId, state.farming.readyAt, now) : null;
  return <div className="farmingBox"><p>農業は次のログインを少し楽しみにする枠。長く待つ作物ほど、収穫量と完熟おまけが増える。</p><div className="progressLabel"><span>{crop.name}の育成</span><span>{state.farming.plantedAt ? `${progress.percent}%` : '未植え'}</span></div><div className="bar"><div style={{ width: `${progress.percent}%` }} /></div><p className="sub">{state.farming.plantedAt ? (progress.ready ? `収穫できます。完熟おまけ ${harvestPreview?.bonusCount || 0}段階。` : `育成中。あと${formatFarmDuration(progress.remaining)}くらい。`) : 'まだ何も植えていない。'}</p>{harvestPreview && <p className="farmRewardPreview">収穫見込み：{rewardText(harvestPreview.rewards)}</p>}<div className="cropGrid">{(Object.entries(CROPS) as Array<[CropId, typeof CROPS[CropId]]>).map(([id, candidate]) => { const unlocked = farmingLevel >= candidate.unlockLevel; return <button key={id} className={id === state.farming.cropId ? 'active' : ''} onClick={() => plantCrop(id)} disabled={Boolean(state.farming.plantedAt) || !unlocked}><b>{unlocked ? candidate.name : '？？？'}</b><small>{unlocked ? `${formatFarmDuration(candidate.growthMs)} / ${rewardText(candidate.rewards)}` : `農業Lv${candidate.unlockLevel}`}</small></button>; })}</div><div className="row"><button onClick={harvestCrop} disabled={!ready}>収穫する</button></div></div>;
}

export function AreaGrid({ job, state, selectArea, compact = false }: { job: Job; state: GameState; selectArea: (id: string) => void; compact?: boolean }) {
  return <div className={`areaGrid ${compact ? 'compactAreaGrid' : ''}`}>{job.areas.map((area) => {
    const unlocked = isAreaUnlocked(state.activeJob, area, state);
    const active = area.id === state.activeArea;
    const effectiveFail = getFailChance(area, job.upgrades, state.items || {});
    const data = state.jobData[state.activeJob] || { level: 1, xp: 0, seenMusings: [] };
    const ownedUpgradeCount = countOwnedUpgrades(job.upgrades.map((u) => u.id), state.items || {});
    const effectiveSeconds = Math.ceil(getEffectiveDurationTicksForState(area.seconds, data.level, ownedUpgradeCount, state, state.activeJob) / GAME_SPEED_DIVISOR);
    const entryCost = getAdventureEntryCost(state, area.adventureCost || 0);
    return <button key={area.id} onClick={() => selectArea(area.id)} disabled={!unlocked} className={`area ${active ? 'active' : ''}`}><b>{unlocked ? <Icon name="mapPin" /> : <Icon name="lock" />} {area.name}</b><span>{unlocked ? `約${effectiveSeconds}s${entryCost ? ` / ${entryCost}G` : ''}` : `${area.seconds}s`}</span><p>{area.summary}</p>{unlocked && effectiveFail > 0 ? <small className="failRate">失敗率 {Math.round(effectiveFail * 100)}%</small> : <small>{!area.unlock || area.unlock.type === 'start' ? '最初から解禁' : '条件あり'}</small>}</button>;
  })}</div>;
}

export function UpgradePanel({ state, job, buyUpgrade, openUpgrades }: { state: GameState; job: Job; buyUpgrade: (u: typeof job.upgrades[number]) => void; openUpgrades?: () => void }) {
  const jobUnlocked = isJobUnlocked(state.activeJob, state);
  return <Card><div className="sectionHead"><h3>{job.name}の拠点整備</h3>{openUpgrades && <button onClick={openUpgrades}>一覧</button>}</div><div className="upgradeGrid">{job.upgrades.map((u) => <UpgradeCard key={u.id} upgrade={u} state={state} buyUpgrade={buyUpgrade} jobUnlocked={jobUnlocked} />)}</div></Card>;
}

function InlineUpgradeList({ state, job, buyUpgrade }: { state: GameState; job: Job; buyUpgrade: (u: Upgrade) => void }) {
  const jobUnlocked = isJobUnlocked(state.activeJob, state);
  const visible = job.upgrades.slice(0, 3);
  return <div className="inlineUpgradeList">{visible.map((u) => <UpgradeCard key={u.id} upgrade={u} state={state} buyUpgrade={buyUpgrade} jobUnlocked={jobUnlocked} compact />)}</div>;
}

function UpgradeCard({ upgrade: u, state, buyUpgrade, jobUnlocked, compact = false }: { upgrade: Upgrade; state: GameState; buyUpgrade: (u: Upgrade) => void; jobUnlocked: boolean; compact?: boolean }) {
  const owned = Boolean(state.items[u.id]);
  const hasResources = Object.entries(u.cost.resources).every(([key, value]) => (state.resources[key as ResourceKey] || 0) >= value);
  const canBuy = !owned && state.gold >= u.cost.gold && hasResources;
  const resourceCost = Object.entries(u.cost.resources).map(([key, value]) => `${formatResourceName(key)}${value}`).join(' / ');
  const jobLevel = state.jobData[state.activeJob]?.level || 1;
  const levelUnlocked = !u.level || jobLevel >= u.level;
  const goldRatio = u.cost.gold > 0 ? Math.min(1, state.gold / u.cost.gold) : 1;
  const resourceRatios = Object.entries(u.cost.resources).map(([key, value]) => value > 0 ? Math.min(1, (state.resources[key as ResourceKey] || 0) / value) : 1);
  const readyRatio = Math.floor(Math.min(goldRatio, ...resourceRatios, 1) * 100);
  const missing = [
    state.gold < u.cost.gold ? `${u.cost.gold - state.gold}G` : '',
    ...Object.entries(u.cost.resources).map(([key, value]) => {
      const shortage = value - (state.resources[key as ResourceKey] || 0);
      return shortage > 0 ? `${formatResourceName(key)}${shortage}` : '';
    }),
  ].filter(Boolean).join(' / ');
  
  if (!jobUnlocked || !levelUnlocked) {
    const levelGap = Math.max(0, (u.level || 1) - jobLevel);
    if (compact) {
      return <div className="upgrade compactUpgrade compactLocked"><div className="upgradeHead"><b><Icon name="lock" /> 整備候補</b><span>Lv{u.level || 1}</span></div><small className="compactRequirement">{levelGap > 0 ? `あとLv${levelGap}で解禁` : '条件確認中'}</small></div>;
    }
    return <div className={`upgrade ${compact ? 'compactUpgrade' : ''}`}><div className="upgradeHead"><b>？？？</b><span>？？？</span></div><p>？？？</p><p className="effect">強化：？？？</p><small>必要：仕事Lv{u.level || 1}以上{levelGap > 0 ? ` / あとLv${levelGap}` : ''}</small><button className="primary" disabled>導入する</button></div>;
  }
  
  const failReduction = u.effects.failReduction ? `失敗率-${Math.round(u.effects.failReduction * 100)}%` : null;
  return <div className={`upgrade ${owned ? 'owned' : ''} ${!owned && readyRatio >= 70 ? 'almost' : ''} ${compact ? 'compactUpgrade' : ''}`}><div className="upgradeHead"><b>{u.name}</b><span>{owned ? '導入済' : `${u.cost.gold}G`}</span></div><p>{u.description}</p><p className="effect">強化：{describeUpgradeEffects(u)}{failReduction && <span className="failReductionTag"> / {failReduction}</span>}</p><small>必要：{u.cost.gold}G{resourceCost ? ` / ${resourceCost}` : ''}</small>{!owned && <div className="buyProgress"><div><i style={{ width: `${readyRatio}%` }} /></div><span>{canBuy ? '今すぐ導入できます' : readyRatio >= 70 ? `あと少し：${missing}` : `準備 ${readyRatio}%`}</span></div>}<button className="primary" disabled={!canBuy} onClick={() => buyUpgrade(u)}>{owned ? '導入済' : '導入する'}</button></div>;
}
