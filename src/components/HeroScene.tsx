import cloudUrl from '../assets/sprites/hero/cloud.png';
import leafUrl from '../assets/sprites/hero/leaf.png';
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

// 葉が舞う屋外系の仕事
const LEAFY_JOBS = new Set(['woodcutting', 'farming', 'fishing', 'adventure']);

export function HeroScene({ jobId }: { jobId: string }) {
  const sheet = HERO_SHEETS[jobId] || heroFishing;
  const prop = PROPS[jobId];
  return (
    <div className={`heroScene job-${jobId}`} aria-hidden="true">
      <img className="sceneCloud cloudA" src={cloudUrl} alt="" />
      <img className="sceneCloud cloudB" src={cloudUrl} alt="" />
      {LEAFY_JOBS.has(jobId) && (
        <>
          <img className="sceneLeaf leafA" src={leafUrl} alt="" />
          <img className="sceneLeaf leafB" src={leafUrl} alt="" />
          <img className="sceneLeaf leafC" src={leafUrl} alt="" />
        </>
      )}
      <div className="heroSprite" style={{ backgroundImage: `url(${sheet})` }} />
      {prop && <img className="sceneProp" src={prop} alt="" />}
      <div className="sceneGround" />
    </div>
  );
}
