import { useEffect, useMemo, useRef, useState } from 'react';
import ambientCloudUrl from './assets/sprites/hero/cloud.png';
import chestSheetUrl from './assets/sprites/hero/chest-open-sheet.png';
import { Header } from './components/Header';
import { Icon } from './components/Icon';
import { AreaGrid, CurrentJobCard, UpgradePanel } from './components/JobPanels';
import { JobMenu } from './components/JobMenu';
import { ChestModal, CollectionModal, EquipmentModal, LogModal, PrestigeModal, SettingsModal, StatsModal } from './components/Modals';
import { ItemSprite } from './components/GameIcon';
import { MusingPanel } from './components/MusingPanel';
import { TitleScreen } from './components/TitleScreen';
import { Card, Modal } from './components/shared';
import { ACHIEVEMENTS, itemName } from './data/catalog';
import { jobs } from './data/gameData';
import { advanceMusing, buyUpgrade, canClaimDailyBonus, claimDailyBonus, harvestCrop, plantCrop, selectArea, selectJob } from './game/actions';
import { playFeedbackSound, playUiSound } from './game/audio';
import { initBgm, setBgmAdventure } from './game/bgm';
import { getJobDropItems } from './game/collection';
import { EQUIPMENT_RARITY_LABELS, EQUIPMENT_SLOT_LABELS, equipItem, equipmentOptionText, getEquipmentBonus, openAllTreasureChests, openTreasureChest, sellEquipment, toggleEquipmentLock } from './game/equipment';
import type { CropId } from './game/farming';
import { formatResourceName } from './game/formatters';
import { loadUserSettings } from './game/settings';
import { clearSave, createInitialState, loadState, SAVE_KEY, saveState } from './game/state';
import { claimCatVisit, getCatBuffDef } from './game/companion';
import { getLifePlan, applyMilestoneAchievements } from './game/progression';
import { buyPrestigeUpgrade, buyRebirthUpgrade, getRebirthOfflineCapHours, rebirth, retire } from './game/prestige';
import { getActiveArea, isJobUnlocked } from './game/requirements';
import { runTick } from './game/tick';
import { getCurrentSeason } from './game/seasons';
import { claimWeeklyGoal, getWeeklySummary } from './game/weekly';
import { countOwnedUpgrades, getEffectiveDurationTicksForState, getWorkSpeedMultiplier, TICK_INTERVAL_MS } from './game/timing';
import { selectTrait } from './game/traits';
import type { EquipmentItem, GameState, TraitId } from './types';

const initialState = createInitialState(jobs);
const PROGRESS_STEP = 5;
const RESOURCE_LABELS = {
  fish: formatResourceName('fish'),
  wood: formatResourceName('wood'),
  ore: formatResourceName('ore'),
} as const;

type FloatingGain = {
  id: number;
  label: string;
  amount: number;
  kind: 'gold' | 'resource' | 'item';
  iconId?: string;
  x: number;
  y: number;
  delay: number;
};

type AchievementToast = {
  id: string;
  name: string;
  description: string;
};

type ChestReveal = {
  id: number;
  item: EquipmentItem;
  openedCount?: number;
  legendary?: boolean;
};

function steppedProgress(value: number) {
  return Math.floor(value / PROGRESS_STEP) * PROGRESS_STEP;
}

function snapshotGains(state: GameState) {
  return {
    gold: state.gold || 0,
    resources: { ...(state.resources || {}) },
    items: { ...(state.items || {}) },
  };
}

function makeFloatingGain(label: string, amount: number, kind: FloatingGain['kind'], index: number, iconId?: string): FloatingGain {
  const lane = index % 6;
  return {
    id: Date.now() + Math.floor(Math.random() * 100_000) + index,
    label,
    amount,
    kind,
    iconId,
    x: 38 + lane * 8 + (Math.random() * 8 - 4),
    y: 26 + Math.floor(index / 6) * 7 + Math.random() * 8,
    delay: Math.min(360, index * 42),
  };
}

function FloatingGains({ gains }: { gains: FloatingGain[] }) {
  return <div className="floatingGains" aria-hidden="true">{gains.map((gain) => (
    <div
      key={gain.id}
      className={`floatingGain ${gain.kind}`}
      style={{
        left: `${gain.x}%`,
        top: `${gain.y}%`,
        animationDelay: `${gain.delay}ms`,
      }}
    >
      {gain.iconId ? <ItemSprite id={gain.iconId} size={20} /> : null}<b>+{gain.amount}</b><span>{gain.label}</span>
    </div>
  ))}</div>;
}

function getTotalMusingTargets() {
  const areaMusings = Object.values(jobs).reduce((sum, job) => sum + job.areas.reduce((areaSum, area) => areaSum + area.musings.length, 0), 0);
  const levelMusings = Object.values(jobs).reduce((sum, job) => sum + Object.values(job.levelMusings || {}).reduce((levelSum, musings) => levelSum + musings.length, 0), 0);
  const jobUnlocks = Object.keys(jobs).length - 1;
  const storyAndHarvest = 5;
  return areaMusings + levelMusings + jobUnlocks + storyAndHarvest;
}

function getReleaseSnapshot(state: GameState, musingCount: number) {
  const allItemIds = Array.from(new Set(Object.keys(jobs).flatMap((jobKey) => getJobDropItems(jobKey))));
  const foundItems = allItemIds.filter((id) => (state.items[id] || 0) > 0).length;
  const unlockedJobs = Object.keys(jobs).filter((jobKey) => isJobUnlocked(jobKey, state)).length;
  const totalJobs = Object.keys(jobs).length;
  const ownedUpgrades = Object.values(jobs).flatMap((job) => job.upgrades).filter((upgrade) => state.items[upgrade.id]).length;
  const totalUpgrades = Object.values(jobs).reduce((sum, job) => sum + job.upgrades.length, 0);
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;
  const totalMusings = getTotalMusingTargets();
  const overall = Math.round(((foundItems / allItemIds.length) + (unlockedJobs / totalJobs) + (ownedUpgrades / totalUpgrades) + ((state.achievements || []).length / totalAchievements)) / 4 * 100);

  return {
    overall,
    stats: [
      { label: '仕事', value: unlockedJobs, total: totalJobs },
      { label: '拠点', value: ownedUpgrades, total: totalUpgrades },
      { label: '発見', value: foundItems, total: allItemIds.length },
      { label: '実績', value: (state.achievements || []).length, total: totalAchievements },
      { label: 'ぼやき', value: musingCount, total: totalMusings },
    ],
  };
}

function MiniProgress({ value, total }: { value: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return <div className="miniBar"><i style={{ width: `${percent}%` }} /></div>;
}

function LifePlanCard({ state, musingCount, openStats }: { state: GameState; musingCount: number; openStats: () => void }) {
  const plan = getLifePlan(state);
  const snapshot = getReleaseSnapshot(state, musingCount);
  const weeklySummary = getWeeklySummary(state);
  const season = getCurrentSeason();
  return (
    <Card title="生活ナビ" tone="notice lifePlan">
      <div className="lifePrimary">
        <small>{plan.kicker}</small>
        <b>{plan.title}</b>
        <p>{plan.detail}</p>
        <div className="nextTargetHead"><span>{plan.meta}</span></div>
        <div className="targetBar"><i style={{ width: `${plan.progress}%` }} /></div>
      </div>
      <div className="lifeProgress">
        <div className="releaseScore"><span>生活完成度</span><b>{snapshot.overall}%</b></div>
        <MiniProgress value={snapshot.overall} total={100} />
        <div className="lifeStats">{snapshot.stats.slice(0, 2).map((stat) => <span key={stat.label}>{stat.label} {stat.value}/{stat.total}</span>)}</div>
        <div className="lifeWeekly"><span>今週の目標 {weeklySummary.claimed}/{weeklySummary.total} ・{season.eventName}（残り{season.daysLeft}日）</span><button onClick={openStats}>詳しく</button></div>
      </div>
    </Card>
  );
}

function AchievementToasts({ toasts }: { toasts: AchievementToast[] }) {
  if (!toasts.length) return null;
  return <div className="achievementToasts" aria-live="polite">{toasts.map((toast) => <div className="achievementToast" key={toast.id}><small>実績解除</small><b>{toast.name}</b><p>{toast.description}</p></div>)}</div>;
}

function ChestOpeningOverlay({ reveal, onClose, equipItem }: { reveal: ChestReveal | null; onClose: () => void; equipItem: (uid: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    if (!reveal) return;
    const timer = window.setTimeout(() => setRevealed(true), 820);
    return () => window.clearTimeout(timer);
  }, [reveal?.id]);
  if (!reveal) return null;
  const item = reveal.item;
  return <div className={`chestOpeningOverlay ${revealed ? 'revealed' : 'opening'} ${item.rarity}`} role="dialog" aria-modal="true" aria-live="polite">
    <div className="chestOpeningStage">
      <span className="chestSpriteOpening chestSheetAnim" aria-hidden="true" key={reveal.id} style={{ backgroundImage: `url(${chestSheetUrl})` }} />
      <div className="chestLight" aria-hidden="true" />
      {!revealed ? <div className="openingText"><small>宝箱開封中</small><b>カチッ……</b><p>勇者「開ける前が一番楽しい。今がその前だ」</p></div> : <div className="revealCard">
        <small>{EQUIPMENT_RARITY_LABELS[item.rarity]} / {EQUIPMENT_SLOT_LABELS[item.slot]}{reveal.openedCount && reveal.openedCount > 1 ? ` / ${reveal.openedCount}個開封` : ''}</small>
        <b>{item.name}</b>
        <p>{item.description}</p>
        <ul>{item.options.map((option) => <li key={option.id}>{equipmentOptionText(option)}</li>)}</ul>
        <div className="revealActions"><button className="primary" onClick={() => { equipItem(item.uid); onClose(); }}>装備する</button><button onClick={onClose}>あとで見る</button></div>
      </div>}
    </div>
  </div>;
}

function CatVisitBanner({ state, onPet }: { state: GameState; onPet: () => void }) {
  const now = Date.now();
  const cat = state.cat;
  const visit = cat?.visit && now < cat.visit.expiresAt ? cat.visit : null;
  const buff = cat?.buff && now < cat.buff.expiresAt ? cat.buff : null;
  if (visit) {
    const def = getCatBuffDef(visit.buffId);
    const remainSec = Math.max(0, Math.ceil((visit.expiresAt - now) / 1000));
    return <div className="catVisitBanner" role="status"><span className="catIcon" aria-hidden="true"><Icon name="cat" /></span><div><small>相棒の猫がやってきた</small><b>ミケが足元で丸くなっている</b><p>なでると「{def.name}」（{def.description}）がもらえる。あと{remainSec}秒でどこかへ行く。見逃しても損はない。</p></div><button className="primary" onClick={onPet}>なでる</button></div>;
  }
  if (buff) {
    const def = getCatBuffDef(buff.id);
    const remainSec = Math.max(0, Math.ceil((buff.expiresAt - now) / 1000));
    return <div className="catBuffChip" role="status"><Icon name="cat" /><span>{def.name}：{def.description}</span><b>残り{remainSec}秒</b></div>;
  }
  return null;
}

function OfflineReturnCard({ state, onClose }: { state: GameState; onClose: () => void }) {
  const summary = state.offlineSummary;
  if (!summary) return null;
  const resources = Object.entries(summary.resourceGains || {}).filter(([, value]) => value > 0);
  const items = Object.entries(summary.itemGains || {}).filter(([, value]) => value > 0).slice(0, 5);
  const chestGain = summary.chestGain || 0;
  const xpGain = summary.xpGain || 0;
  const levelUps = summary.levelUps || [];
  const killsGain = summary.killsGain || 0;
  const discoveredGain = summary.discoveredGain || 0;
  const hasGain = summary.goldGain > 0 || resources.length > 0 || items.length > 0 || chestGain > 0 || xpGain > 0 || levelUps.length > 0 || killsGain > 0 || discoveredGain > 0;
  const tier = summary.tier || 'short';
  const capHours = getRebirthOfflineCapHours(state);
  const capText = capHours % 24 === 0 ? `${capHours / 24}日ぶん` : `${capHours}時間ぶん`;
  const tierLabel = {
    short: '帰還ボーナス',
    hours: '帰還ボーナス',
    overnight: '一晩ぶんの帰還',
    days: '長い不在からの帰還',
  }[tier];
  const tierMessage = {
    short: hasGain ? '見てない間に成果が積もっています。宝箱があれば、開ける楽しみも残っています。' : '大きな収穫はないけれど、時間はちゃんと味方に回っていました。',
    hours: hasGain ? '数時間ぶん、生活は止まらずに進んでいました。見てない間の成果、ちゃんと積もっています。' : '数時間ぶん、大きな収穫はないけれど、時間はちゃんと味方に回っていました。',
    overnight: hasGain ? '一晩ぶん、勇者の生活は静かに進んでいました。起きたら成果が待っている、悪くない朝です。' : '一晩ぶん、大きな収穫はないけれど、時間は静かに味方に回っていました。',
    days: hasGain ? '数日ぶんの時間が、ちゃんと成果になって残っています。焦らなくても進む。それが形になった帰還です。' : '数日ぶん、大きな収穫はないけれど、時間はちゃんと味方に回っていました。',
  }[tier];
  return <div className={`returnBanner tier-${tier}`}><div><small>{tierLabel}</small><b>{summary.elapsedText}ぶん生活が進みました</b><p>{tierMessage}</p><div className="returnGains">{summary.goldGain > 0 && <span>+{summary.goldGain}G</span>}{resources.map(([key, value]) => <span key={key}>+{value}{formatResourceName(key)}</span>)}{items.map(([key, value]) => <span key={key}>+{value}{itemName(key)}</span>)}{chestGain > 0 && <span>宝箱+{chestGain}</span>}{xpGain > 0 && <span>XP+{xpGain}</span>}{killsGain > 0 && <span>討伐+{killsGain}</span>}{discoveredGain > 0 && <span>新発見+{discoveredGain}種</span>}</div>{levelUps.length > 0 && <p className="returnLevelUps">レベルアップ：{levelUps.join('・')}</p>}{summary.capped && <p className="returnCapped">進行の計算は{capText}までです。それより前の時間は、勇者の記憶の中にだけ残っています。</p>}</div><button onClick={onClose}>確認</button></div>;
}

export default function App() {
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  // 起動時点のスナップショット。初回レンダー（＝初回セーブ書き込みより前）で確定させる。
  // hasSave は「前回までのセーブがあるか」、showTitle は端末設定のタイトル表示 ON/OFF。
  const [bootInfo] = useState(() => {
    let hasSave = false;
    try { hasSave = Boolean(localStorage.getItem(SAVE_KEY)); } catch { hasSave = false; }
    return { hasSave, showTitle: loadUserSettings().showTitleScreen };
  });
  const [titleDone, setTitleDone] = useState(false);
  const [state, setState] = useState<GameState>(() => loadState(initialState));
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const [achievementToasts, setAchievementToasts] = useState<AchievementToast[]>([]);
  const [chestReveal, setChestReveal] = useState<ChestReveal | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const previousGains = useRef(snapshotGains(state));
  const previousAchievements = useRef(new Set(state.achievements || []));
  const previousFeedbackEvents = useRef(new Set((state.feedbackEvents || []).map((event) => event.id)));

  useEffect(() => { setSaveFailed(!saveState(state)); }, [state]);
  useEffect(() => { initBgm(); }, []);
  useEffect(() => { setBgmAdventure(jobs[state.activeJob]?.type === 'adventure'); }, [state.activeJob]);
  useEffect(() => {
    const previous = previousAchievements.current;
    const unlocked = (state.achievements || []).filter((id) => !previous.has(id) && ACHIEVEMENTS[id]);
    previousAchievements.current = new Set(state.achievements || []);
    if (!unlocked.length) return;
    playUiSound('achievement');
    const toasts = unlocked.map((id) => ({ id: `${id}-${Date.now()}`, name: ACHIEVEMENTS[id].name, description: ACHIEVEMENTS[id].description }));
    setAchievementToasts((current) => [...toasts, ...current].slice(0, 3));
    const removeIds = new Set(toasts.map((toast) => toast.id));
    window.setTimeout(() => {
      setAchievementToasts((current) => current.filter((toast) => !removeIds.has(toast.id)));
    }, 4200);
  }, [state.achievements]);
  useEffect(() => {
    const previous = previousFeedbackEvents.current;
    const fresh = (state.feedbackEvents || []).filter((event) => !previous.has(event.id));
    previousFeedbackEvents.current = new Set((state.feedbackEvents || []).map((event) => event.id));
    fresh.forEach((event) => playFeedbackSound(event.type));
  }, [state.feedbackEvents]);
  useEffect(() => {
    const previous = previousGains.current;
    const next = snapshotGains(state);
    const gained: FloatingGain[] = [];

    if (next.gold > previous.gold) {
      gained.push(makeFloatingGain('G', next.gold - previous.gold, 'gold', gained.length));
    }

    (Object.keys(RESOURCE_LABELS) as Array<keyof typeof RESOURCE_LABELS>).forEach((key) => {
      const amount = (next.resources[key] || 0) - (previous.resources[key] || 0);
      if (amount > 0) gained.push(makeFloatingGain(RESOURCE_LABELS[key], amount, 'resource', gained.length));
    });

    Object.entries(next.items).forEach(([key, value]) => {
      const amount = value - (previous.items[key] || 0);
      if (amount > 0) gained.push(makeFloatingGain(itemName(key), amount, 'item', gained.length, key));
    });

    previousGains.current = next;
    if (!gained.length) return;

    setFloatingGains((current) => [...current, ...gained].slice(-36));
    const removeIds = new Set(gained.map((gain) => gain.id));
    window.setTimeout(() => {
      setFloatingGains((current) => current.filter((gain) => !removeIds.has(gain.id)));
    }, 1800);
  }, [state]);
  useEffect(() => { const timer = setInterval(() => setState((prev) => runTick(prev)), TICK_INTERVAL_MS); return () => clearInterval(timer); }, []);

  const activeJob = jobs[state.activeJob] || jobs.fishing;
  const activeArea = getActiveArea(state.activeJob, state.activeArea);
  const activeData = state.jobData[state.activeJob] || { level: 1, xp: 0, seenMusings: [] };
  const ownedUpgradeCount = countOwnedUpgrades(activeJob.upgrades.map((u) => u.id), state.items || {});
  const workSpeedMultiplier = getWorkSpeedMultiplier(activeData.level, ownedUpgradeCount) * (1 + (getEquipmentBonus(state, 'jobSpeed', state.activeJob) + getEquipmentBonus(state, 'jobSpeed')) / 100);
  const progressDuration = activeArea?.seconds ? getEffectiveDurationTicksForState(activeArea.seconds, activeData.level, ownedUpgradeCount, state, state.activeJob) : 0;
  const progress = progressDuration ? steppedProgress(((state.tick % progressDuration) / progressDuration) * 100) : 0;
  const readMusings = state.readMusings || [];
  const totalMusings = useMemo(() => getTotalMusingTargets(), []);
  const canAdvance = state.musingQueue.length > 0 || Boolean(state.currentMusing && !state.currentMusing.readAt);
  const farmingReady = Boolean(state.farming?.readyAt && Date.now() >= state.farming.readyAt);
  const foundCount = Object.keys(state.items || {}).filter((key) => state.items[key] > 0).length;
  const dailyReady = canClaimDailyBonus(state);
  const dailyStreak = state.dailyBonus?.streak || 0;

  const reset = () => { clearSave(); setState(initialState); };
  const handleAdvanceMusing = () => { if (canAdvance) playUiSound('next'); setState(advanceMusing); };
  const handleSelectJob = (key: string) => { playUiSound('click'); setState((prev) => selectJob(prev, key)); };
  const handleSelectArea = (id: string) => { playUiSound('click'); setState((prev) => selectArea(prev, id)); };
  const handlePlantCrop = (cropId: CropId) => setState((prev) => plantCrop(prev, cropId));
  const handleHarvestCrop = () => setState(harvestCrop);
  const handleBuyUpgrade = (u: typeof activeJob.upgrades[number]) => { playUiSound('buy'); setState((prev) => buyUpgrade(prev, u)); };
  const handleClaimCat = () => { playUiSound('click'); setState((prev) => claimCatVisit(prev, Date.now())); };
  const handleClaimDaily = () => setState(claimDailyBonus);
  const handleClaimWeeklyGoal = (goalId: string) => { playUiSound('click'); setState((prev) => claimWeeklyGoal(prev, goalId)); };
  const handleBuyPrestigeUpgrade = (id: string) => setState((prev) => buyPrestigeUpgrade(prev, id));
  const handleRetire = () => setState((prev) => retire(prev, initialState));
  const handleBuyRebirthUpgrade = (id: string) => setState((prev) => buyRebirthUpgrade(prev, id));
  const handleRebirth = () => setState((prev) => rebirth(prev, initialState));
  const handleEquipItem = (uid: string) => setState((prev) => equipItem(prev, uid));
  const handleSellEquipment = (uid: string) => setState((prev) => sellEquipment(prev, uid));
  const handleSelectTrait = (id: TraitId) => { playUiSound('click'); setState((prev) => applyMilestoneAchievements(selectTrait(prev, id))); };
  const handleToggleEquipmentLock = (uid: string) => setState((prev) => toggleEquipmentLock(prev, uid));
  const showChestReveal = (beforeUid: string | undefined, next: GameState, openedCount = 1) => {
    const item = next.equipmentInventory?.[0];
    if (!item || item.uid === beforeUid) return;
    window.setTimeout(() => {
      setChestReveal({
        id: Date.now(),
        item,
        openedCount,
        legendary: item.rarity === 'legendary',
      });
    }, 0);
  };
  const handleOpenChest = (uid: string) => setState((prev) => {
    const beforeUid = prev.equipmentInventory?.[0]?.uid;
    const next = openTreasureChest(prev, uid);
    showChestReveal(beforeUid, next);
    return next;
  });
  const handleOpenAllChests = () => setState((prev) => {
    const beforeUid = prev.equipmentInventory?.[0]?.uid;
    const beforeCount = prev.treasureChests?.length || 0;
    const next = openAllTreasureChests(prev);
    const opened = beforeCount - (next.treasureChests?.length || 0);
    showChestReveal(beforeUid, next, opened);
    return next;
  });

  return (
    <div className="page">
      <div className="ambientLayer" aria-hidden="true">
        <img className="ambientCloud ambientA" src={ambientCloudUrl} alt="" />
        <img className="ambientCloud ambientB" src={ambientCloudUrl} alt="" />
        <img className="ambientCloud ambientC" src={ambientCloudUrl} alt="" />
      </div>
      <FloatingGains gains={floatingGains} />
      <AchievementToasts toasts={achievementToasts} />
      <ChestOpeningOverlay reveal={chestReveal} equipItem={handleEquipItem} onClose={() => setChestReveal(null)} />
      <OfflineReturnCard state={state} onClose={() => setState((prev) => ({ ...prev, offlineSummary: null }))} />
      <Header state={state} foundCount={foundCount} musingCount={readMusings.length} dailyReady={dailyReady} dailyStreak={dailyStreak} claimDaily={handleClaimDaily} openChest={() => { playUiSound('open'); setChestOpen(true); }} openEquipment={() => { playUiSound('open'); setEquipmentOpen(true); }} openCollection={() => { playUiSound('open'); setCollectionOpen(true); }} openPrestige={() => { playUiSound('open'); setPrestigeOpen(true); }} openSettings={() => { playUiSound('open'); setSettingsOpen(true); }} openStats={() => { playUiSound('open'); setStatsOpen(true); }} />
      {saveFailed && <div className="saveWarning" role="alert"><div><small>セーブに失敗しました</small><b>いまの進み具合が保存できていません</b><p>ブラウザの空き容量やプライベートモードを確認してください。進むたびに保存をやり直すので、直ればこの表示は自動で消えます。</p></div></div>}
      <div className="layout">
        <div className="side">
          <JobMenu state={state} selectJob={handleSelectJob} />
          <LifePlanCard state={state} musingCount={readMusings.length} openStats={() => { playUiSound('open'); setStatsOpen(true); }} />
        </div>
        <main className="main">
          <CatVisitBanner state={state} onPet={handleClaimCat} />
          <div className="activityGrid">
            <MusingPanel state={state} totalMusings={totalMusings} musingCount={readMusings.length} canAdvance={canAdvance} advanceMusing={handleAdvanceMusing} />
            <CurrentJobCard job={activeJob} area={activeArea} data={activeData} progress={progress} speedMultiplier={workSpeedMultiplier} effectiveDurationTicks={progressDuration} latestLog={state.eventLog?.[0] || 'まだ作業ログはない。'} openLog={() => { playUiSound('open'); setLogOpen(true); }} openAreas={() => { playUiSound('open'); setAreaOpen(true); }} openUpgrades={() => { playUiSound('open'); setUpgradesOpen(true); }} farmingReady={farmingReady} state={state} plantCrop={handlePlantCrop} harvestCrop={handleHarvestCrop} selectArea={handleSelectArea} buyUpgrade={handleBuyUpgrade} />
          </div>
        </main>
      </div>
      {logOpen && <LogModal logs={state.eventLog} onClose={() => setLogOpen(false)} />}
      {areaOpen && <Modal title={`${activeJob.name}の仕事エリア`} description="行き先を選ぶ。広い画面で条件と効率を確認できます。" onClose={() => setAreaOpen(false)} wide><div className="detailModalBody"><AreaGrid job={activeJob} state={state} selectArea={(id) => { handleSelectArea(id); setAreaOpen(false); }} /></div></Modal>}
      {upgradesOpen && <Modal title={`${activeJob.name}の拠点整備`} description="生活を少し楽にする導入候補。足りない素材もここで確認できます。" onClose={() => setUpgradesOpen(false)} wide><div className="detailModalBody"><UpgradePanel state={state} job={activeJob} buyUpgrade={handleBuyUpgrade} /></div></Modal>}
      {chestOpen && <ChestModal state={state} openChest={handleOpenChest} openAllChests={handleOpenAllChests} openEquipmentScreen={() => { setChestOpen(false); playUiSound('open'); setEquipmentOpen(true); }} onClose={() => setChestOpen(false)} />}
      {equipmentOpen && <EquipmentModal state={state} equipItem={handleEquipItem} sellEquipment={handleSellEquipment} toggleLock={handleToggleEquipmentLock} onClose={() => setEquipmentOpen(false)} />}
      {collectionOpen && <CollectionModal state={state} musings={readMusings} achievements={state.achievements} onClose={() => setCollectionOpen(false)} />}
      {prestigeOpen && <PrestigeModal state={state} buyPrestigeUpgrade={handleBuyPrestigeUpgrade} retire={() => { handleRetire(); setPrestigeOpen(false); }} buyRebirthUpgrade={handleBuyRebirthUpgrade} rebirth={() => { handleRebirth(); setPrestigeOpen(false); }} onClose={() => setPrestigeOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} reset={() => { reset(); setSettingsOpen(false); }} />}
      {statsOpen && <StatsModal state={state} onClose={() => setStatsOpen(false)} onSelectTrait={handleSelectTrait} onClaimWeeklyGoal={handleClaimWeeklyGoal} />}
      {!titleDone && bootInfo.showTitle && <TitleScreen hasSave={bootInfo.hasSave} onFinish={() => setTitleDone(true)} onOpenSettings={() => { setTitleDone(true); playUiSound('open'); setSettingsOpen(true); }} />}
    </div>
  );
}
