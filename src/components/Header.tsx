import type { ReactNode } from 'react';
import type { GameState } from '../types';
import { Icon, type IconName } from './Icon';

function Stat({ icon, label, value }: { icon: IconName; label: string; value: ReactNode }) {
  return <div className="stat"><Icon name={icon} /><span><small>{label}</small><b>{value}</b></span></div>;
}

export function Header({ compact, state, foundCount, musingCount, openCollection, openSettings }: { compact: boolean; state: GameState; foundCount: number; musingCount: number; openCollection: () => void; openSettings: () => void }) {
  return <header className={`header ${compact ? 'compact' : ''}`}><div className="headerTop"><div className="brandBlock"><span className="brandKicker"><Icon name="home" /> 生活防衛RPG</span><h1>勇者は働きたくない。</h1><p>今日を回して、少しだけ自由に近づく。報酬は出来事の瞬間に入り、ぼやきは図鑑に残る。</p></div><div className="actions"><button className="utilityButton" onClick={openCollection} title={`発見${foundCount} / ぼやき${musingCount}`}><Icon name="book" /> 図鑑 <span>{musingCount}</span></button><button className="utilityButton" onClick={openSettings} title="設定"><Icon name="settings" /> 設定</button></div></div><div className="statGrid"><Stat icon="coin" label="所持金" value={`${state.gold}G`} /><Stat icon="heart" label="HP" value={`${state.hp}/${state.maxHp}`} /><Stat icon="zap" label="MP" value={`${state.mp}/${state.maxMp}`} /><Stat icon="fish" label="魚" value={state.resources.fish} /><Stat icon="tree" label="木材" value={state.resources.wood} /><Stat icon="pickaxe" label="鉱石" value={state.resources.ore} /></div></header>;
}
