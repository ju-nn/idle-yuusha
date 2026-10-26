import { useEffect, useRef, useState } from 'react';
import cloudUrl from '../assets/sprites/hero/cloud.png';
import farHillsUrl from '../assets/sprites/hero/far-hills.png';
import leafUrl from '../assets/sprites/hero/leaf.png';
import moonUrl from '../assets/sprites/hero/moon.png';
import sunUrl from '../assets/sprites/hero/sun.png';
import heroAdventure from '../assets/sprites/hero/hero-adventure.png';
import heroFarming from '../assets/sprites/hero/hero-farming.png';
import heroFishing from '../assets/sprites/hero/hero-fishing.png';
import heroMerchant from '../assets/sprites/hero/hero-merchant.png';
import heroMining from '../assets/sprites/hero/hero-mining.png';
import heroOffice from '../assets/sprites/hero/hero-office.png';
import heroRemote from '../assets/sprites/hero/hero-remote.png';
import heroRest from '../assets/sprites/hero/hero-rest.png';
import heroShady from '../assets/sprites/hero/hero-shady.png';
import heroWoodcutting from '../assets/sprites/hero/hero-woodcutting.png';
import monsterBillWraith from '../assets/sprites/hero/monster-bill_wraith.png';
import monsterGoblin from '../assets/sprites/hero/monster-goblin.png';
import monsterQuietKing from '../assets/sprites/hero/monster-quiet_king.png';
import monsterRustArmor from '../assets/sprites/hero/monster-rust_armor.png';
import monsterSlime from '../assets/sprites/hero/monster-slime.png';
import monsterTaxMimic from '../assets/sprites/hero/monster-tax_mimic.png';
import monsterWolf from '../assets/sprites/hero/monster-wolf.png';
import propAdventure from '../assets/sprites/hero/prop-adventure.png';
import propFarming from '../assets/sprites/hero/prop-farming.png';
import propFishing from '../assets/sprites/hero/prop-fishing.png';
import propMerchant from '../assets/sprites/hero/prop-merchant.png';
import propMining from '../assets/sprites/hero/prop-mining.png';
import propOffice from '../assets/sprites/hero/prop-office.png';
import propRemote from '../assets/sprites/hero/prop-remote.png';
import propRest from '../assets/sprites/hero/prop-rest.png';
import propShady from '../assets/sprites/hero/prop-shady.png';
import propWoodcutting from '../assets/sprites/hero/prop-woodcutting.png';
import { jobs } from '../data/gameData';

const HERO_SHEETS: Record<string, string> = {
  fishing: heroFishing,
  woodcutting: heroWoodcutting,
  mining: heroMining,
  farming: heroFarming,
  merchant: heroMerchant,
  adventure: heroAdventure,
  rest: heroRest,
  office: heroOffice,
  remote: heroRemote,
  shady: heroShady,
};

const PROPS: Record<string, string> = {
  fishing: propFishing,
  woodcutting: propWoodcutting,
  mining: propMining,
  farming: propFarming,
  merchant: propMerchant,
  adventure: propAdventure,
  rest: propRest,
  office: propOffice,
  remote: propRemote,
  shady: propShady,
};

const MONSTER_SHEETS: Record<string, string> = {
  slime: monsterSlime,
  goblin: monsterGoblin,
  wolf: monsterWolf,
  rust_armor: monsterRustArmor,
  bill_wraith: monsterBillWraith,
  tax_mimic: monsterTaxMimic,
  quiet_king: monsterQuietKing,
};

// モンスター名 → id（gameData の全エリアから構築）
const MONSTER_ID_BY_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const job of Object.values(jobs)) {
    for (const area of job.areas) {
      for (const monster of area.monsters || []) map[monster.name] = monster.id;
    }
  }
  return map;
})();

// 葉が舞う屋外系の仕事
const LEAFY_JOBS = new Set(['woodcutting', 'farming', 'fishing', 'adventure']);

// ---------- 時間帯 ----------
type TimePhase = 'morning' | 'day' | 'dusk' | 'night';
function phaseForHour(hour: number): TimePhase {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'day';
  if (hour >= 16 && hour < 19) return 'dusk';
  return 'night';
}
function useTimePhase(): TimePhase {
  const [phase, setPhase] = useState<TimePhase>(() => phaseForHour(new Date().getHours()));
  useEffect(() => {
    const timer = window.setInterval(() => setPhase(phaseForHour(new Date().getHours())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return phase;
}

// ---------- 戦闘演出（combatLog の先頭ブロックから復元する表示専用レイヤー） ----------
type BattleEvent = {
  key: number;
  monsterId: string;
  name: string;
  won: boolean;
  attack: number;
  turns: number;
  xp: number | null;
};
type BattlePhase = 'enter' | 'fight' | 'defeat' | 'leave';

function parseBattle(log: string[]): Omit<BattleEvent, 'key'> | null {
  const head = log[0] || '';
  const match = head.match(/^(.+?)と遭遇/);
  if (!match) return null;
  const monsterId = MONSTER_ID_BY_NAME[match[1]];
  if (!monsterId || !MONSTER_SHEETS[monsterId]) return null;
  const block = log.slice(0, 8);
  const atkLine = block.find((line) => line.startsWith('勇者の攻撃力'));
  const attack = atkLine ? Number((atkLine.match(/攻撃力：(\d+)/) || [])[1] || 0) : 0;
  const winLine = block.find((line) => line.startsWith('勝利'));
  const won = Boolean(winLine);
  const turns = winLine ? Number((winLine.match(/：(\d+)手/) || [])[1] || 1) : 1;
  const xpLine = block.find((line) => line.startsWith('戦闘結果'));
  const xp = xpLine ? Number((xpLine.match(/\+(\d+)XP/) || [])[1] || 0) : null;
  return { monsterId, name: match[1], won, attack, turns, xp };
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HeroScene({ jobId, combatLog = [] }: { jobId: string; combatLog?: string[] }) {
  const sheet = HERO_SHEETS[jobId] || heroFishing;
  const prop = PROPS[jobId];
  const tod = useTimePhase();

  const [battle, setBattle] = useState<BattleEvent | null>(null);
  const [phase, setPhase] = useState<BattlePhase>('enter');
  const [slash, setSlash] = useState(0);
  const [pops, setPops] = useState<Array<{ id: number; value: number }>>([]);
  const heroWrapRef = useRef<HTMLDivElement>(null);
  const monsterRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const lastLogRef = useRef<string[] | null>(null);
  const battleIdRef = useRef(0);

  // 仕事が変わったら戦闘演出は畳む
  useEffect(() => {
    if (jobId !== 'adventure') {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      setBattle(null);
      setPops([]);
    }
  }, [jobId]);

  useEffect(() => () => { timersRef.current.forEach((t) => window.clearTimeout(t)); }, []);

  // combatLog の変化から新しい戦闘を検出する（初回観測は読み込み直後の誤発防止にスキップ）
  useEffect(() => {
    if (lastLogRef.current === null) { lastLogRef.current = combatLog; return; }
    if (lastLogRef.current === combatLog) return;
    lastLogRef.current = combatLog;
    if (jobId !== 'adventure') return;
    const parsed = parseBattle(combatLog);
    if (!parsed) return;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };
    battleIdRef.current += 1;
    setBattle({ ...parsed, key: battleIdRef.current });
    setPhase('enter');
    setSlash(0);
    setPops([]);
    const slashes = Math.max(1, Math.min(3, parsed.turns || 1));
    later(() => setPhase('fight'), 480);
    for (let i = 1; i <= slashes; i += 1) {
      const at = 480 + (i - 1) * 430;
      later(() => {
        setSlash(i);
        setPops((current) => [...current.slice(-2), { id: i, value: parsed.attack }]);
        if (!reducedMotion()) {
          heroWrapRef.current?.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(30px)', offset: 0.35 }, { transform: 'translateX(0)' }],
            { duration: 430, easing: 'ease-in-out' },
          );
          monsterRef.current?.animate(
            [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: 'translateX(5px)', filter: 'brightness(2.1)' }, { transform: 'translateX(0)', filter: 'brightness(1)' }],
            { duration: 300, easing: 'ease-out' },
          );
          if (!parsed.won && i === slashes) {
            heroWrapRef.current?.animate(
              [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
              { duration: 380, delay: 200, easing: 'ease-in-out' },
            );
          }
        }
      }, at);
    }
    const endAt = 480 + slashes * 430 + 140;
    if (parsed.won) {
      later(() => setPhase('defeat'), endAt);
      later(() => { setBattle(null); setPops([]); }, endAt + 1000);
    } else {
      later(() => setPhase('leave'), endAt);
      later(() => { setBattle(null); setPops([]); }, endAt + 560);
    }
  }, [combatLog, jobId]);

  const showBattle = jobId === 'adventure' && battle !== null;

  return (
    <div className={`heroScene job-${jobId} tod-${tod}`} aria-hidden="true">
      <div className="sceneFar" style={{ backgroundImage: `url(${farHillsUrl})` }} />
      <div className="sceneShade" />
      {tod === 'night'
        ? <img className="sceneCelestial" src={moonUrl} alt="" />
        : <img className={`sceneCelestial sun tod-${tod}`} src={sunUrl} alt="" />}
      {tod === 'night' && <div className="sceneStars" />}
      <img className="sceneCloud cloudA" src={cloudUrl} alt="" />
      <img className="sceneCloud cloudB" src={cloudUrl} alt="" />
      {LEAFY_JOBS.has(jobId) && (
        <>
          <img className="sceneLeaf leafA" src={leafUrl} alt="" />
          <img className="sceneLeaf leafB" src={leafUrl} alt="" />
          <img className="sceneLeaf leafC" src={leafUrl} alt="" />
        </>
      )}
      <div className="heroWrap" ref={heroWrapRef}>
        <div className="heroSprite" style={{ backgroundImage: `url(${sheet})` }} />
      </div>
      {prop && <img className="sceneProp" src={prop} alt="" />}
      {showBattle && (
        <>
          <div className="monsterName">{battle.name}</div>
          <div
            className={`monsterSprite phase-${phase}`}
            ref={monsterRef}
            style={{ backgroundImage: `url(${MONSTER_SHEETS[battle.monsterId]})` }}
          />
          {phase === 'fight' && slash > 0 && <div className="slashFx" key={`slash-${battle.key}-${slash}`} />}
          {pops.map((pop) => (
            <div className="dmgPop" key={`pop-${battle.key}-${pop.id}`}>-{pop.value}</div>
          ))}
          {phase === 'defeat' && battle.xp !== null && <div className="rewardPop">+{battle.xp} XP</div>}
        </>
      )}
      <div className="sceneGround" />
    </div>
  );
}
