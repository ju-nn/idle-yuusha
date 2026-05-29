import { useEffect, useMemo, useState } from 'react';
import chestClosed from '../assets/sprites/treasure_chest_mini/chest-1.png';
import { ACHIEVEMENTS, itemDesc, itemKind, itemName } from '../data/catalog';
import { jobs } from '../data/gameData';
import { getJobDropItems } from '../game/collection';
import { CHEST_LABELS, EQUIPMENT_RARITY_LABELS, EQUIPMENT_SLOT_LABELS, equipmentOptionText, getChestLimit, getEquipmentLimit, getEquipmentSellValue } from '../game/equipment';
import { MUSING_LABELS } from '../game/musings';
import { isJobUnlocked } from '../game/requirements';
import { applyUserSettings, loadUserSettings, saveUserSettings, type UserSettings } from '../game/settings';
import { SAVE_KEY } from '../game/state';
import type { EquipmentItem, EquipmentSlot, GameState, Job, Monster, Musing } from '../types';
import { Icon } from './Icon';
import { Card, Modal } from './shared';

export function LogModal({ logs, onClose }: { logs: string[]; onClose: () => void }) {
  return <Modal title="作業ログ" description="最新の作業結果を確認する。" onClose={onClose}><div className="logList">{logs.map((log, index) => <p key={`${log}-${index}`} className={index === 0 ? 'freshLog' : ''}>{log}</p>)}</div></Modal>;
}

export function EquipmentModal({ state, equipItem, sellEquipment, toggleLock, openChest, openAllChests, onClose }: { state: GameState; equipItem: (uid: string) => void; sellEquipment: (uid: string) => void; toggleLock: (uid: string) => void; openChest: (uid: string) => void; openAllChests: () => void; onClose: () => void }) {
  const inventory = state.equipmentInventory || [];
  const chests = state.treasureChests || [];
  const slots: EquipmentSlot[] = ['weapon', 'armor', 'charm'];
  return <Modal title="宝箱と装備" description="放置で貯まった宝箱を開け、出た装備で生活効率を上げる。" onClose={onClose} wide><div className="equipmentPanel"><div className="chestSection"><div className="equipmentInventoryHead"><b>未開封の宝箱</b><span>{chests.length}/{getChestLimit(state)}</span></div>{chests.length > 1 && <button className="primary openAllButton" onClick={openAllChests}>まとめて開ける</button>}{chests.length === 0 ? <p className="sub">宝箱はまだありません。放置して戻った時、ここに小さな楽しみが積もります。</p> : <div className="chestGrid">{chests.map((chest) => <div className={`chestCard ${chest.type}`} key={chest.uid}><img src={chestClosed} alt="" aria-hidden="true" /><small>{CHEST_LABELS[chest.type].name}</small><b>{chest.name}</b><p>{chest.description}</p><button className="primary" onClick={() => openChest(chest.uid)}>開ける</button></div>)}</div>}</div><div className="equippedSlots">{slots.map((slot) => {
    const equipped = inventory.find((item) => item.uid === state.equipped?.[slot]);
    return <div className="equippedSlot" key={slot}><small>{EQUIPMENT_SLOT_LABELS[slot]}</small>{equipped ? <EquipmentCard item={equipped} equipped sellEquipment={sellEquipment} toggleLock={toggleLock} /> : <p className="sub">未装備。ここだけ身軽。</p>}</div>;
  })}</div><div className="equipmentInventoryHead"><b>所持装備</b><span>{inventory.length}/{getEquipmentLimit(state)}</span></div>{inventory.length === 0 ? <p className="sub">まだ装備はありません。宝箱を開けると、生活の味方が出ます。</p> : <div className="equipmentGrid">{inventory.map((item) => <EquipmentCard key={item.uid} item={item} equipped={state.equipped?.[item.slot] === item.uid} equipItem={equipItem} sellEquipment={sellEquipment} toggleLock={toggleLock} />)}</div>}</div></Modal>;
}

function EquipmentCard({ item, equipped, equipItem, sellEquipment, toggleLock }: { item: EquipmentItem; equipped?: boolean; equipItem?: (uid: string) => void; sellEquipment: (uid: string) => void; toggleLock: (uid: string) => void }) {
  return <div className={`equipmentCard ${item.rarity} ${equipped ? 'equipped' : ''} ${item.locked ? 'locked' : ''}`}><div className="equipmentTop"><div><small>{EQUIPMENT_RARITY_LABELS[item.rarity]} / {EQUIPMENT_SLOT_LABELS[item.slot]}</small><b>{item.name}</b></div><div className="equipmentBadges">{equipped && <span className="equipBadge">装備中</span>}{item.locked && <span className="lockBadge">保護</span>}</div></div><p>{item.description}</p><ul>{item.options.map((option) => <li key={option.id}>{equipmentOptionText(option)}</li>)}</ul><div className="equipmentActions">{equipItem && <button className="primary" onClick={() => equipItem(item.uid)} disabled={equipped}>装備</button>}<button onClick={() => toggleLock(item.uid)}>{item.locked ? '保護解除' : '保護'}</button><button onClick={() => sellEquipment(item.uid)} disabled={item.locked}>+{getEquipmentSellValue(item)}Gで売る</button></div></div>;
}

export function CollectionModal({ state, musings, achievements, onClose }: { state: GameState; musings: Musing[]; achievements: string[]; onClose: () => void }) {
  const [filter, setFilter] = useState<'all' | 'items' | 'equipment' | 'monsters' | 'musings' | 'achievements'>('all');
  const tabs = [
    { id: 'all', label: 'すべて' },
    { id: 'items', label: '発見物' },
    { id: 'equipment', label: '装備' },
    { id: 'monsters', label: '討伐' },
    { id: 'musings', label: 'ぼやき' },
    { id: 'achievements', label: '実績' },
  ] as const;
  return <Modal title="図鑑" description="発見物・装備・討伐・ぼやき・実績をまとめて確認する。" onClose={onClose} wide><CollectionSummary state={state} musings={musings} achievements={achievements} /><div className="bookTabs">{tabs.map((tab) => <button key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{tab.label}</button>)}</div><div className={`bookGrid ${filter !== 'all' ? 'single' : ''}`}>{(filter === 'all' || filter === 'items') && <DiscoveryBook state={state} />}{(filter === 'all' || filter === 'equipment') && <EquipmentBook state={state} />}{(filter === 'all' || filter === 'monsters') && <BestiaryBook state={state} />}{(filter === 'all' || filter === 'musings') && <MusingBook musings={musings} />}{(filter === 'all' || filter === 'achievements') && <AchievementBook achievements={achievements} />}</div></Modal>;
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

  const exportSave = () => {
    const saved = localStorage.getItem(SAVE_KEY) || '';
    setBackupText(saved);
    setBackupMessage(saved ? 'バックアップ文字列を作りました。' : 'まだ保存データがありません。');
  };
  const importSave = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
      localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
      setBackupMessage('セーブを取り込みました。画面を再読み込みします。');
      window.setTimeout(() => window.location.reload(), 350);
    } catch {
      setBackupMessage('取り込みに失敗しました。バックアップ文字列を確認してください。');
    }
  };

  return <Modal title="設定" description="音と表示、セーブ周りの設定。" onClose={onClose}><div className="settingsPanel"><SettingSlider icon="volume" label="BGM" value={settings.bgm} onChange={(bgm) => setSettings((current) => ({ ...current, bgm }))} /><SettingSlider icon="sliders" label="SE" value={settings.se} onChange={(se) => setSettings((current) => ({ ...current, se }))} /><label className="settingToggle"><span><b>連続SEを控えめにする</b><p>チャチャリン系を短いチャリンに寄せる。</p></span><input type="checkbox" checked={settings.simplifiedComboSe} onChange={(event) => setSettings((current) => ({ ...current, simplifiedComboSe: event.currentTarget.checked }))} /></label><div className="settingRow"><div><b>テキスト速度</b><p>ぼやきの表示演出の速さ。</p></div><div className="settingChoices"><button className={settings.textSpeed === 'normal' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, textSpeed: 'normal' }))}>標準</button><button className={settings.textSpeed === 'fast' ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, textSpeed: 'fast' }))}>速い</button></div></div><div className="dangerZone"><div><b>最初からやり直す</b><p>セーブデータを消して、勇者の労働生活を巻き戻す。</p></div><button onClick={reset}><Icon name="reset" /> リセット</button></div><div className="backupPanel"><div><b>セーブバックアップ</b><p>端末を変える前や、リセット前の保険に使う。</p></div><div className="backupActions"><button onClick={exportSave}><Icon name="book" /> 書き出す</button><button onClick={importSave} disabled={!importText.trim()}>取り込む</button></div><textarea value={backupText} onChange={(event) => setBackupText(event.currentTarget.value)} placeholder="書き出したセーブがここに表示されます。" readOnly /><textarea value={importText} onChange={(event) => setImportText(event.currentTarget.value)} placeholder="取り込むバックアップ文字列をここに貼り付けます。" />{backupMessage && <p className="backupMessage">{backupMessage}</p>}</div></div></Modal>;
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
  return <div className="collectionSummary"><SummaryPill label="発見物" value={`${foundItems}/${itemIds.length}`} /><SummaryPill label="装備" value={`${state.equipmentInventory?.length || 0}`} /><SummaryPill label="討伐" value={`${defeated}/${monsters.length}`} /><SummaryPill label="ぼやき" value={`${musings.length}`} /><SummaryPill label="実績" value={`${achievements.length}/${totalAchievements}`} /><SummaryPill label="仕事" value={`${unlockedJobs}/${totalJobs}`} /><SummaryPill label="拠点整備" value={`${ownedUpgrades}/${totalUpgrades}`} /></div>;
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

function EquipmentBook({ state }: { state: GameState }) {
  const inventory = state.equipmentInventory || [];
  return <Card title="装備図鑑"><p className="sub">拾った装備と開封ログ。良い装備ほど、勇者の働きたくなさを助ける。</p>{(state.openedChestLog || []).length > 0 && <div className="equipmentArchiveList">{state.openedChestLog.slice(0, 6).map((log, index) => <div className="equipmentArchive" key={`${log}-${index}`}><small>開封記録</small><b>{log}</b></div>)}</div>}{inventory.length === 0 ? <p className="sub">まだ装備はない。手ぶらも自由だが、効率は手ぶらに厳しい。</p> : <div className="equipmentArchiveList">{inventory.map((item) => <div className={`equipmentArchive ${item.rarity}`} key={item.uid}><small>{EQUIPMENT_RARITY_LABELS[item.rarity]} / {EQUIPMENT_SLOT_LABELS[item.slot]}</small><b>{item.name}</b><p>{item.options.map(equipmentOptionText).join(' / ')}</p></div>)}</div>}</Card>;
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
  return <div className={`monsterArchive ${defeated ? 'defeated' : ''}`}><div><b>{defeated ? monster.name : '？？？'}</b><span>{defeated ? `HP${monster.hp} / 攻撃${monster.attack}` : '未討伐'}</span></div><p>{defeated ? `落とすもの：${dropText || 'なし'}。勝てたなら、次はできれば会釈だけで済ませたい。` : 'まだ倒していない。名前を知らない不安は、だいたい強そうに見える。'}</p></div>;
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

function AchievementBook({ achievements }: { achievements: string[] }) {
  return <Card title="実績"><p className="sub">ユーモア寄りの節目。性能というより、勇者の人生ログ。</p>{Object.entries(ACHIEVEMENTS).map(([id, a]) => { const unlocked = achievements.includes(id); return <div className={`achievement ${unlocked ? 'unlocked' : ''}`} key={id}><b>{unlocked ? a.name : '？？？'}</b><p>{unlocked ? a.description : 'まだその瞬間は来ていない。来ないなら来ないで平和。'}</p></div>; })}</Card>;
}
