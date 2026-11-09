import { useEffect, useMemo, useRef, useState } from 'react';
import chestClosed from '../assets/sprites/hero/chest-closed.png';
import { ACHIEVEMENTS, itemDesc, itemKind, itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import { getJobDropItems } from '../game/collection';
import { getPeople, getPersonBonusLines } from '../game/companion';
import { CHEST_LABELS, EQUIPMENT_RARITY_LABELS, EQUIPMENT_SLOT_LABELS, equipmentBaseName, equipmentOptionText, getChestLimit, getEquipmentBonus, getEquipmentLimit, getEquipmentSellValue } from '../game/equipment';
import { formatResourceName } from '../game/formatters';
import { MUSING_LABELS } from '../game/musings';
import { canRebirth, canRetire, canSamsara, getNextPrestigeCost, getNextRebirthCost, getNextSamsaraCost, getPrestigeScore, getPrestigeSpeedMultiplier, getPrestigeStage, getRebirthPoints, getRebirthStage, getRetirementPoints, getSamsaraPoints, getSamsaraStage, MEMORY_POINT_NAME, PRESTIGE_UPGRADES, REBIRTH_POINT_NAME, REBIRTH_REQUIRED_RETIREMENTS, REBIRTH_UPGRADES, RETIRE_REQUIRED_SCORE, SAMSARA_POINT_NAME, SAMSARA_REQUIRED_REBIRTHS, SAMSARA_UPGRADES } from '../game/prestige';
import { getAchievementBonusLines, getAchievementProgress, getCollectionBonusLines, getFailChance, xpToNext } from '../game/progression';
import { getCurrentSeason, getSeasonCalendar } from '../game/seasons';
import { getWeeklyGoalProgresses, getWeeklySummary } from '../game/weekly';
import { getSynergyChains } from '../game/synergy';
import { isJobUnlocked, getActiveArea } from '../game/requirements';
import { GAME_SPEED_DIVISOR, countOwnedUpgrades, getEffectiveDurationTicksForState, getWorkSpeedMultiplier } from '../game/timing';
import { applyUserSettings, loadUserSettings, saveUserSettings, type UserSettings } from '../game/settings';
import { createSaveBackupText, importSaveBackup } from '../game/saveTransfer';
import { createInitialState } from '../game/state';
import { TRAITS, getTrait, getTraitBonusLines, getTraitChangeCost, getTraitJobGoldBonusPct, getTraitRestXpMultiplier } from '../game/traits';
import type { EquipmentItem, EquipmentSlot, GameState, Job, Monster, Musing, TraitId } from '../types';
import { Icon } from './Icon';
import { EquipSprite, ItemSprite, MonsterThumb } from './GameIcon';
import { Card, Modal } from './shared';

export function LogModal({ logs, onClose }: { logs: string[]; onClose: () => void }) {
  return <Modal title="作業ログ" description="最新の作業結果を確認する。" onClose={onClose}><div className="logList">{logs.map((log, index) => <p key={`${log}-${index}`} className={index === 0 ? 'freshLog' : ''}>{log}</p>)}</div></Modal>;
}

function avgRange(range?: [number, number]) {
  return range ? (range[0] + range[1]) / 2 : 0;
}

function fmtNum(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function WeeklyGoalsSection({ state, onClaimWeeklyGoal }: { state: GameState; onClaimWeeklyGoal: (goalId: string) => void }) {
  const season = getCurrentSeason();
  const progresses = getWeeklyGoalProgresses(state);
  const summary = getWeeklySummary(state);
  const seasonItemOwned = (state.items?.[season.itemId] || 0) > 0;
  return <>
    <div className="statsRows">
      <div className="statsRow"><span>{season.eventName}</span><b>{season.description}（残り{season.daysLeft}日）</b></div>
      <div className="statsRow"><span>季節の品</span><b>{itemName(season.itemId)}{seasonItemOwned ? '（入手済み）' : '（未入手・サイクル完了時にまれに落ちる）'}</b></div>
      <div className="statsRow"><span>季節のお守り</span><b>{equipmentBaseName(season.charmBaseId)}（今の季節だけ宝箱から出る）</b></div>
      <div className="statsRow"><span>今週の目標</span><b>{summary.claimed}/{summary.total}個受け取り済み</b></div>
    </div>
    {progresses.map(({ goal, current, done, claimed }) => {
      const percent = Math.min(100, Math.round((current / goal.target) * 100));
      return <div key={goal.id}>
        <div className="statsRow"><span>{goal.label}</span><b>{current}/{goal.target} ・ 報酬{goal.rewardGold}G</b></div>
        <div className="targetBar"><i style={{ width: `${percent}%` }} /></div>
        <button className="primary weeklyClaimButton" onClick={() => onClaimWeeklyGoal(goal.id)} disabled={!done || claimed}>
          {claimed ? '受け取り済み' : done ? '受け取る' : '未達成'}
        </button>
      </div>;
    })}
    <p className="sub">週間目標は月曜始まりで切り替わる。進捗は今週の始まりからの歩みで測るので、週が変わればまた最初から。報酬は金だけ。無理のない範囲で。</p>
    <p className="sub">季節カレンダー：1年は4つの季節に分かれ、それぞれ限定の品とお守りがある。今の季節には「今ここ」が付く。期間外の品は手に入らないので、欲しい季節を逃さないように。</p>
    <div className="statsRows">
      {getSeasonCalendar().map((entry) => {
        const calendarItemOwned = (state.items?.[entry.itemId] || 0) > 0;
        return <div className="statsRow" key={entry.id}>
          <span>{entry.name}（{entry.monthsLabel}）{entry.isCurrent ? '・今ここ' : ''}</span>
          <b>{entry.eventName}／{itemName(entry.itemId)}{calendarItemOwned ? '（入手済み）' : '（未入手）'}・{equipmentBaseName(entry.charmBaseId)}{entry.isCurrent ? `（残り${entry.daysLeft}日）` : ''}</b>
        </div>;
      })}
    </div>
  </>;
}

export function StatsModal({ state, onClose, onSelectTrait, onClaimWeeklyGoal }: { state: GameState; onClose: () => void; onSelectTrait: (id: TraitId) => void; onClaimWeeklyGoal: (goalId: string) => void }) {
  const activeJob = jobs[state.activeJob] || jobs.fishing;
  const activeArea = getActiveArea(state.activeJob, state.activeArea) || activeJob.areas[0];
  const activeData = state.jobData[state.activeJob] || { level: 1, xp: 0, seenMusings: [] };
  const ownedUpgrades = countOwnedUpgrades(activeJob.upgrades.map((u) => u.id), state.items || {});
  const ticks = getEffectiveDurationTicksForState(activeArea.seconds, activeData.level, ownedUpgrades, state, state.activeJob);
  const cycleSeconds = Math.max(1, Math.ceil(ticks / GAME_SPEED_DIVISOR));
  const failChance = getFailChance(activeArea, activeJob.upgrades, state.items || {}, state);
  const successRate = 1 - failChance;
  const speedMultiplier = getWorkSpeedMultiplier(activeData.level, ownedUpgrades)
    * (1 + (getEquipmentBonus(state, 'jobSpeed', state.activeJob) + getEquipmentBonus(state, 'jobSpeed')) / 100)
    * getPrestigeSpeedMultiplier(state);
  const resourceGains = (['fish', 'wood', 'ore'] as const)
    .map((key) => ({ key, amount: avgRange(activeArea.rewards[key]) }))
    .filter((entry) => entry.amount > 0);
  // 特性：商人気質なら仕事の金報酬に +10%、のんびり屋気質で休憩なら XP に +25% が効く。
  const goldPerCycle = avgRange(activeArea.rewards.gold) * (1 + getTraitJobGoldBonusPct(state) / 100)
    + (activeArea.sell ? avgRange(activeArea.sell.amount) * activeArea.sell.price : 0);
  const xpPerCycle = (activeArea.rewards.xp || 0) * (state.activeJob === 'rest' ? getTraitRestXpMultiplier(state) : 1);
  const cyclesPerHour = 3600 / cycleSeconds;
  const goldPerHour = goldPerCycle * cyclesPerHour * successRate;
  const xpPerHour = xpPerCycle * cyclesPerHour * successRate;
  const xpProgress = Math.min(100, Math.round((activeData.xp / xpToNext(activeData.level)) * 100));
  const monsters = getAllMonsters();
  const defeated = monsters.filter((monster) => (state.defeatedMonsters || []).includes(monster.id)).length;
  const totalAreas = Object.values(jobs).reduce((sum, job) => sum + job.areas.length, 0);
  const prestige = state.prestige || { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {}, rebirthPoints: 0, totalRebirthEarned: 0, rebirthCount: 0, rebirthUpgrades: {}, samsaraPoints: 0, totalSamsaraEarned: 0, samsaraCount: 0, samsaraUpgrades: {} };

  return <Modal title="統計" description="現在の仕事の効率と、全体の進み具合。数字は今の状態からの期待値で、セーブには何も書きません。" onClose={onClose} wide><div className="settingsPanel statsPanel">
    <div>
      <div className="sectionHead"><h3>現在の仕事の効率：{activeJob.name} / {activeArea.name}</h3></div>
      <div className="collectionSummary statsSummary">
        <SummaryPill label="1周の時間" value={`約${cycleSeconds}秒`} />
        <SummaryPill label="速度倍率" value={`x${speedMultiplier.toFixed(2)}`} />
        <SummaryPill label="失敗率" value={`${Math.round(failChance * 100)}%`} />
        <SummaryPill label="時給（金）" value={`約${Math.round(goldPerHour)}G`} />
        <SummaryPill label="時給（XP）" value={`約${Math.round(xpPerHour)}`} />
        <SummaryPill label="1周あたり" value={`${fmtNum(goldPerCycle)}G / ${xpPerCycle}XP`} />
      </div>
      <div className="statsRows">
        <div className="statsRow"><span>仕事Lv</span><b>{activeData.level}（次まで {activeData.xp} / {xpToNext(activeData.level)} XP）</b></div>
        <div className="targetBar"><i style={{ width: `${xpProgress}%` }} /></div>
        {resourceGains.length > 0 && <div className="statsRow"><span>1周あたりの素材（期待値）</span><b>{resourceGains.map((entry) => `${fmtNum(entry.amount)}${formatResourceName(entry.key)}`).join(' / ')}</b></div>}
        {activeArea.sell && <div className="statsRow"><span>売却収入（1周）</span><b>約{fmtNum(avgRange(activeArea.sell.amount) * activeArea.sell.price)}G（{formatResourceName(activeArea.sell.resource)}を売る仕事）</b></div>}
        {activeArea.adventureCost ? <div className="statsRow"><span>出発費（1周）</span><b>{activeArea.adventureCost}G（モンスター報酬は含まない）</b></div> : null}
        <p className="sub">時給は「1周の期待値 × 1時間あたりの周回数 × 成功率」で出した目安です。ドロップの運、在庫アイテムの売却、戦闘・探索のモンスター報酬は含みません。1周の秒数は現在の仕事カードと同じ表示単位です。</p>
      </div>
    </div>
    <div>
      <div className="sectionHead"><h3>仕事別</h3></div>
      <div className="statsRows">
        {Object.entries(jobs).map(([jobKey, job]) => {
          if (!isJobUnlocked(jobKey, state)) return <div className="statsRow" key={jobKey}><span>？？？</span><b>まだ出会っていない仕事</b></div>;
          const jobData = state.jobData[jobKey] || { level: 1, xp: 0, seenMusings: [] };
          const owned = countOwnedUpgrades(job.upgrades.map((u) => u.id), state.items || {});
          return <div className="statsRow" key={jobKey}><span>{job.name}</span><b>Lv{jobData.level} / 拠点 {owned}/{job.upgrades.length} / 基礎速度 x{getWorkSpeedMultiplier(jobData.level, owned).toFixed(2)}{jobKey === state.activeJob ? '（作業中）' : ''}</b></div>;
        })}
      </div>
      <p className="sub">基礎速度はレベルと拠点整備だけの倍率です。装備と永続強化は現在の仕事の効率にだけ上乗せされます。</p>
    </div>
    <div>
      <div className="sectionHead"><h3>連鎖ボーナス</h3></div>
      <div className="statsRows">
        {getSynergyChains(state).map((chain) => (
          <div className="statsRow" key={chain.id}><span>{chain.label}</span><b>{chain.active || chain.inactive}</b></div>
        ))}
      </div>
      <p className="sub">ある仕事の育成が、別の仕事を強くする連鎖です。セーブには何も書きません。育てる仕事を変えると、効く先の数字も変わります。</p>
    </div>
    <div>
      <div className="sectionHead"><h3>特性</h3></div>
      <p className="sub">勇者の生き方を1つだけ選ぶ。初回は無料、変更は500G×（変更回数+1）。選んだ瞬間から効果が出る。タップだけで選べる。</p>
      <div className="traitGrid">
        {TRAITS.map((def) => {
          const current = getTrait(state);
          const selected = current === def.id;
          const changeCost = getTraitChangeCost(state);
          const canAfford = current === null || state.gold >= changeCost;
          return <div className={`traitCard ${selected ? 'selected' : ''}`} key={def.id}>
            <div className="traitTop"><b>{def.name}</b>{selected && <span className="traitBadge">選択中</span>}</div>
            <p>{def.flavor}</p>
            <ul>{def.effects.map((effect) => <li key={effect}>{effect}</li>)}</ul>
            <button className="primary" onClick={() => onSelectTrait(def.id)} disabled={selected || !canAfford}>
              {selected ? '選択中' : current === null ? '無料で選ぶ' : `変更する（${changeCost}G）`}
            </button>
            {!selected && current !== null && !canAfford && <p className="sub">所持金が足りない（{state.gold}G / 必要{changeCost}G）。</p>}
          </div>;
        })}
      </div>
      <div className="statsRows">
        {getTraitBonusLines(state).length > 0
          ? getTraitBonusLines(state).map((line) => <div className="statsRow" key={line}><span>特性ボーナス</span><b>{line}</b></div>)
          : <div className="statsRow"><span>特性ボーナス</span><b>未選択。どれか1つ選ぶと、ここに効いている効果が出る。</b></div>}
      </div>
      <p className="sub">特性は1つだけ。変えたくなったら、いつでもここから変えられる。生き方の模様替えは、意外と高い。</p>
    </div>
    <div>
      <div className="sectionHead"><h3>人物ボーナス</h3></div>
      <div className="statsRows">
        {getPersonBonusLines(state).length > 0
          ? getPersonBonusLines(state).map((line) => <div className="statsRow" key={line}><span>出会い</span><b>{line}</b></div>)
          : <div className="statsRow"><span>出会い</span><b>まだ誰とも出会っていない。図鑑の「人物」タブに、会えるヒントがある。</b></div>}
      </div>
      <p className="sub">商人の仕事・拠点整備・引退を進めると、街の人と出会う。出会うと、ちょっとした暮らしの助けが効くようになる。</p>
    </div>
    <div>
      <div className="sectionHead"><h3>実績ボーナス</h3></div>
      <div className="statsRows">
        {getAchievementBonusLines(state).map((line) => <div className="statsRow" key={line}><span>実績</span><b>{line}</b></div>)}
      </div>
      <p className="sub">実績を集めるほど、仕事の金報酬・XP・ドロップ確率が少しずつ上がる。図鑑の「実績」タブで、未解禁のヒントと進み具合が見える。</p>
    </div>
    <div>
      <div className="sectionHead"><h3>今週の目標と季節イベント</h3></div>
      <WeeklyGoalsSection state={state} onClaimWeeklyGoal={onClaimWeeklyGoal} />
    </div>
    <div>
      <div className="sectionHead"><h3>図鑑コンプリートボーナス</h3></div>
      <div className="statsRows">
        {getCollectionBonusLines(state).map((line) => <div className="statsRow" key={line}><span>図鑑</span><b>{line}</b></div>)}
      </div>
      <p className="sub">季節限定の品は期間外は手に入らないので、全発見の数には含めない。集めた分だけ、仕事の金報酬とXPが少しずつ上がる。</p>
    </div>
    <div>
      <div className="sectionHead"><h3>全体と上限</h3></div>
      <div className="collectionSummary statsSummary">
        <SummaryPill label="所持金" value={`${state.gold}G`} />
        <SummaryPill label="ぼやき" value={`${(state.readMusings || []).length}件`} />
        <SummaryPill label="実績" value={`${(state.achievements || []).length}/${Object.keys(ACHIEVEMENTS).length}`} ratio={Object.keys(ACHIEVEMENTS).length ? (state.achievements || []).length / Object.keys(ACHIEVEMENTS).length : 0} />
        <SummaryPill label="討伐" value={`${defeated}/${monsters.length}`} ratio={monsters.length ? defeated / monsters.length : 0} />
        <SummaryPill label="訪問エリア" value={`${(state.visitedAreas || []).length}/${totalAreas}`} ratio={totalAreas ? (state.visitedAreas || []).length / totalAreas : 0} />
        <SummaryPill label="生活スタンプ" value={`${state.dailyBonus?.streak || 0}日`} />
        <SummaryPill label="宝箱" value={`${state.treasureChests?.length || 0}/${getChestLimit(state)}`} ratio={getChestLimit(state) ? (state.treasureChests?.length || 0) / getChestLimit(state) : 0} />
        <SummaryPill label="装備" value={`${state.equipmentInventory?.length || 0}/${getEquipmentLimit(state)}`} ratio={getEquipmentLimit(state) ? (state.equipmentInventory?.length || 0) / getEquipmentLimit(state) : 0} />
        <SummaryPill label="引退" value={`${prestige.retireCount}回`} />
        <SummaryPill label="思い出ポイント" value={`${prestige.memoryPoints}`} />
        <SummaryPill label="転生" value={`${prestige.rebirthCount || 0}回`} />
        <SummaryPill label={REBIRTH_POINT_NAME} value={`${prestige.rebirthPoints || 0}`} />
        <SummaryPill label="輪廻" value={`${prestige.samsaraCount || 0}回`} />
        <SummaryPill label={SAMSARA_POINT_NAME} value={`${prestige.samsaraPoints || 0}`} />
        {(state.towerBest || 0) > 0 && <SummaryPill label="無限の塔" value={`最高${state.towerBest}階`} />}
      </div>
      <p className="sub">宝箱と装備の上限はここで見えます。上限に近づいたら、宝箱を開けるか装備を売る・保護する判断の目安にしてください。</p>
    </div>
  </div></Modal>;
}

function EquippedSlots({ state, sellEquipment, toggleLock }: { state: GameState; sellEquipment: (uid: string) => void; toggleLock: (uid: string) => void }) {
  const inventory = state.equipmentInventory || [];
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'charm'];
  return <div className="equippedSlots">{slots.map((slot) => {
    const equipped = inventory.find((item) => item.uid === state.equipped?.[slot]);
    return <div className="equippedSlot" key={slot}><small>{EQUIPMENT_SLOT_LABELS[slot]}</small>{equipped ? <EquipmentCard item={equipped} equipped sellEquipment={sellEquipment} toggleLock={toggleLock} /> : <p className="sub">未装備。ここだけ身軽。</p>}</div>;
  })}</div>;
}

function EquipmentInventoryList({ state, equipItem, sellEquipment, toggleLock }: { state: GameState; equipItem: (uid: string) => void; sellEquipment: (uid: string) => void; toggleLock: (uid: string) => void }) {
  const inventory = state.equipmentInventory || [];
  return <><div className="equipmentInventoryHead"><b>所持装備</b><span>{inventory.length}/{getEquipmentLimit(state)}</span></div>{inventory.length === 0 ? <p className="sub">まだ装備はありません。宝箱を開けると、生活の味方が出ます。</p> : <div className="equipmentGrid">{inventory.map((item) => <EquipmentCard key={item.uid} item={item} equipped={state.equipped?.[item.slot] === item.uid} currentEquipped={inventory.find((other) => other.uid === state.equipped?.[item.slot])} equipItem={equipItem} sellEquipment={sellEquipment} toggleLock={toggleLock} />)}</div>}</>;
}

export function ChestModal({ state, openChest, openAllChests, openEquipmentScreen, onClose }: { state: GameState; openChest: (uid: string) => void; openAllChests: () => void; openEquipmentScreen: () => void; onClose: () => void }) {
  const chests = state.treasureChests || [];
  const inventoryCount = state.equipmentInventory?.length || 0;
  return <Modal title="宝箱" description="放置で貯まった宝箱を開ける場所。出た装備は「装備」画面で付け替える。" onClose={onClose} wide><div className="equipmentPanel"><div className="chestSection"><div className="equipmentInventoryHead"><b>未開封の宝箱</b><span>{chests.length}/{getChestLimit(state)}</span></div>{chests.length > 1 && <button className="primary openAllButton" onClick={openAllChests}>まとめて開ける</button>}{chests.length === 0 ? <p className="sub">宝箱はまだありません。放置して戻った時、ここに小さな楽しみが積もります。</p> : <div className="chestGrid">{chests.map((chest) => <div className={`chestCard ${chest.type}`} key={chest.uid}><img src={chestClosed} alt="" aria-hidden="true" /><small>{CHEST_LABELS[chest.type].name}</small><b>{chest.name}</b><p>{chest.description}</p><button className="primary" onClick={() => openChest(chest.uid)}>開ける</button></div>)}</div>}</div><div className="equipGuide"><p className="sub">開けた装備は、装備画面で装備中との比較を見ながら付け替えられます。</p><button onClick={openEquipmentScreen}>装備画面を開く（所持装備 {inventoryCount}個）</button></div></div></Modal>;
}

export function EquipmentModal({ state, equipItem, sellEquipment, toggleLock, onClose }: { state: GameState; equipItem: (uid: string) => void; sellEquipment: (uid: string) => void; toggleLock: (uid: string) => void; onClose: () => void }) {
  const settings = loadUserSettings();
  return <Modal title="装備" description="装備中の3枠と所持装備を、ここで付け替える。宝箱を開けるのは「宝箱」から。" onClose={onClose} wide><div className="equipmentPanel"><EquippedSlots state={state} sellEquipment={sellEquipment} toggleLock={toggleLock} /><div className="equipGuide"><p className="sub">自動装備は{settings.autoEquip ? 'ON' : 'OFF'}、アイテム自動売却は{settings.autoSell ? 'ON' : 'OFF'}です。切り替えは「設定」の自動化トグルから。</p></div><EquipmentInventoryList state={state} equipItem={equipItem} sellEquipment={sellEquipment} toggleLock={toggleLock} /></div></Modal>;
}
function EquipmentCard({ item, equipped, currentEquipped, equipItem, sellEquipment, toggleLock }: { item: EquipmentItem; equipped?: boolean; currentEquipped?: EquipmentItem; equipItem?: (uid: string) => void; sellEquipment: (uid: string) => void; toggleLock: (uid: string) => void }) {
  // 装備選択時点の比較：同じ枠に今つけている装備があれば、その効果をカード内に並べる。
  // タップだけの端末でも読めるよう、ホバー限定の title ではなく常時表示の行にする。
  const compareTarget = !equipped && currentEquipped && currentEquipped.uid !== item.uid ? currentEquipped : null;
  return <div className={`equipmentCard ${item.rarity} ${equipped ? 'equipped' : ''} ${item.locked ? 'locked' : ''}`}><div className="equipmentTop"><EquipSprite baseId={item.baseId} size={40} /><div><small>{EQUIPMENT_RARITY_LABELS[item.rarity]} / {EQUIPMENT_SLOT_LABELS[item.slot]}</small><b>{item.name}</b></div><div className="equipmentBadges">{equipped && <span className="equipBadge">装備中</span>}{item.locked && <span className="lockBadge">保護</span>}</div></div><p>{item.description}</p><ul>{item.options.map((option) => <li key={option.id}>{equipmentOptionText(option)}</li>)}</ul>{compareTarget && <p className="equipCompare">今の装備：{compareTarget.name} — {compareTarget.options.map(equipmentOptionText).join(' / ')}</p>}<div className="equipmentActions">{equipItem && <button className="primary" onClick={() => equipItem(item.uid)} disabled={equipped}>装備</button>}<button onClick={() => toggleLock(item.uid)}>{item.locked ? '保護解除' : '保護'}</button><button onClick={() => sellEquipment(item.uid)} disabled={item.locked}>+{getEquipmentSellValue(item)}Gで売る</button></div></div>;
}

export function CollectionModal({ state, musings, achievements, onClose }: { state: GameState; musings: Musing[]; achievements: string[]; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | 'items' | 'equipment' | 'monsters' | 'musings' | 'achievements' | 'people' | 'guide'>('all');
  const tabs = [
    { id: 'all', label: 'すべて' },
    { id: 'guide', label: '遊び方' },
    { id: 'items', label: '発見物' },
    { id: 'equipment', label: '装備' },
    { id: 'monsters', label: '討伐' },
    { id: 'musings', label: 'ぼやき' },
    { id: 'achievements', label: '実績' },
    { id: 'people', label: '人物' },
  ] as const;
  return <Modal title="図鑑" description="発見物・装備・討伐・ぼやき・実績・人物をまとめて確認する。遊び方は「遊び方」タブで。" onClose={onClose} wide><CollectionSummary state={state} musings={musings} achievements={achievements} /><div className="bookTabs">{tabs.map((tab) => <button key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{tab.label}</button>)}</div>{filter === 'guide' ? <div className="bookGrid single"><HowToGuide /></div> : <div className={`bookGrid ${filter !== 'all' ? 'single' : ''}`}>{(filter === 'all' || filter === 'items') && <DiscoveryBook state={state} />}{(filter === 'all' || filter === 'equipment') && <EquipmentBook state={state} />}{(filter === 'all' || filter === 'monsters') && <BestiaryBook state={state} />}{(filter === 'all' || filter === 'musings') && <MusingBook musings={musings} />}{(filter === 'all' || filter === 'achievements') && <AchievementBook state={state} achievements={achievements} />}{(filter === 'all' || filter === 'people') && <PeopleBook state={state} />}</div>}</Modal>;
}

function PeopleBook({ state }: { state: GameState }) {
  const people = getPeople(state);
  const metCount = people.filter((person) => person.met).length;
  return <Card title="人物"><p className="sub">出会った人物 {metCount}/{people.length}。まだの人物は「？？？」で、会えるヒントだけ見える。</p><ul className="peopleList">{people.map((person) => <li key={person.id} className={person.met ? 'met' : 'unmet'}><div><small>{person.role}</small><b>{person.met ? person.name : '？？？'}</b><p>{person.met ? person.description : person.hint}</p></div></li>)}</ul></Card>;
}

function HowToGuide() {
  return <Card title="遊び方"><p className="sub">魔王討伐より、まず今日を回す。生活を整えて、少しずつ自由に近づく放置RPGです。</p><ol className="howToSteps"><li><b>仕事を選ぶ</b><p>仕事メニューから仕事とエリアを選びます。選んだ仕事が自動で進みます。</p></li><li><b>ぼやきは「次へ」で読む</b><p>何か出来事が起きるとぼやきが出ます。報酬は出来事のときに自動でもらえます。「次へ」は読むための操作です。日常のひとりごとは、画面の端を流れるだけのティッカー表示になります。</p></li><li><b>素材を売って、装備を整える</b><p>素材は商人で売ってGに変えます。装備は宝箱から手に入り、強いものに付け替えます。</p></li><li><b>拠点整備で暮らしを楽にする</b><p>素材を使って拠点を整えると、HP・MPの上限などが増えます。</p></li><li><b>離れても進む</b><p>閉じている間も、実時間の半分ぶんだけ進みます（最大5日分まで。思い出強化と気質で最大9割まで上がります）。戻ったら帰還バナーで成果を確認します。</p></li></ol><div className="howToNotes"><b>図鑑の見方</b><p>未発見は「？？？」で表示されます。★は重要アイテムです。討伐は、初めて倒した相手だけ名前が出ます。</p><b>次に目指すもの</b><p>まだ解禁されていない仕事やエリアは「？？？＋解禁条件のヒント」で表示されます。条件を満たすと自動で解禁されます。</p><b>困ったら</b><p>設定から、アイテム自動売却・自動装備・宝箱の自動開封・自動休憩・タイトル画面の表示を切り替えられます。セーブのバックアップも設定から書き出せます。</p><b>相棒の猫</b><p>拠点に住み着いた猫が、たまにやってきます。「なでる」と短いご褒美がもらえます。「ミケを呼ぶ」ボタンでおやつをあげて呼ぶこともできます（10分に1回）。見逃しても損はありません。会った人物は図鑑の「人物」タブに残ります。</p></div></Card>;
}

function rebirthEffectText(upgradeId: string, stage: number): string {
  if (upgradeId === 'rebirth_chest') return `宝箱上限：+${stage * 2} / ドロップ率：+${stage * 10}%`;
  if (upgradeId === 'rebirth_offline') return `オフライン上限：+${stage * 12}時間（基本72時間）`;
  if (upgradeId === 'rebirth_memory') return `思い出ポイント獲得：+${stage * 25}%`;
  if (upgradeId === 'rebirth_gold') return `収入（G）：+${stage * 12}%`;
  return `全仕事速度：+${stage * 10}%`;
}

function samsaraEffectText(upgradeId: string, stage: number): string {
  if (upgradeId === 'samsara_rebirth') return `転生の証獲得：+${stage * 30}%`;
  if (upgradeId === 'samsara_gold') return `収入（G）：+${stage * 15}%`;
  if (upgradeId === 'samsara_xp') return `仕事XP：+${stage * 15}%`;
  if (upgradeId === 'samsara_musing') return `ぼやき報酬：+${stage * 30}%`;
  return `全仕事速度：+${stage * 12}%`;
}

export function PrestigeModal({ state, buyPrestigeUpgrade, retire, buyRebirthUpgrade, rebirth, buySamsaraUpgrade, samsara, onClose }: { state: GameState; buyPrestigeUpgrade: (id: string) => void; retire: () => void; buyRebirthUpgrade: (id: string) => void; rebirth: () => void; buySamsaraUpgrade: (id: string) => void; samsara: () => void; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingRebirth, setConfirmingRebirth] = useState(false);
  const [confirmingSamsara, setConfirmingSamsara] = useState(false);
  const prestige = state.prestige || { memoryPoints: 0, totalEarned: 0, retireCount: 0, upgrades: {}, rebirthPoints: 0, totalRebirthEarned: 0, rebirthCount: 0, rebirthUpgrades: {}, samsaraPoints: 0, totalSamsaraEarned: 0, samsaraCount: 0, samsaraUpgrades: {} };
  const score = getPrestigeScore(state);
  const gain = getRetirementPoints(state);
  const eligible = canRetire(state);
  const remaining = Math.max(0, RETIRE_REQUIRED_SCORE - score.score);
  const progressPercent = Math.min(100, Math.floor((score.score / RETIRE_REQUIRED_SCORE) * 100));
  const rebirthGain = getRebirthPoints(state);
  const rebirthEligible = canRebirth(state);
  const rebirthRemaining = Math.max(0, REBIRTH_REQUIRED_RETIREMENTS - prestige.retireCount);
  const rebirthProgressPercent = Math.min(100, Math.floor((prestige.retireCount / REBIRTH_REQUIRED_RETIREMENTS) * 100));
  const samsaraGain = getSamsaraPoints(state);
  const samsaraEligible = canSamsara(state);
  const samsaraRemaining = Math.max(0, SAMSARA_REQUIRED_REBIRTHS - (prestige.rebirthCount || 0));
  const samsaraProgressPercent = Math.min(100, Math.floor(((prestige.rebirthCount || 0) / SAMSARA_REQUIRED_REBIRTHS) * 100));
  return <Modal title="引退と思い出" description="区切りを付けて、歩みを思い出ポイントに変える。思い出は次の人生でも消えない。" onClose={onClose} wide><div className="settingsPanel">
    <div className="collectionSummary">
      <SummaryPill label={MEMORY_POINT_NAME} value={`${prestige.memoryPoints}`} />
      <SummaryPill label="累計獲得" value={`${prestige.totalEarned}`} />
      <SummaryPill label="引退回数" value={`${prestige.retireCount}回`} />
      <SummaryPill label="いま引退すると" value={eligible ? `+${gain}` : 'まだ'} />
    </div>
    <div className="settingRow"><div><b>この人生の進行度：{score.score} / {RETIRE_REQUIRED_SCORE}</b><p>仕事レベル合計 {score.totalLevels} ＋ 発見 {score.discovered} ＋ 実績 {score.achievements}×2。{eligible ? `引退で思い出ポイント+${gain}が手に入ります。` : `引退まであと${remaining}。仕事レベル、発見、実績で増えます。`}</p><div className="targetBar"><i style={{ width: `${progressPercent}%` }} /></div></div></div>
    <div className="dangerZone"><div><b>引退する</b><p>レベル・G・素材・所持品・装備・宝箱・拠点整備はリセットされます。実績・ぼやき図鑑・討伐と訪問の記録・思い出ポイントと永続強化は残ります。</p></div>{confirming
      ? <span className="prestigeConfirm"><button className="primary" onClick={retire}>本当に引退する</button><button onClick={() => setConfirming(false)}>やめておく</button></span>
      : <button onClick={() => setConfirming(true)} disabled={!eligible}>{eligible ? `引退して +${gain} を受け取る` : `あと${remaining}で引退可能`}</button>}</div>
    <div><b>永続強化（思い出ポイントで買う）</b><p className="sub">引退しても消えません。次の人生の立ち上がりが、少しずつ楽になります。</p></div>
    {PRESTIGE_UPGRADES.map((def) => {
      const stage = getPrestigeStage(state, def.id);
      const cost = getNextPrestigeCost(state, def.id);
      const currentBonus = stage * def.perStage;
      return <div className="settingRow" key={def.id}><div><b>{def.name} <span className="stagePips" role="img" aria-label={`段階 ${stage}/${def.maxStage}`}>{Array.from({ length: def.maxStage }, (_, i) => <i key={i} className={i < stage ? 'on' : ''} />)}</span></b><p>{def.description}</p><p>{def.effectLabel}：{def.id === 'memory_start_gold' ? `+${currentBonus}G` : def.id === 'memory_vitality' ? `+${currentBonus}` : `+${currentBonus}%`}</p></div>{cost === null ? <span className="sub">最大段階</span> : <button className="primary" onClick={() => buyPrestigeUpgrade(def.id)} disabled={prestige.memoryPoints < cost}>{cost} で強化</button>}</div>;
    })}
    <div>
      <div className="sectionHead"><h3>転生（第2層）</h3></div>
      <p className="sub">引退を3回重ねた先の区切り。思い出ポイントと永続強化まで置いていく代わりに、転生の証が手に入る。転生の強化は転生しても消えない。</p>
    </div>
    <div className="collectionSummary">
      <SummaryPill label={REBIRTH_POINT_NAME} value={`${prestige.rebirthPoints || 0}`} />
      <SummaryPill label="累計獲得" value={`${prestige.totalRebirthEarned || 0}`} />
      <SummaryPill label="転生回数" value={`${prestige.rebirthCount || 0}回`} />
      <SummaryPill label="いま転生すると" value={rebirthEligible ? `+${rebirthGain}` : 'まだ'} />
    </div>
    <div className="settingRow"><div><b>引退回数：{prestige.retireCount} / {REBIRTH_REQUIRED_RETIREMENTS}</b><p>{rebirthEligible ? `転生で転生の証+${rebirthGain}が手に入ります。` : `転生まであと${rebirthRemaining}回の引退。引退を重ねると、転生の証が増えます。`}</p><div className="targetBar"><i style={{ width: `${rebirthProgressPercent}%` }} /></div></div></div>
    <div className="dangerZone"><div><b>転生する</b><p>レベル・G・素材・所持品・装備・宝箱・拠点整備に加え、思い出ポイントと第1層の永続強化もリセットされます。実績・ぼやき図鑑・討伐と訪問の記録・転生の証と転生の強化は残ります。</p></div>{confirmingRebirth
      ? <span className="prestigeConfirm"><button className="primary" onClick={rebirth}>本当に転生する</button><button onClick={() => setConfirmingRebirth(false)}>やめておく</button></span>
      : <button onClick={() => setConfirmingRebirth(true)} disabled={!rebirthEligible}>{rebirthEligible ? `転生して +${rebirthGain} を受け取る` : `あと${rebirthRemaining}回の引退で転生可能`}</button>}</div>
    <div><b>転生の永続強化（転生の証で買う）</b><p className="sub">転生しても消えません。次の人生の立ち上がりが、引退の強化より大きく楽になります。</p></div>
    {REBIRTH_UPGRADES.map((def) => {
      const stage = getRebirthStage(state, def.id);
      const cost = getNextRebirthCost(state, def.id);
      return <div className="settingRow" key={def.id}><div><b>{def.name} <span className="stagePips" role="img" aria-label={`段階 ${stage}/${def.maxStage}`}>{Array.from({ length: def.maxStage }, (_, i) => <i key={i} className={i < stage ? 'on' : ''} />)}</span></b><p>{def.description}</p><p>{rebirthEffectText(def.id, stage)}</p></div>{cost === null ? <span className="sub">最大段階</span> : <button className="primary" onClick={() => buyRebirthUpgrade(def.id)} disabled={(prestige.rebirthPoints || 0) < cost}>{cost} で強化</button>}</div>;
    })}
    <div>
      <div className="sectionHead"><h3>輪廻（第3層）</h3></div>
      <p className="sub">転生を3回重ねた先の区切り。思い出ポイントと転生の証、第1・第2層の永続強化まで置いていく代わりに、輪廻の証が手に入る。輪廻の強化は輪廻しても消えない。</p>
    </div>
    <div className="collectionSummary">
      <SummaryPill label={SAMSARA_POINT_NAME} value={`${prestige.samsaraPoints || 0}`} />
      <SummaryPill label="累計獲得" value={`${prestige.totalSamsaraEarned || 0}`} />
      <SummaryPill label="輪廻回数" value={`${prestige.samsaraCount || 0}回`} />
      <SummaryPill label="いま輪廻すると" value={samsaraEligible ? `+${samsaraGain}` : 'まだ'} />
    </div>
    <div className="settingRow"><div><b>転生回数：{prestige.rebirthCount || 0} / {SAMSARA_REQUIRED_REBIRTHS}</b><p>{samsaraEligible ? `輪廻で輪廻の証+${samsaraGain}が手に入ります。` : `輪廻まであと${samsaraRemaining}回の転生。転生を重ねると、輪廻の証が増えます。`}</p><div className="targetBar"><i style={{ width: `${samsaraProgressPercent}%` }} /></div></div></div>
    <div className="dangerZone"><div><b>輪廻する</b><p>レベル・G・素材・所持品・装備・宝箱・拠点整備に加え、思い出ポイントと転生の証、第1・第2層の永続強化もリセットされます。実績・ぼやき図鑑・討伐と訪問の記録・輪廻の証と輪廻の強化は残ります。</p></div>{confirmingSamsara
      ? <span className="prestigeConfirm"><button className="primary" onClick={samsara}>本当に輪廻する</button><button onClick={() => setConfirmingSamsara(false)}>やめておく</button></span>
      : <button onClick={() => setConfirmingSamsara(true)} disabled={!samsaraEligible}>{samsaraEligible ? `輪廻して +${samsaraGain} を受け取る` : `あと${samsaraRemaining}回の転生で輪廻可能`}</button>}</div>
    <div><b>輪廻の永続強化（輪廻の証で買う）</b><p className="sub">輪廻しても消えません。次の人生の立ち上がりが、転生の強化より大きく楽になります。</p></div>
    {SAMSARA_UPGRADES.map((def) => {
      const stage = getSamsaraStage(state, def.id);
      const cost = getNextSamsaraCost(state, def.id);
      return <div className="settingRow" key={def.id}><div><b>{def.name} <span className="stagePips" role="img" aria-label={`段階 ${stage}/${def.maxStage}`}>{Array.from({ length: def.maxStage }, (_, i) => <i key={i} className={i < stage ? 'on' : ''} />)}</span></b><p>{def.description}</p><p>{samsaraEffectText(def.id, stage)}</p></div>{cost === null ? <span className="sub">最大段階</span> : <button className="primary" onClick={() => buySamsaraUpgrade(def.id)} disabled={(prestige.samsaraPoints || 0) < cost}>{cost} で強化</button>}</div>;
    })}
  </div></Modal>;
}

export function SettingsModal({ onClose, reset }: { onClose: () => void; reset: () => void }) {
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
  const [backupText, setBackupText] = useState('');
  const [importText, setImportText] = useState('');
  const [backupMessage, setBackupMessage] = useState('');

  useEffect(() => {
    saveUserSettings(settings);
    applyUserSettings(settings);
  }, [settings]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportSave = () => {
    const backup = createSaveBackupText();
    setBackupText(backup || '');
    setBackupMessage(backup ? 'バックアップ文字列を作りました。大事なところにしまっておきましょう。' : 'まだ保存データがありません。');
  };
  const downloadSave = () => {
    const backup = createSaveBackupText();
    if (!backup) {
      setBackupMessage('まだ保存データがありません。');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `idle-yuusha-save-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupMessage('セーブをファイルに書き出しました。');
  };
  const loadSaveFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setImportText(await file.text());
      setBackupMessage('ファイルからバックアップを読みました。「取り込む」で勇者の記憶を引っ越します。');
    } catch {
      setBackupMessage('ファイルを読めませんでした。');
    }
  };
  const importSave = () => {
    const result = importSaveBackup(importText, createInitialState(jobs));
    setBackupMessage(result.message);
    if (result.ok) {
      window.setTimeout(() => window.location.reload(), 350);
    }
  };

  return <Modal title="設定" description="音と表示、自動化、セーブ周りの設定。" onClose={onClose}><div className="settingsPanel"><SettingSlider icon="volume" label="BGM" value={settings.bgm} onChange={(bgm) => setSettings((current) => ({ ...current, bgm }))} /><SettingSlider icon="sliders" label="SE" value={settings.se} onChange={(se) => setSettings((current) => ({ ...current, se }))} /><label className="settingToggle"><span><b>連続SEを控えめにする</b><p>チャチャリン系を短いチャリンに寄せる。</p></span><input type="checkbox" checked={settings.simplifiedComboSe} onChange={(event) => setSettings((current) => ({ ...current, simplifiedComboSe: event.currentTarget.checked }))} /></label><label className="settingToggle"><span><b>アイテム自動売却</b><p>素材アイテムを手に入れたら、その場で自動で売ってGに変える。重要アイテム・記録・拠点整備は売らない。初めての品は1個だけ残す。</p></span><input type="checkbox" checked={settings.autoSell} onChange={(event) => setSettings((current) => ({ ...current, autoSell: event.currentTarget.checked }))} /></label><label className="settingToggle"><span><b>自動装備</b><p>宝箱から装備を手に入れたら、今の装備より強いときだけ自動で付け替える。同等以下なら何もしない。</p></span><input type="checkbox" checked={settings.autoEquip} onChange={(event) => setSettings((current) => ({ ...current, autoEquip: event.currentTarget.checked }))} /></label><label className="settingToggle"><span><b>宝箱の自動開封</b><p>宝箱が上限に達したら、いちばん古い宝箱を自動で開ける。装備枠がいっぱいのときは開けない。開けた装備は自動装備の設定にも従う。</p></span><input type="checkbox" checked={settings.autoOpenChest} onChange={(event) => setSettings((current) => ({ ...current, autoOpenChest: event.currentTarget.checked }))} /></label><label className="settingToggle"><span><b>HP/MPが足りないとき自動で休憩</b><p>戦闘・冒険でHP/MPが足りなくなったら自動で休憩に切り替わり、8割まで回復したら元の仕事に戻る。休憩が解禁されていないときは働かない。手動で仕事を選ぶと自動復帰は止まる。</p></span><input type="checkbox" checked={settings.autoRest} onChange={(event) => setSettings((current) => ({ ...current, autoRest: event.currentTarget.checked }))} /></label><label className="settingToggle"><span><b>タイトル画面を表示</b><p>起動時にロゴとキーアートを表示する。OFFにすると、すぐ本編から始まる。</p></span><input type="checkbox" checked={settings.showTitleScreen} onChange={(event) => setSettings((current) => ({ ...current, showTitleScreen: event.currentTarget.checked }))} /></label><div className="settingRow"><div><b>テキスト速度</b><p>ぼやきの表示演出の速さ。</p></div><div className="settingChoices"><button className={settings.textSpeed === 'normal' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, textSpeed: 'normal' }))}>標準</button><button className={settings.textSpeed === 'fast' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, textSpeed: 'fast' }))}>速い</button></div></div><div className="dangerZone"><div><b>最初からやり直す</b><p>セーブデータを消して、勇者の労働生活を巻き戻す。</p></div><button onClick={reset}><Icon name="reset" /> リセット</button></div><div className="backupPanel"><div><b>セーブバックアップ</b><p>端末を変える前や、リセット前の保険に使う。</p></div><div className="backupActions"><button onClick={exportSave}><Icon name="book" /> 書き出す</button><button onClick={downloadSave}>ファイルで書き出す</button><button onClick={() => fileInputRef.current?.click()}>ファイルから読み込む</button><button onClick={importSave} disabled={!importText.trim()}>取り込む</button></div><input ref={fileInputRef} type="file" accept=".json,.txt,application/json" hidden onChange={(event) => { void loadSaveFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /><textarea value={backupText} onChange={(event) => setBackupText(event.currentTarget.value)} placeholder="書き出したセーブがここに表示されます。" readOnly /><textarea value={importText} onChange={(event) => setImportText(event.currentTarget.value)} placeholder="取り込むバックアップ文字列をここに貼り付けます。" />{backupMessage && <p className="backupMessage">{backupMessage}</p>}</div></div></Modal>;
}

function SettingSlider({ icon, label, value, onChange }: { icon: 'volume' | 'sliders'; label: string; value: number; onChange: (value: number) => void }) {
  const updateValue = (rawValue: string) => {
    const numeric = Number(rawValue);
    if (Number.isNaN(numeric)) return;
    onChange(Math.max(0, Math.min(100, numeric)));
  };
  return <label className="settingSlider"><span><Icon name={icon} /> {label}</span><input type="range" min="0" max="100" value={value} onChange={(event) => updateValue(event.currentTarget.value)} /><input className="settingNumber" type="number" min="0" max="100" value={value} aria-label={`${label} 数値`} onChange={(event) => updateValue(event.currentTarget.value)} /></label>;
}

function CollectionSummary({ state, musings, achievements }: { state: GameState; musings: Musing[]; achievements: string[] }) {
  const itemIds = Array.from(new Set(Object.keys(jobs).flatMap((jobKey) => getJobDropItems(jobKey))));
  const foundItems = itemIds.filter((id) => (state.items[id] || 0) > 0).length;
  const totalAchievements = Object.keys(ACHIEVEMENTS).length;
  const unlockedJobs = Object.entries(jobs).filter(([jobKey]) => isJobUnlocked(jobKey, state)).length;
  const totalJobs = Object.keys(jobs).length;
  const ownedUpgrades = Object.values(jobs).flatMap((job) => job.upgrades).filter((upgrade) => state.items[upgrade.id]).length;
  const totalUpgrades = Object.values(jobs).reduce((sum, job) => sum + job.upgrades.length, 0);
  const monsters = getAllMonsters();
  const defeated = monsters.filter((monster) => state.defeatedMonsters?.includes(monster.id)).length;
  return <div className="collectionSummary bookSummary"><SummaryPill label="発見物" value={`${foundItems}/${itemIds.length}`} ratio={itemIds.length ? foundItems / itemIds.length : 0} /><SummaryPill label="装備" value={`${state.equipmentInventory?.length || 0}`} /><SummaryPill label="討伐" value={`${defeated}/${monsters.length}`} ratio={monsters.length ? defeated / monsters.length : 0} /><SummaryPill label="ぼやき" value={`${musings.length}`} /><SummaryPill label="実績" value={`${achievements.length}/${totalAchievements}`} ratio={totalAchievements ? achievements.length / totalAchievements : 0} /><SummaryPill label="仕事" value={`${unlockedJobs}/${totalJobs}`} ratio={totalJobs ? unlockedJobs / totalJobs : 0} /><SummaryPill label="拠点整備" value={`${ownedUpgrades}/${totalUpgrades}`} ratio={totalUpgrades ? ownedUpgrades / totalUpgrades : 0} /></div>;
}

function SummaryPill({ label, value, ratio }: { label: string; value: string; ratio?: number }) {
  const percent = ratio === undefined ? null : Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return <div className="summaryPill"><span>{label}</span><b>{value}</b>{percent !== null && <i className="summaryBar" aria-hidden="true"><b style={{ width: `${percent}%` }} /></i>}</div>;
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
  return <p className={`discoverItem ${found ? '' : 'unknown'}`} title={found ? itemDesc(id) : 'まだ見つけていない'}><span><ItemSprite id={id} size={32} silhouette={!found} />{itemKind(id) === '重要' && <Icon name="key" />} {found ? itemName(id) : '？？？'}</span><b>{found ? count : '—'}</b></p>;
}

function EquipmentBook({ state }: { state: GameState }) {
  const inventory = state.equipmentInventory || [];
  return <Card title="装備図鑑"><p className="sub">拾った装備と開封ログ。良い装備ほど、勇者の働きたくなさを助ける。</p>{(state.openedChestLog || []).length > 0 && <div className="equipmentArchiveList">{state.openedChestLog.slice(0, 6).map((log, index) => <div className="equipmentArchive" key={`${log}-${index}`}><small>開封記録</small><b>{log}</b></div>)}</div>}{inventory.length === 0 ? <p className="sub">まだ装備はない。手ぶらも自由だが、効率は手ぶらに厳しい。</p> : <div className="equipmentArchiveList">{inventory.map((item) => <div className={`equipmentArchive ${item.rarity}`} key={item.uid}><EquipSprite baseId={item.baseId} size={36} /><div><small>{EQUIPMENT_RARITY_LABELS[item.rarity]} / {EQUIPMENT_SLOT_LABELS[item.slot]}</small><b>{item.name}</b><p>{item.options.map(equipmentOptionText).join(' / ')}</p></div></div>)}</div>}</Card>;
}

function getAllMonsters() {
  const byId = new Map<string, Monster>();
  Object.values(jobs).forEach((job) => {
    job.areas.forEach((area) => {
      area.monsters?.forEach((monster) => byId.set(monster.id, monster));
    });
  });
  return Array.from(byId.values());
}

function BestiaryBook({ state }: { state: GameState }) {
  const monsters = getAllMonsters();
  return <Card title="討伐記録"><p className="sub">初めて倒した相手だけ正体が残る。倒す前は、だいたい不安。</p>{monsters.map((monster) => <MonsterArchive key={monster.id} monster={monster} defeated={state.defeatedMonsters?.includes(monster.id)} />)}</Card>;
}

function MonsterArchive({ monster, defeated }: { monster: Monster; defeated?: boolean }) {
  const dropText = monster.drops.map((drop) => itemName(drop.item)).join(' / ');
  return <div className={`monsterArchive ${defeated ? 'defeated' : ''}`}><MonsterThumb id={monster.id} size={56} silhouette={!defeated} /><div className="monsterArchiveBody"><div><b>{defeated ? monster.name : '？？？'}{monster.boss ? '（ボス）' : ''}</b><span>{defeated ? `HP${monster.hp} / 攻撃${monster.attack}` : '未討伐'}</span></div><p>{defeated ? `落とすもの：${dropText || 'なし'}。勝てたなら、次はできれば会釈だけで済ませたい。` : 'まだ倒していない。名前を知らない不安は、だいたい強そうに見える。'}</p></div></div>;
}

function MusingBook({ musings }: { musings: Musing[] }) {
  const [filter, setFilter] = useState<'all' | keyof typeof MUSING_LABELS>('all');
  const counts = useMemo(() => musings.reduce<Record<string, number>>((acc, musing) => {
    const key = musing.eventType || 'event';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}), [musings]);
  const filtered = filter === 'all' ? musings : musings.filter((musing) => musing.eventType === filter);
  return <Card title="ぼやき図鑑"><p className="sub">読んだぼやきの本文と種類が残る。</p><div className="musingFilters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部 <span>{musings.length}</span></button>{Object.entries(MUSING_LABELS).map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key as keyof typeof MUSING_LABELS)}>{label} <span>{counts[key] || 0}</span></button>)}</div>{filtered.length === 0 ? <p className="sub">この種類の記録はまだない。</p> : filtered.map((m, i) => <div className="musingArchive" key={`${m.text}-${i}`}><small>{m.eventType ? (MUSING_LABELS[m.eventType] || '出来事') : '出来事'} / {m.job} / {m.area}</small><p>{m.text}</p></div>)}</Card>;
}

const ACHIEVEMENT_CATEGORY_ORDER = ['仕事', '戦闘', '収集', '生活', '周回', '連鎖', '実績'];

function AchievementBook({ state, achievements }: { state: GameState; achievements: string[] }) {
  const groups = ACHIEVEMENT_CATEGORY_ORDER.map((category) => ({
    category,
    entries: Object.entries(ACHIEVEMENTS).filter(([, a]) => (a.category || '実績') === category),
  })).filter((group) => group.entries.length > 0);
  return <Card title="実績"><p className="sub">ユーモア寄りの節目。集めるほど金報酬・XP・ドロップ確率が上がる。未解禁はヒントと進み具合で、次に目指すものが見える。</p>{groups.map((group) => {
    const unlockedCount = group.entries.filter(([id]) => achievements.includes(id)).length;
    return <div key={group.category}><div className="sectionHead"><h3>{group.category}（{unlockedCount}/{group.entries.length}）</h3></div>{group.entries.map(([id, a]) => {
      const unlocked = achievements.includes(id);
      const progress = unlocked ? null : getAchievementProgress(state, id);
      return <div className={`achievement ${unlocked ? 'unlocked' : ''}`} key={id}><b>{unlocked ? a.name : '？？？'}</b><p>{unlocked ? a.description : (a.hint ? `ヒント：${a.hint}` : 'まだその瞬間は来ていない。来ないなら来ないで平和。')}</p>{progress && <p className="sub">進捗：{Math.min(progress.current, progress.target)}/{progress.target}</p>}</div>;
    })}</div>;
  })}</Card>;
}
