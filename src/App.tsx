import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { CurrentJobCard, UpgradePanel } from './components/JobPanels';
import { JobMenu } from './components/JobMenu';
import { CollectionModal, LogModal, SettingsModal } from './components/Modals';
import { MusingPanel } from './components/MusingPanel';
import { Card } from './components/shared';
import { itemName } from './data/catalog';
import { jobs } from './data/gameData';
import { advanceMusing, buyUpgrade, harvestCrop, plantCrop, selectArea, selectJob } from './game/actions';
import type { CropId } from './game/farming';
import { formatResourceName } from './game/formatters';
import { clearSave, createInitialState, loadState, saveState } from './game/state';
import { getGoal } from './game/progression';
import { getActiveArea } from './game/requirements';
import { runTick } from './game/tick';
import { countOwnedUpgrades, getEffectiveDurationTicks, getWorkSpeedMultiplier, TICK_INTERVAL_MS } from './game/timing';
import type { GameState } from './types';

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
  x: number;
  y: number;
  delay: number;
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

function makeFloatingGain(label: string, amount: number, kind: FloatingGain['kind'], index: number): FloatingGain {
  const lane = index % 6;
  return {
    id: Date.now() + Math.floor(Math.random() * 100_000) + index,
    label,
    amount,
    kind,
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
      <b>+{gain.amount}</b><span>{gain.label}</span>
    </div>
  ))}</div>;
}

export default function App() {
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [state, setState] = useState<GameState>(() => loadState(initialState));
  const [floatingGains, setFloatingGains] = useState<FloatingGain[]>([]);
  const previousGains = useRef(snapshotGains(state));

  useEffect(() => {
    let frameId: number | null = null;
    let previous = window.scrollY > 24;
    const syncCompact = () => {
      const next = window.scrollY > 24;
      if (next !== previous) {
        previous = next;
        setCompact(next);
      }
      frameId = null;
    };
    const onScroll = () => {
      if (frameId === null) {
        frameId = window.requestAnimationFrame(syncCompact);
      }
    };
    setCompact(previous);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  useEffect(() => { saveState(state); }, [state]);
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
      if (amount > 0) gained.push(makeFloatingGain(itemName(key), amount, 'item', gained.length));
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
  const workSpeedMultiplier = getWorkSpeedMultiplier(activeData.level, ownedUpgradeCount);
  const progressDuration = activeArea?.seconds ? getEffectiveDurationTicks(activeArea.seconds, activeData.level, ownedUpgradeCount) : 0;
  const progress = progressDuration ? steppedProgress(((state.tick % progressDuration) / progressDuration) * 100) : 0;
  const readMusings = state.readMusings || [];
  const totalMusings = useMemo(() => Object.values(jobs).reduce((sum, job) => sum + job.areas.reduce((s, area) => s + area.musings.length, 0), 0) + 1, []);
  const canAdvance = state.musingQueue.length > 0 || Boolean(state.currentMusing && !state.currentMusing.readAt);
  const farmingReady = Boolean(state.farming?.readyAt && Date.now() >= state.farming.readyAt);
  const foundCount = Object.keys(state.items || {}).filter((key) => state.items[key] > 0).length;
  const nextAction = farmingReady ? '畑が収穫待ち。今日の小さな勝利が土から出ます。' : canAdvance ? '未読のぼやきあり。勇者の内心が玄関で待っています。' : activeArea ? `${activeArea.name}を進行中。無理なく一周ずつ。` : 'まずは仕事を選んで、今日を回しましょう。';

  const reset = () => { clearSave(); setState(initialState); };
  const handleAdvanceMusing = () => setState(advanceMusing);
  const handleSelectJob = (key: string) => setState((prev) => selectJob(prev, key));
  const handleSelectArea = (id: string) => setState((prev) => selectArea(prev, id));
  const handlePlantCrop = (cropId: CropId) => setState((prev) => plantCrop(prev, cropId));
  const handleHarvestCrop = () => setState(harvestCrop);
  const handleBuyUpgrade = (u: typeof activeJob.upgrades[number]) => setState((prev) => buyUpgrade(prev, u));

  return (
    <div className="page">
      <FloatingGains gains={floatingGains} />
      <Header compact={compact} state={state} foundCount={foundCount} musingCount={readMusings.length} openCollection={() => setCollectionOpen(true)} openSettings={() => setSettingsOpen(true)} />
      <div className="layout">
        <div className="side">
          <Card title="今日の生活メモ" tone="notice"><p>{getGoal(state)}</p><p className="nextAction">{nextAction}</p></Card>
          <JobMenu state={state} selectJob={handleSelectJob} />
        </div>
        <main className="main">
          <div className="activityGrid">
            <MusingPanel state={state} totalMusings={totalMusings} musingCount={readMusings.length} canAdvance={canAdvance} advanceMusing={handleAdvanceMusing} />
            <CurrentJobCard job={activeJob} area={activeArea} data={activeData} progress={progress} speedMultiplier={workSpeedMultiplier} effectiveDurationTicks={progressDuration} latestLog={state.eventLog?.[0] || 'まだ作業ログはない。'} openLog={() => setLogOpen(true)} farmingReady={farmingReady} state={state} plantCrop={handlePlantCrop} harvestCrop={handleHarvestCrop} selectArea={handleSelectArea} />
          </div>
          <UpgradePanel state={state} job={activeJob} buyUpgrade={handleBuyUpgrade} />
        </main>
      </div>
      {logOpen && <LogModal logs={state.eventLog} onClose={() => setLogOpen(false)} />}
      {collectionOpen && <CollectionModal state={state} musings={readMusings} achievements={state.achievements} onClose={() => setCollectionOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} reset={() => { reset(); setSettingsOpen(false); }} />}
    </div>
  );
}
