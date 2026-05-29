import type { Job, Musing, MusingType, ResourceKey } from '../types';

function resolveMusingType(category = 'normal', eventType?: string): MusingType {
  const source = eventType || category;
  if (source === 'level_up') return 'milestone';
  if (source === 'unlock' || source === 'upgrade' || source === 'new_area' || source === 'new_monster') return 'event';
  return 'event';
}

const M = (text: string, rewardItems: Musing['rewardItems'] = [], category = 'normal', eventType?: string): Musing => ({
  text,
  rewardItems,
  category,
  eventType: resolveMusingType(category, eventType),
  eventSubType: eventType || category,
  once: category === 'unlock' || eventType === 'unlock',
});
const D = (item: string, chance: number, amount: [number, number] = [1, 1]) => ({ item, chance, amount });

const jobs: Record<string, Job> = {
  fishing: {
    name: '釣り', type: 'idle', description: '無料で食料と小銭を得る。低リスク。ただし、暇。', unlock: { type: 'start' },
    areas: [
      { id: 'pond', name: 'しょぼい池', summary: '安全。無料。釣れるものもしょぼい。', seconds: 5, rewards: { gold: [2, 5], fish: [1, 2], xp: 8 }, drops: [D('small_fish', 0.65, [1, 2]), D('quiet_scale', 0.06), D('field_note', 0.04)], failChance: 0.20, failMusings: ['魚に逃げられた。やっぱり釣りは魚が主役だ', '糸がちぎれた。ツルハシより繊細なものは扱えない', '浮きが沈んだと思ったら根掛かりだった。魚じゃなかった', '竿を上げたら何もついていなかった。えさだけが無料だった', '魚がえさを食べた。逃げた。俺の時間も逃げた', '風が吹いて糸が絡まった。自然は釣りを応援してない'], musings: [
        M('勇者はしょぼい池に糸を垂らした。\n\n勇者「無料で食料が手に入るって聞くと最高だけど時間の溶け方も無料じゃない」', [{ item: 'small_fish', amount: 1 }]),
        M('水面は静かだった。魚も静かだった。つまり釣れていない。\n\n勇者「何もしてないよりは釣り糸が働いてる。たぶん」\n\n勇者は池の畔に座り込んだ。糸を垂らして何もしない。それが仕事だと言われてもまだ実感がない。\n\n勇者「休憩の許可証を手に入れた。これで休めるのか。いや休むための許可が必要な時点でもう休めてない」\n\n勇者は立ち上がった。休憩の準備をする。それは休むことへの準備でもあり休めないことへの準備でもあった。', [{ item: 'permission_to_rest', amount: 1 }], 'unlock', 'unlock'),
        M('勇者「小魚一匹でも、今日の食費が少し減る。大きな成功じゃなくても、生活はこういうので耐えるんだよな」', [{ item: 'small_fish', amount: 1 }]),
      ] },
      { id: 'river', name: '大きな川', summary: '効率は上がる。人も増える。静けさは減る。', unlock: { type: 'jobLevel', job: 'fishing', level: 3 }, seconds: 6, rewards: { gold: [5, 12], fish: [2, 4], xp: 12 }, drops: [D('small_fish', 0.8, [2, 4])], failChance: 0.30, failMusings: ['流れが強くて魚を持っていかれた。川、急に上司みたいな顔をする', '大物だと思ったら流木だった。期待だけ先に釣れていた', '釣り糸が対岸の木に絡まった。これは釣りではなく問題だ', '隣の人に先に釣られた。魚にも順番待ち文化があるらしい', '川の流れが変わった。魚も変わった。俺は変わらない', '隣の人の糸が俺の糸に絡まった。他人との距離感が難しい'], musings: [M(`大きな川に来た。魚影は増えた。人影も増えた。\n\n勇者「効率のいい場所って、だいたい他人もいるんだよな。魚より先に空いてる場所を探している」`, [{ item: 'quiet_scale', amount: 1 }]), M('大きな川で釣りをした。魚は釣れた。でも静けさは釣れなかった。\n\n勇者「効率は上がった。静けさは下がった。休日の収支としては微妙だな」', [{ item: 'quiet_scale', amount: 1 }])] },
    ],
    upgrades: [
      { id: 'fishing_better_rod', name: '中古の釣り竿', description: '釣れる気が少しする。現実でも"気がする"は大事。', cost: { gold: 30, resources: { fish: 4 } }, effects: { maxMp: 5, failReduction: 0.08 }, log: '釣りへの心理的抵抗が少し減った。失敗も少し減った。', level: 2 },
      { id: 'fishing_lure', name: 'ルアー', description: '魚の気を引くための疑似餌。釣り人の自尊心を少し守る。', cost: { gold: 50, resources: { fish: 8 } }, effects: { maxMp: 8, failReduction: 0.07 }, log: '魚を騙す技術が少し上達した。逃げられる率も下がった。', level: 3 },
      { id: 'fishing_boat', name: '小さなボート', description: '沖に出られる。風も来る。生活も少し揺れる。', cost: { gold: 120, resources: { wood: 20, fish: 15 } }, effects: { maxMp: 15, maxHp: 5, failReduction: 0.10 }, log: '海に出る勇気と、船酔いの予感を手に入れた。', level: 5 },
    ],
    levelMusings: {
      1: [
        M('釣りLv1：勇者は釣りを始めた。\n\n勇者「魚は釣れないが、俺の時間だけは順調に釣られている。まずは一匹でいいんだが」', [{ item: 'small_fish', amount: 1 }], 'level_up'),
      ],
      2: [
        M('釣りLv2：糸の感覚が少しわかってきた。\n\n勇者「魚がかかった重みと、予定が増えた重みは似てる。どっちも急に現実になる」', [{ item: 'small_fish', amount: 2 }], 'level_up'),
      ],
      3: [
        M('釣りLv3：川の流れを読めるようになった。\n\n勇者「流れを読む力がついた。人生にも浮きを付けたい。沈んだらすぐ分かるやつ」', [{ item: 'quiet_scale', amount: 1 }], 'level_up'),
      ],
      4: [
        M('釣りLv4：魚の習性が少しわかってきた。\n\n勇者「魚はえさを見ると寄ってくる。俺も給料日には元気になる。生き物として大差ないな」', [{ item: 'small_fish', amount: 3 }], 'level_up'),
      ],
      5: [
        M('釣りLv5：釣り師としての自信がついた。\n\n勇者「釣れない時間に慣れてきた。履歴書には書けないが、生活には地味に効く」', [{ item: 'quiet_scale', amount: 2 }], 'level_up'),
      ],
      6: [
        M('釣りLv6：天候との戦い方を覚えた。\n\n勇者「雨の日は魚より先に俺のやる気が深場へ潜る。釣り上げる道具がない」', [{ item: 'small_fish', amount: 4 }], 'level_up'),
      ],
      7: [
        M('釣りLv7：釣り場の見極めがついた。\n\n勇者「場所選びが8割。残りは運と待ち時間。人生にも釣れやすい岸辺が欲しい」', [{ item: 'quiet_scale', amount: 3 }], 'level_up'),
      ],
      8: [
        M('釣りLv8：釣りが生活の一部になった。\n\n勇者「竿を持つと自然に体が動く。働くより先に釣りが習慣化したの、順番としては正しい」', [{ item: 'small_fish', amount: 5 }], 'level_up'),
      ],
      9: [
        M('釣りLv9：釣り師としての誇りが生まれた。\n\n勇者「釣れる時は釣る。釣れない時は座る。財布だけが休憩を認めてくれない」', [{ item: 'quiet_scale', amount: 4 }], 'level_up'),
      ],
      10: [
        M('釣りLv10：釣りの達人になった。\n\n勇者「魚の気配が少し分かる。分かったところで魚は家賃を払ってくれない。そこだけ惜しい」', [{ item: 'small_fish', amount: 6 }], 'level_up'),
      ],
    },
  },
  rest: { name: '休憩', type: 'idle', description: 'お金は増えない。でも壊れないために必要。かなり大事。', unlock: { type: 'item', item: 'permission_to_rest', amount: 1 }, areas: [{ id: 'nap', name: '短い昼寝', summary: '手軽に回復。罪悪感も少し来る。', seconds: 5, rewards: { xp: 7 }, drops: [D('field_note', 0.05), D('red_flag', 0.03), D('mute_button', 0.03)], failChance: 0, failMusings: [], musings: [M('勇者は短い昼寝をした。世界は救われていない。だが腰は少し救われた。まず腰から救国していく。'), M('勇者「何もしなかった。でも何も壊さなかった。今日はそれで勝ちでもいいか」\n\n勇者は地面に横たわった。空を見上げる。雲が流れていく。\n\n勇者「休むって、結構難しいんだよな。何もしないって、結構勇気がいる。休息にも練習がいるなら、俺は今かなり真面目に訓練している」\n\n勇者は目を閉じた。世界が遠ざかる。でも、完全には消えない。それは、まだ完全に休めていない証拠でもあった。\n\n勇者「少しずつ、休めるようになるといいな。せめて罪悪感だけ先に退勤してほしい」', [{ item: 'field_note', amount: 1 }], 'unlock', 'unlock')] }], upgrades: [
    { id: 'rest_comfy_pillow', name: '快適な枕', description: '昼寝の質が上がる。罪悪感も少し下がる。', cost: { gold: 40, resources: {} }, effects: { maxMp: 6 }, log: '枕の高さが、人生の高さに合った気がする。', level: 2 },
    { id: 'rest_eye_mask', name: 'アイマスク', description: '光を遮断する。安心感を遮断しない。', cost: { gold: 60, resources: {} }, effects: { maxMp: 10 }, log: '世界が暗くなっても、心は少し明るくなった。', level: 3 },
  ],
  levelMusings: {
    1: [
      M('休憩Lv1：勇者は休むことを覚えた。\n\n勇者「何もしない時間を確保した。何もしないのに準備が必要なの、だいぶ高度だ」', [{ item: 'field_note', amount: 1 }], 'level_up'),
    ],
    2: [
      M('休憩Lv2：休憩の質が上がった。\n\n勇者「休むのが上手くなった。履歴書には書けないが、人生にはかなり効く」', [{ item: 'field_note', amount: 1 }], 'level_up'),
    ],
    3: [
      M('休憩Lv3：休憩が習慣になった。\n\n勇者「休む前に謝らなくなってきた。誰に謝ってたんだ、俺」', [{ item: 'field_note', amount: 2 }], 'level_up'),
    ],
    4: [
      M('休憩Lv4：休憩のコツがわかってきた。\n\n勇者「何もしないのが少し上手くなった。横になっているだけなのに、今日は妙に手応えがある」', [{ item: 'field_note', amount: 2 }], 'level_up'),
    ],
    5: [
      M('休憩Lv5：休憩の達人になった。\n\n勇者「休むのが上手くなった。問題は、休んでいる間も家賃は休んでくれないことだ」', [{ item: 'field_note', amount: 3 }], 'level_up'),
    ],
  },
},
  woodcutting: { name: '木こり', type: 'idle', description: '考えることが少なくて楽。成果は見える。手首は別意見。', unlock: { type: 'jobLevel', job: 'fishing', level: 2 }, areas: [{ id: 'backyard_tree', name: '裏庭の細い木', summary: '近い。簡単。あまり稼げない。', seconds: 6, rewards: { gold: [1, 4], wood: [2, 4], xp: 9 }, drops: [D('twig', 0.7, [1, 3]), D('hinoki_stick', 0.08), D('old_pickaxe', 0.06)], failChance: 0.15, failMusings: ['斧を木に挟まれた。道具に反撃された。貸した覚えはない', '刃の角度を間違えた。木は無言で採点が厳しい', '振りかぶりすぎて転んだ。敵がいないのに敗北演出が出た', '木が予想外の方向に倒れた。物理、たまに連絡なしで裏切る', '斧が滑った。木が逃げた。俺も逃げた。全員判断が早い', '木の硬さを舐めていた。手首だけが今日の成果を覚えている'], musings: [M('裏庭の木を切った。\n\n勇者「頭を使わない作業はありがたい。手首だけは、はっきり反対している」', [{ item: 'twig', amount: 1 }]), M('勇者は『ひのきのぼう』を手に入れた。\n\n勇者「棒だ。どう見ても棒だ。でも手に持つと、なぜか\"何か倒せる側\"になった気がする。危ない自己肯定感だな」\n\n勇者は棒を振ってみた。空を切る。でも、空を切った感覚がある。\n\n勇者「武器を持つって、こういうことか。相手がいなくても、自分が少し物騒になる」\n\n勇者は棒を腰に差した。まだ戦う相手はいない。でも、戦う準備はできた。それは、逃げる判断を少し遅らせる準備でもあった。', [{ item: 'hinoki_stick', amount: 1 }], 'unlock', 'unlock'), M('木の根元から古びたツルハシが出てきた。\n\n勇者「道具が出ると、やれる仕事が増える。便利って、だいたい面倒の招待状なんだよな」', [{ item: 'old_pickaxe', amount: 1 }], 'unlock')] }], upgrades: [
    { id: 'woodcutting_wrist_care', name: '手首ケアセット', description: '木こりのあとに手首へ謝罪するための道具。', cost: { gold: 45, resources: { wood: 10 } }, effects: { maxHp: 10, failReduction: 0.08 }, log: '身体コストを無視しない勇者になった。斧の扱いも少し慣れた。', level: 2 },
    { id: 'woodcutting_axe', name: 'まともな斧', description: '裏庭の木にはオーバースペック。でも安心感は別。', cost: { gold: 80, resources: { wood: 15, ore: 5 } }, effects: { maxHp: 15, failReduction: 0.07 }, log: '切るという行為が、少し楽になった。失敗も少し減った。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('木こりLv1：勇者は木を切り始めた。\n\n勇者「頭を使わない作業はありがたい。手首だけは、はっきり反対している」', [{ item: 'twig', amount: 1 }], 'level_up'),
    ],
    2: [
      M('木こりLv2：斧の振り方が少しわかってきた。\n\n勇者「力任せよりタイミング。仕事もそうなら、俺はもっと早く斧から学ぶべきだった」', [{ item: 'twig', amount: 2 }], 'level_up'),
    ],
    3: [
      M('木こりLv3：木の倒れる方向が読めるようになった。\n\n勇者「木は倒れる前にちゃんと気配を出す。俺の予定も見習ってほしい」', [{ item: 'twig', amount: 3 }], 'level_up'),
    ],
    4: [
      M('木こりLv4：木こり師としての自信がついた。\n\n勇者「切るのは上手くなった。問題は、上手い人ほど次の木を任されることだ」', [{ item: 'hinoki_stick', amount: 1 }], 'level_up'),
    ],
    5: [
      M('木こりLv5：木こりの達人になった。\n\n勇者「斧が体になじんできた。手首だけは、まだ契約内容に納得していない」', [{ item: 'twig', amount: 5 }], 'level_up'),
    ],
  },
},
  merchant: { name: '商人', type: 'idle', description: '集めた素材を自動で売ってGに変える。夢は薄利多売、現実は在庫管理。', unlock: { type: 'jobLevel', job: 'woodcutting', level: 2 }, areas: [
    { id: 'fish_stall', name: '魚の露店', summary: '魚を少しずつ売る。釣り人から急に個人事業主へ。', seconds: 5, rewards: { xp: 8 }, sell: { resource: 'fish', amount: [1, 2], price: 3 }, drops: [D('merchant_license', 0.1)], failChance: 0.10, failMusings: ['値段交渉で折れた。客の圧が強かった', '売れると思っていた魚が売れなかった。市場は気分屋だ', '看板を見て来た客が何も買わなかった。宣伝の限界だ', '値下げしたら客が来た。でも利益が消えた', '魚が腐った。時間が商品を食べた', '客が値切った。俺の時間も値切られた'], musings: [M('勇者は魚を並べて売り始めた。\n\n勇者「さっきまで食料だった魚が、値札を付けた瞬間に在庫になった。商売、急に現実だな」\n\n勇者は露店の前に立った。客が来るのを待つ。待つ時間が、釣りの時間より長い気がする。\n\n勇者「自分で集めたものを、自分で売る。自由っぽいけど、売れるかどうかは通行人の気分だ」\n\n勇者は値札を見た。3G。安いのか高いのか、わからない。でも、夕飯には近づいた気がした。', [{ item: 'merchant_license', amount: 1 }], 'unlock', 'unlock')] },
    { id: 'wood_bundle', name: '木材の束売り', summary: '木材をまとめて売る。重いものは利益も腰も重い。', seconds: 6, unlock: { type: 'jobLevel', job: 'woodcutting', level: 1 }, rewards: { xp: 9 }, sell: { resource: 'wood', amount: [2, 4], price: 2 }, drops: [], failChance: 0.10, failMusings: ['重すぎて運ぶ途中で落とした。腰が先に請求書を出した', '束がばらけた。結び方が甘かった', '客が値切った。木材も値切られた', '雨に濡れて木材が膨れた。商品が太った', '客が品定めをして買わなかった。俺の時間も品定めされた'], musings: [M('勇者は木材を束にして売った。\n\n勇者「木を切って、束ねて、売る。これもう労働のフルコースでは？」')] },
    { id: 'ore_buyer', name: '鉱石の買い取り', summary: '鉱石を高く売る。単価はいいが、そもそも掘るのがしんどい。', seconds: 7, unlock: { type: 'item', item: 'old_pickaxe', amount: 1 }, rewards: { xp: 10 }, sell: { resource: 'ore', amount: [1, 2], price: 8 }, drops: [], failChance: 0.10, failMusings: ['買い取り価格が下がっていた。市場は約束しない', '鉱石の品質を指摘された。掘るより選別が大事らしい', '客が値切った。鉱石も値切られた', '鉱石が混ざっていた。選別が甘かった', '客が品定めをして買わなかった。俺の時間も品定めされた'], musings: [M('鉱石はいい値で売れた。\n\n勇者「高く売れる素材は、だいたい集めるまでに腰が先払いしている」')] },
    { id: 'adventure_salvage', name: '冒険素材の買い取り', summary: '戦利品を売る。戦ったあとに値札を付けると急に現実。', unlock: { type: 'jobLevel', job: 'adventure', level: 2 }, seconds: 8, rewards: { xp: 12 }, sellItems: [{ item: 'slime_jelly', amount: [1, 3], price: 7 }, { item: 'goblin_ear', amount: [1, 1], price: 16 }, { item: 'wolf_fang', amount: [1, 1], price: 22 }], drops: [D('merchant_license', 0.04)], failChance: 0.14, failMusings: ['戦利品の説明に困った。正直に言うと売れにくい', '買い取り表にないと言われた。世界にも対象外がある', '状態が悪いと言われた。戦闘後のものに新品感を求めないでほしい', '鑑定待ちで時間が溶けた。価値判断も労働だ'], musings: [M('冒険素材を売った。戦利品が生活費に変わる瞬間、勇者は少しだけ商売を信じた。\n\n勇者「倒した相手の素材で夕飯を買う。倫理は後で考える。今は米だ」')] },
    { id: 'castle_salvage', name: '城跡骨董市', summary: '古い鎧片を売る。歴史的価値と生活費が同じ箱に入る。', unlock: { type: 'jobLevel', job: 'adventure', level: 6 }, seconds: 10, rewards: { xp: 16 }, sellItems: [{ item: 'rusty_armor_plate', amount: [1, 2], price: 28 }, { item: 'castle_key_fragment', amount: [1, 1], price: 42 }, { item: 'quiet_crown', amount: [1, 1], price: 90 }], drops: [D('overdue_notice', 0.03)], failChance: 0.18, failMusings: ['骨董商に長い顔をされた。価値の顔が読めない', '錆び具合を褒められた。褒め方にも種類がある', '由来を聞かれて黙った。拾った、は弱い', '値段が思ったより渋い。歴史にも相場がある'], musings: [M('城跡の古い鎧片を売った。伝説の残骸にも値札は付く。\n\n勇者「歴史的価値って、腹が減ってる時はだいたい売却価格に翻訳される」', [{ item: 'overdue_notice', amount: 1 }], 'unlock')] },
  ], upgrades: [
    { id: 'merchant_sign', name: '看板', description: '店の存在をアピールする。客が来るかは別問題。', cost: { gold: 55, resources: { wood: 12 } }, effects: { maxMp: 8, failReduction: 0.05 }, log: '店の看板を掲げた。客の流れが少し変わった。', level: 2 },
    { id: 'merchant_cart', name: '手押し車', description: '在庫を運べる。腰への負担も運べる。', cost: { gold: 100, resources: { wood: 25, ore: 8 } }, effects: { maxHp: 12, failReduction: 0.05 }, log: '運搬の負担が少し減った。値段交渉の負担は減っていない。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('商人Lv1：勇者は商売を始めた。\n\n勇者「自分で集めたものを自分で売る。急に魚が食料じゃなくて在庫に見えてきた」', [{ item: 'merchant_license', amount: 1 }], 'level_up'),
    ],
    2: [
      M('商人Lv2：市場の動きが少しわかってきた。\n\n勇者「昨日売れた魚が今日は売れない。市場、気分で献立を変えないでほしい」', [{ item: 'merchant_license', amount: 1 }], 'level_up'),
    ],
    3: [
      M('商人Lv3：値段交渉が少し上手くなった。\n\n勇者「値切られても少し粘れるようになった。俺の小声に値札が付いてきたな」', [{ item: 'merchant_license', amount: 2 }], 'level_up'),
    ],
    4: [
      M('商人Lv4：商人としての自信がついた。\n\n勇者「売るのが上手くなった。売れるほど在庫を探す。商売、片付けても散らかる部屋に似てる」', [{ item: 'merchant_license', amount: 2 }], 'level_up'),
    ],
    5: [
      M('商人Lv5：商人の達人になった。\n\n勇者「売れる品が読めてきた。自分の財布だけは、相変わらず中身が読めない」', [{ item: 'merchant_license', amount: 3 }], 'level_up'),
    ],
  },
},
  farming: { name: '農業', type: 'farming', description: '種を植えて、時間経過で収穫する。自動放置とは少し違う体験。', unlock: { type: 'jobLevel', job: 'rest', level: 2 }, areas: [{ id: 'tiny_field', name: '小さな畑', summary: 'しょぼい大根を植えられる。', seconds: 10, rewards: { xp: 10 }, drops: [D('daikon_seed', 0.8)], failChance: 0, failMusings: [], musings: [M('勇者は『小さな畑のメモ』を見つけた。\n\n勇者「労働は嫌だけど、勝手に育つものは好きだ。俺の代わりに野菜が頑張ってくれるなら、こんなにありがたいことはない」\n\n勇者は畑の前に立った。土が耕されている。種を植える準備ができている。\n\n勇者「種を植えて、水をやって、待つ。それだけ。でも、待つ時間が、収穫への期待になる」\n\n勇者は種を手に取った。小さな種。これが大根になる。\n\n勇者「俺が頑張らなくても、野菜は育つ。俺が休んでいる間も、野菜は働いている。これが理想の労働形態では？」\n\n勇者は種を土に埋めた。土をかぶせる。水をやる。あとは待つだけだ。\n\n勇者「待つ時間も、労働の一部だと思えば、罪悪感も少し減るかも」', [{ item: 'daikon_seed', amount: 1 }], 'unlock', 'unlock')] }], upgrades: [
    { id: 'farming_hoe', name: '鍬', description: '土を耕す道具。耕すという言葉が、なんだか人生めいた。', cost: { gold: 50, resources: { wood: 10 } }, effects: { maxMp: 8 }, log: '土を耕す準備ができた。人生を耕す準備は、まだ。', level: 2 },
    { id: 'farming_watering_can', name: 'じょうろ', description: '水をやる。植物が喜ぶかは、植物に聞いて。', cost: { gold: 70, resources: { wood: 15 } }, effects: { maxMp: 12 }, log: '水やり道具を手に入れた。植物の反応は、まだ見ていない。', level: 3 },
  ],
  levelMusings: {
    1: [
      M('農業Lv1：勇者は農業を始めた。\n\n勇者「種を植えた。俺が寝ている間に成長するなら、だいぶ話の分かる職場だ」', [{ item: 'daikon_seed', amount: 1 }], 'level_up'),
    ],
    2: [
      M('農業Lv2：土の状態が少しわかってきた。\n\n勇者「土が乾くと野菜も俺も元気がなくなる。水やり、ほぼ自分への遠回しな介護だ」', [{ item: 'daikon_seed', amount: 1 }], 'level_up'),
    ],
    3: [
      M('農業Lv3：野菜の成長が楽しみになってきた。\n\n勇者「俺が頑張らなくても野菜は育つ。野菜、労務管理がかなり優秀だ」', [{ item: 'daikon_seed', amount: 2 }], 'level_up'),
    ],
    4: [
      M('農業Lv4：収穫のタイミングがわかってきた。\n\n勇者「早すぎても遅すぎてもダメ。大根の方が俺より締め切りに厳しい」', [{ item: 'daikon_seed', amount: 2 }], 'level_up'),
    ],
    5: [
      M('農業Lv5：農業の達人になった。\n\n勇者「野菜の様子が分かるようになった。返事はないけど、収穫で結果を出すタイプだ」', [{ item: 'daikon_seed', amount: 3 }], 'level_up'),
    ],
  },
},
  mining: { name: '採掘', type: 'idle', description: '一発当てたい気持ちで掘る。素材は強いが体力消耗も強い。', unlock: { type: 'jobLevel', job: 'woodcutting', level: 3 }, areas: [{ id: 'loose_rocks', name: '崩れかけの岩場', summary: '初歩の採掘場。腰に来る。', seconds: 7, rewards: { gold: [3, 9], ore: [1, 3], xp: 11 }, drops: [D('pebble_ore', 0.75, [1, 3])], failChance: 0.25, failMusings: ['岩が崩れた。採掘というより逃走だった', '鉱脈を外した。勘は信頼できない', 'ツルハシが跳ね返った。岩が思ったより硬かった', '掘った穴が埋まった。自然は仕事を戻してくる', '岩粉が目に入った。採掘は目も掘る', '腰が悲鳴を上げた。岩は無言だ'], musings: [M('崩れかけの岩場で鉱石を掘った。\n\n勇者「一発当てたい気持ちが、ツルハシに出てるな」', [{ item: 'pebble_ore', amount: 1 }]), M('勇者は崩れかけの岩場に立った。\n\n勇者「採掘だ。岩を掘って鉱石を手に入れる。木こりより体力が要りそうだけど、報酬もいいらしい」\n\n勇者はツルハシを構えた。岩に向かって振り下ろす。岩が砕ける音が響く。\n\n勇者「新しい仕事は、新しい疲れを連れてくる。報酬がいいぶん、腰への説明が難しい」\n\n勇者は鉱石を拾い上げた。重い。でも、この重さは少しだけ生活費に近い。', [{ item: 'pebble_ore', amount: 1 }], 'unlock', 'unlock')] }], upgrades: [
    { id: 'mining_helmet', name: '採掘用ヘルメット', description: '頭を守る。思考は守らない。', cost: { gold: 65, resources: { ore: 10 } }, effects: { maxHp: 15, failReduction: 0.10 }, log: '頭の安全が確保された。崩れた岩にも少し対応できるようになった。', level: 2 },
    { id: 'mining_pickaxe', name: '新しいツルハシ', description: '掘る効率が上がる。腰の悲鳴も上がる。', cost: { gold: 90, resources: { wood: 20, ore: 15 } }, effects: { maxHp: 20, failReduction: 0.10 }, log: '道具が進化した。鉱脈を外す回数が少し減った。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('採掘Lv1：勇者は採掘を始めた。\n\n勇者「岩を掘ると鉱石が出る。ついでに腰から抗議も出る。採掘、出るものが多い」', [{ item: 'pebble_ore', amount: 1 }], 'level_up'),
    ],
    2: [
      M('採掘Lv2：岩の硬さが少しわかってきた。\n\n勇者「硬い岩ほどいい鉱石がある。つまり腰痛は高単価のサイン。嬉しくはない」', [{ item: 'pebble_ore', amount: 2 }], 'level_up'),
    ],
    3: [
      M('採掘Lv3：鉱脈の見つけ方が少しわかってきた。\n\n勇者「勘は外れる。でも当たると鉱石が出る。外れると腰だけが成果を出す」', [{ item: 'pebble_ore', amount: 3 }], 'level_up'),
    ],
    4: [
      M('採掘Lv4：採掘師としての自信がついた。\n\n勇者「掘るのが上手くなった。上手い分だけ、腰への説明責任も増えた」', [{ item: 'pebble_ore', amount: 4 }], 'level_up'),
    ],
    5: [
      M('採掘Lv5：採掘の達人になった。\n\n勇者「岩の割れやすい場所が分かる。俺の腰の割れやすい場所も、だいたい分かってきた」', [{ item: 'pebble_ore', amount: 5 }], 'level_up'),
    ],
  },
},
  adventure: { name: '冒険', type: 'adventure', description: 'エリアを探索して、たまにモンスターと出会う。自動戦闘で勝利を目指す。', unlock: { type: 'jobLevel', job: 'mining', level: 2 }, areas: [
    { id: 'forest', name: '薄暗い森', summary: '安全な探索場所。たまにスライムが出る。', seconds: 6, adventureCost: 8, rewards: { xp: 10 }, drops: [D('field_note', 0.08), D('twig', 0.15, [1, 2])], failChance: 0.10, failMusings: ['道に迷った。森は方向音痴の敵だ', '足元の木の根に躓いた。自然は意地悪だ', 'スライムに逃げられた。スライムは速い', '木の枝に引っかかった。森は俺を捕まえてる'], encounterChance: 0.25, monsters: [
      { id: 'slime', name: 'スライム', hp: 15, attack: 3, rewards: { gold: [5, 12], xp: 14 }, drops: [D('slime_jelly', 0.85, [1, 2])] },
    ], musings: [M('勇者は森を探索した。\n\n勇者「静かな森ほど、何か出そうで落ち着かない。静けさにも種類がある」', [{ item: 'field_note', amount: 1 }]), M('勇者は薄暗い森に足を踏み入れた。\n\n勇者「冒険だ。釣りや木こりと違って、向こうから面倒が歩いてくる」\n\n勇者は棒を握りしめた。武器だ。戦うための道具。\n\n勇者「勝てば報酬。負ければ痛い。説明は短いのに、全然楽じゃないな」\n\n勇者は森の奥を見た。暗い。帰り道の位置だけは、何度も確認した。', [{ item: 'field_note', amount: 1 }], 'unlock', 'unlock')] },
    { id: 'mountain', name: '山道', summary: '少し危険。ゴブリンが出るかもしれない。', unlock: { type: 'jobLevel', job: 'adventure', level: 2 }, seconds: 8, adventureCost: 18, rewards: { xp: 14 }, drops: [D('pebble_ore', 0.12, [1, 2])], failChance: 0.15, failMusings: ['岩が滑って落ちた。山は急だ', '霧が濃くなって迷った。視界は頼りにならない', 'ゴブリンに逃げられた。ゴブリンは賢い', '岩に躓いた。山は俺を落とそうとしてる'], encounterChance: 0.35, monsters: [
      { id: 'slime', name: 'スライム', hp: 15, attack: 3, rewards: { gold: [5, 12], xp: 14 }, drops: [D('slime_jelly', 0.85, [1, 2])] },
      { id: 'goblin', name: 'ゴブリン', hp: 25, attack: 5, rewards: { gold: [10, 20], xp: 18 }, drops: [D('goblin_ear', 0.7, [1, 1])] },
    ], musings: [M('勇者は山道を歩いた。\n\n勇者「空気が薄い。敵も薄いといいけど」'), M('山道を登った。足元が不安定。敵も不安定。\n\n勇者「高いところに行くほど、落ちる時の痛みが増す。家賃もそう」', [{ item: 'pebble_ore', amount: 1 }])] },
    { id: 'cave', name: '洞窟', summary: '危険。強い敵が出る。', unlock: { type: 'jobLevel', job: 'adventure', level: 4 }, seconds: 10, adventureCost: 32, rewards: { xp: 18 }, drops: [D('pebble_ore', 0.2, [2, 4])], failChance: 0.20, failMusings: ['暗すぎて壁にぶつかった。光が必要だ', '足元が崩れた。洞窟は予告なしに攻撃してくる', 'オオカミに逃げられた。オオカミは速い', '暗闇で迷った。洞窟は俺を捕まえてる'], encounterChance: 0.50, monsters: [
      { id: 'goblin', name: 'ゴブリン', hp: 25, attack: 5, rewards: { gold: [10, 20], xp: 18 }, drops: [D('goblin_ear', 0.7, [1, 1])] },
      { id: 'wolf', name: 'オオカミ', hp: 35, attack: 8, rewards: { gold: [15, 25], xp: 22 }, drops: [D('wolf_fang', 0.6, [1, 1])] },
    ], musings: [M('勇者は洞窟に入った。\n\n勇者「暗い。まず明かりが欲しい。勇気より先に足元だ」', [{ item: 'pebble_ore', amount: 2 }]), M('洞窟を探索した。暗いせいで、自分の足音だけがやけに聞こえる。\n\n勇者「誰もいないのに気まずい。洞窟、部屋より静かすぎる」', [{ item: 'pebble_ore', amount: 2 }])] },
    { id: 'old_castle_gate', name: '古い城門', summary: '終盤の探索地。歴史と請求書の気配が同居している。', unlock: { type: 'jobLevel', job: 'adventure', level: 6 }, seconds: 12, adventureCost: 55, rewards: { xp: 24 }, drops: [D('rusty_armor_plate', 0.24, [1, 2]), D('overdue_notice', 0.05)], failChance: 0.24, failMusings: ['門が重すぎた。歴史は開閉にもコストがある', '床石が抜けた。古い建物のレビューは信用できない', '風の音にびびった。音響だけなら魔王城級だ', '古い張り紙を読んだら気分が沈んだ。文字にも攻撃力がある'], encounterChance: 0.58, monsters: [
      { id: 'rust_armor', name: '錆びた鎧', hp: 50, attack: 10, rewards: { gold: [24, 40], xp: 28 }, drops: [D('rusty_armor_plate', 0.75, [1, 2])] },
      { id: 'bill_wraith', name: '督促状の影', hp: 62, attack: 12, rewards: { gold: [30, 52], xp: 34 }, drops: [D('overdue_notice', 0.55, [1, 1]), D('rusty_armor_plate', 0.35, [1, 2])] },
    ], musings: [M('古い城門に着いた。伝説の入口というより、閉店後の役所みたいな圧がある。\n\n勇者「城ってもっと夢がある場所だと思ってた。掲示板に督促状が貼ってあると急に現実だな」', [{ item: 'rusty_armor_plate', amount: 1 }], 'unlock'), M('城門の影を歩いた。足音が妙に大きく返ってくる。\n\n勇者「誰もいない場所ほど、自分の生活音がうるさい。俺、存在感だけはある」', [{ item: 'field_note', amount: 1 }])] },
    { id: 'inner_courtyard', name: '静かな中庭', summary: '城の奥。魔王より先に管理費の気配がする。', unlock: { type: 'jobLevel', job: 'adventure', level: 8 }, seconds: 14, adventureCost: 80, rewards: { xp: 32 }, drops: [D('castle_key_fragment', 0.18, [1, 1]), D('rusty_armor_plate', 0.22, [1, 2])], failChance: 0.26, failMusings: ['噴水が止まっていた。水道代の気配がする', '中庭で迷った。広い家は掃除も広い', '古い王冠の絵に見下ろされた。視線だけ高級だ', '石畳が微妙に沈んだ。歴史、足腰に来る'], encounterChance: 0.62, monsters: [
      { id: 'tax_mimic', name: '税箱ミミック', hp: 72, attack: 13, rewards: { gold: [38, 66], xp: 38 }, drops: [D('castle_key_fragment', 0.62, [1, 1]), D('overdue_notice', 0.28, [1, 1])] },
      { id: 'quiet_king', name: '静かな王の影', hp: 86, attack: 15, rewards: { gold: [48, 82], xp: 46 }, drops: [D('quiet_crown', 0.38, [1, 1]), D('castle_key_fragment', 0.44, [1, 1])] },
    ], musings: [M('静かな中庭に入った。ラスボスの前室というより、誰も掃除していない高級物件だ。\n\n勇者「広い家に憧れたこともある。でも掃除範囲を見たら、急にワンルームが王国に見える」', [{ item: 'castle_key_fragment', amount: 1 }], 'unlock'), M('城の奥は静かだった。静かすぎて、財布の中身まで聞こえそうだった。\n\n勇者「静けさは好きだけど、ここまで静かだと請求の足音が目立つな」', [{ item: 'field_note', amount: 1 }])] },
  ], upgrades: [
    { id: 'adventure_shield', name: '木の盾', description: '攻撃を少し防ぐ。不安は防がない。', cost: { gold: 70, resources: { wood: 15, ore: 5 } }, effects: { maxHp: 18, failReduction: 0.10 }, log: '盾を手に入れた。モンスターの攻撃を少し受け流せるようになった。', level: 2 },
    { id: 'adventure_potion', name: '回復薬セット', description: '戦闘後の回復が少し楽になる。', cost: { gold: 85, resources: { ore: 12 } }, effects: { maxMp: 15, maxHp: 10, failReduction: 0.10 }, log: '回復の準備ができた。戦闘での生存率が少し上がった。', level: 4 },
    { id: 'adventure_return_charm', name: '折りたたみ帰還札', description: '帰る判断を早くする札。逃げ道があると、前に出る勇気も少し出る。', cost: { gold: 180, resources: { ore: 24, wood: 18 } }, effects: { maxHp: 18, maxMp: 12, failReduction: 0.08 }, log: '帰り道を畳んで持てるようになった。危険な探索の失敗も少し減った。', level: 6 },
  ],
  levelMusings: {
    1: [
      M('冒険Lv1：勇者は冒険を始めた。\n\n勇者「モンスターと戦う仕事が始まった。給料日より先にHPが減るタイプの仕事だ」', [{ item: 'field_note', amount: 1 }], 'level_up'),
    ],
    2: [
      M('冒険Lv2：森の探索に慣れてきた。\n\n勇者「静かな森ほど何か出る。静かにしている敵、接客態度としては最悪だ」', [{ item: 'field_note', amount: 1 }], 'level_up'),
    ],
    3: [
      M('冒険Lv3：戦闘が少し安定してきた。\n\n勇者「生き残る手順が分かってきた。分かっても心臓だけは毎回新人みたいに慌てる」', [{ item: 'field_note', amount: 2 }], 'level_up'),
    ],
    4: [
      M('冒険Lv4：冒険者としての自信がついた。\n\n勇者「前に進むしかない日もある。せめて帰り道だけは自動で出てほしい」', [{ item: 'field_note', amount: 2 }], 'level_up'),
    ],
    5: [
      M('冒険Lv5：冒険の達人になった。\n\n勇者「モンスターの間合いが読める。読めたところで近寄ってくるのはやめてほしい」', [{ item: 'field_note', amount: 3 }], 'level_up'),
    ],
    6: [
      M('冒険Lv6：城跡へ向かう準備ができた。\n\n勇者「古い城って、宝箱より修繕費の匂いがする。夢の耐震基準が低い」', [{ item: 'field_note', amount: 3 }], 'level_up'),
    ],
    7: [
      M('冒険Lv7：危険な場所の歩き方が身についた。\n\n勇者「足音を消せるようになった。生活音も消せたら、もっと静かに生きられるのに」', [{ item: 'rusty_armor_plate', amount: 1 }], 'level_up'),
    ],
    8: [
      M('冒険Lv8：冒険を生活に組み込めるようになった。\n\n勇者「危険を予定表に入れるのは嫌だ。でも予定に入れた危険は、少しだけ管理できる」', [{ item: 'overdue_notice', amount: 1 }], 'level_up'),
    ],
    9: [
      M('冒険Lv9：城の奥の空気に慣れてきた。\n\n勇者「静かな中庭まで来た。魔王より、帰宅後の洗濯物が気になるあたり俺はまだ生活者だ」', [{ item: 'castle_key_fragment', amount: 1 }], 'level_up'),
    ],
    10: [
      M('冒険Lv10：勇者は危険との距離感を覚えた。\n\n勇者「勝てる相手が増えた。だからこそ、戦わない日を選べるのが一番の成長かもしれない」', [{ item: 'quiet_crown', amount: 1 }], 'level_up'),
    ],
  },
},
  office: { name: '王国勤務', type: 'idle', description: '安定収入。ただし拘束が重い。', unlock: { type: 'jobLevel', job: 'merchant', level: 3 }, areas: [{ id: 'clerk', name: '王国庶務係', summary: '安定。雑務。地味にMPが減る。', seconds: 8, rewards: { gold: [12, 22], xp: 10 }, drops: [D('employee_badge', 0.04)], failChance: 0, failMusings: [], musings: [M('勇者は王国庶務係として出勤した。\n\n勇者「決まった時間に決まった場所へ行けた。えらい。もう帰りたい」')] }], upgrades: [
    { id: 'office_desk', name: 'まともな机', description: '作業効率が上がる。腰への負担は下がらない。', cost: { gold: 80, resources: { wood: 20 } }, effects: { maxMp: 10 }, log: '机がまともになった。仕事のまともさは、まだ。', level: 2 },
    { id: 'office_chair', name: '快適な椅子', description: '座り心地がいい。拘束感は変わらない。', cost: { gold: 100, resources: { wood: 25 } }, effects: { maxMp: 15, maxHp: 8 }, log: '椅子が快適になった。拘束感は、まだ。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('王国勤務Lv1：勇者は出勤した。\n\n勇者「決まった時間に決まった場所へ行けた。えらい。帰りたい気持ちも時間通りだ」', [{ item: 'employee_badge', amount: 1 }], 'level_up'),
    ],
    2: [
      M('王国勤務Lv2：雑務に慣れてきた。\n\n勇者「安定収入はありがたい。拘束感まで安定しているのは、サービス過剰だと思う」', [{ item: 'employee_badge', amount: 1 }], 'level_up'),
    ],
    3: [
      M('王国勤務Lv3：仕事の流れがわかってきた。\n\n勇者「仕事の流れが見える。退屈がどの角から来るかも見える。避けられない」', [{ item: 'employee_badge', amount: 2 }], 'level_up'),
    ],
    4: [
      M('王国勤務Lv4：社畜としての自信がついた。\n\n勇者「安定収入と自由時間が同じ椅子を取り合っている。だいたい給料が座る」', [{ item: 'employee_badge', amount: 2 }], 'level_up'),
    ],
    5: [
      M('王国勤務Lv5：社畜の達人になった。\n\n勇者「退屈と戦うスキルが上がった。退屈は無傷だ。あいつ硬すぎる」', [{ item: 'employee_badge', amount: 3 }], 'level_up'),
    ],
  },
},
  remote: { name: '在宅作業', type: 'idle', description: '通勤なし。でも仕事と生活の境界が溶ける。', unlock: { type: 'jobLevel', job: 'office', level: 2 }, areas: [{ id: 'small_tasks', name: '小さな在宅タスク', summary: '通勤なし。単価は低い。', seconds: 7, rewards: { gold: [8, 16], xp: 10 }, drops: [D('mute_button', 0.04)], failChance: 0.15, failMusings: ['Wi-Fiが切れた。作業ではなく回線に負けた', '保存し忘れて作業が消えた。データは約束しない', '締め切りのメールに気づかなかった。通知設定の問題だ', '集中していたら昼ごはんを忘れた。失敗ではないが失敗だ'], musings: [M('在宅作業をした。通勤時間は消えた。代わりに、仕事と生活の境界も少し消えた。')] }], upgrades: [
    { id: 'remote_headphones', name: 'ノイズキャンセリングヘッドホン', description: '外界を遮断する。仕事への没入感を高める。', cost: { gold: 90, resources: { ore: 10 } }, effects: { maxMp: 12, failReduction: 0.08 }, log: '外界が静かになった。集中も少し続くようになった。', level: 2 },
    { id: 'remote_monitor', name: 'モニター', description: '画面が広い。作業範囲も広い。', cost: { gold: 120, resources: { ore: 20, wood: 10 } }, effects: { maxMp: 18, failReduction: 0.07 }, log: '視界が広がった。作業ミスも少し減った。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('在宅作業Lv1：勇者は在宅作業を始めた。\n\n勇者「通勤時間は消えた。代わりに机が職場を名乗り始めた」', [{ item: 'mute_button', amount: 1 }], 'level_up'),
    ],
    2: [
      M('在宅作業Lv2：在宅のリズムがわかってきた。\n\n勇者「家で仕事すると休憩の境目が薄くなる。気づくと台所まで職場だ」', [{ item: 'mute_button', amount: 1 }], 'level_up'),
    ],
    3: [
      M('在宅作業Lv3：集中力の管理が少し上手くなった。\n\n勇者「集中すると時間が溶ける。せめて溶けた分だけカップ麺も完成してほしい」', [{ item: 'mute_button', amount: 2 }], 'level_up'),
    ],
    4: [
      M('在宅作業Lv4：在宅作業師としての自信がついた。\n\n勇者「家で仕事できる。できるから頼まれる。便利になるほど、頼まれごとも増えるんだな」', [{ item: 'mute_button', amount: 2 }], 'level_up'),
    ],
    5: [
      M('在宅作業Lv5：在宅作業の達人になった。\n\n勇者「仕事と生活の境界線を引いた。通知ひとつで、すぐ踏み越えられる細いやつだ」', [{ item: 'mute_button', amount: 3 }], 'level_up'),
    ],
  },
},
  shady: { name: '闇クエスト', type: 'idle', description: '報酬が妙に高い。内容が妙に薄い。断る勇気もスキル。', unlock: { type: 'jobLevel', job: 'adventure', level: 3 }, areas: [
    { id: 'too_easy', name: '簡単すぎる依頼', summary: '内容が薄い。報酬が厚い。怖い。', seconds: 9, rewards: { gold: [30, 55], xp: 14 }, drops: [D('red_flag', 0.06)], failChance: 0.35, failMusings: ['依頼内容が途中で変わった。報酬も変わった', '騙されたか確認中。まだわからない', '連絡先が突然つながらなくなった。赤信号だった', '「簡単」という言葉を信用した自分が間違いだった'], musings: [M('高報酬依頼を見つけた。内容が薄い。報酬が厚い。怖い。\n\n勇者「財布は行けって言ってる。胃は逃げろって言ってる」')] },
    { id: 'midnight_package', name: '深夜の小包運び', summary: '行き先だけ指定される。質問すると空気が冷える。', unlock: { type: 'jobLevel', job: 'shady', level: 2 }, seconds: 11, rewards: { gold: [65, 110], xp: 18 }, drops: [D('red_flag', 0.12)], failChance: 0.45, failMusings: ['集合場所が直前で変わった。まともな依頼はそんな動きをしない', '依頼主の名前が毎回違う。信用の足場がない', '報酬の説明だけ早口だった。大事なところほど濁された', '怖くなって引き返した。これは失敗ではなく生存判断だ'], musings: [M('深夜の小包運びを見つけた。報酬は高い。説明は低い。\n\n勇者「高い報酬には理由がある。理由を言わないなら、もっと理由がある」', [{ item: 'red_flag', amount: 1 }], 'unlock')] },
    { id: 'anonymous_guard', name: '匿名護衛', summary: '誰を守るのかも、何から守るのかも曖昧。金額だけ明瞭。', unlock: { type: 'jobLevel', job: 'shady', level: 4 }, seconds: 13, rewards: { gold: [120, 190], xp: 24 }, drops: [D('red_flag', 0.18)], failChance: 0.55, failMusings: ['契約書がなかった。あるのは圧だけだった', '相手が先に逃げた。勇者も遅れて逃げた', '報酬が後払いに変わった。危険だけが前払いだった', '「大丈夫」を三回聞いた。大丈夫ではない'], musings: [M('匿名護衛の依頼が来た。守る対象も敵もぼんやりしている。報酬だけがやけに鮮明だった。\n\n勇者「条件が曖昧な仕事ほど、責任だけはこっちに寄ってくる」', [{ item: 'red_flag', amount: 2 }], 'unlock')] },
  ], upgrades: [
    { id: 'shady_disguise', name: '変装セット', description: '身分を隠す。不安は隠せない。', cost: { gold: 110, resources: { wood: 15 } }, effects: { maxMp: 14, failReduction: 0.12 }, log: '変装の準備ができた。騙される回数が少し減った気がする。', level: 2 },
    { id: 'shady_escape_plan', name: '逃走ルート計画', description: 'いざという時の逃げ道。心の逃げ道は別。', cost: { gold: 130, resources: { ore: 15 } }, effects: { maxMp: 20, maxHp: 12, failReduction: 0.13 }, log: '逃げ道を確保した。失敗しても逃げられる。少しだけ。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('闇クエストLv1：勇者は闇クエストを始めた。\n\n勇者「高い報酬には理由がある。理由を言わないなら、たぶん領収書に書けない理由だ」', [{ item: 'red_flag', amount: 1 }], 'level_up'),
    ],
    2: [
      M('闇クエストLv2：怪しい依頼の見分け方が少しわかってきた。\n\n勇者「条件が曖昧な仕事ほど、責任だけははっきり押しつけてくるんだな」', [{ item: 'red_flag', amount: 1 }], 'level_up'),
    ],
    3: [
      M('闇クエストLv3：逃げるタイミングが少しわかってきた。\n\n勇者「怖くなって引き返した。これは失敗ではなく、生存への投資ということにする」', [{ item: 'red_flag', amount: 2 }], 'level_up'),
    ],
    4: [
      M('闇クエストLv4：怪しい依頼のリスク管理が少し上手くなった。\n\n勇者「逃げ道を先に見る癖がついた。景色より非常口に詳しい勇者になっている」', [{ item: 'red_flag', amount: 2 }], 'level_up'),
    ],
    5: [
      M('闇クエストLv5：闇クエストの達人になった。\n\n勇者「怪しい依頼は、報酬だけ妙に元気だ。そこがもう怪しい」', [{ item: 'red_flag', amount: 3 }], 'level_up'),
    ],
  },
},
  delivery: { name: '配達アプリ', type: 'idle', description: 'スマホの通知に従って街を走る。評価と天気が敵になる。', unlock: { type: 'jobLevel', job: 'office', level: 4 }, areas: [
    { id: 'food_delivery', name: '食事配達', summary: '自転車で走る。時間との戦い。', seconds: 7, rewards: { gold: [15, 25], xp: 12 }, drops: [D('bike_upgrade', 0.08), D('delivery_app', 0.05)], failChance: 0.25, failMusings: ['道を間違えた。地図より現実が複雑だった', '荷物を落とした。謝罪が先に届いた', '雨で自転車が滑った。天気は協力しない', '時間通りに着いたのに不在だった。往復した'], musings: [M('勇者は配達を始めた。\n\n勇者「スマホの地図と現実の道が、微妙にズレてる。これが現代の冒険か」', [{ item: 'delivery_app', amount: 1 }], 'unlock')] },
    { id: 'lunch_peak_delivery', name: '昼ピーク配達', summary: '通知が鳴り続ける。街全体が締め切りになる。', unlock: { type: 'jobLevel', job: 'delivery', level: 2 }, seconds: 8, rewards: { gold: [24, 42], xp: 15 }, drops: [D('delivery_app', 0.08), D('bike_upgrade', 0.10)], failChance: 0.32, failMusings: ['店で待たされた。待機時間は報酬に反映されない', '同じ名前の店が二つあった。現代の迷宮だ', '低評価の気配を感じた。まだ押されていないのに痛い', '坂道が多すぎた。地図は高低差を軽く見ている'], musings: [M('昼ピークの通知が鳴った。受けるたびに小銭は増える。呼吸は減る。\n\n勇者「依頼を選んでるつもりだったけど、通知に選ばれてる気もする」')] },
    { id: 'rainy_surge_delivery', name: '雨の日ブースト配達', summary: '報酬は上がる。靴の中の水位も上がる。', unlock: { type: 'jobLevel', job: 'delivery', level: 4 }, seconds: 10, rewards: { gold: [42, 75], xp: 20 }, drops: [D('bike_upgrade', 0.14)], failChance: 0.40, failMusings: ['スマホ画面が濡れて操作できない。現代の魔法が水に弱い', '料理は温かい。勇者は冷たい', '水たまりを避けた先にも水たまりがあった', 'ブースト報酬を見るたびに判断力が少し濡れる'], musings: [M('雨の日の配達は報酬が跳ねた。跳ねた水も顔に来た。\n\n勇者「高くなるのは、誰かがやりたくないからだ。すごくわかる」', [{ item: 'bike_upgrade', amount: 1 }], 'unlock')] },
  ], upgrades: [
    { id: 'delivery_ebike', name: '電動アシスト自転車', description: '坂道も楽になる。でもバッテリー切れの恐怖が増える。', cost: { gold: 150, resources: { ore: 15, wood: 10 } }, effects: { maxMp: 12, maxHp: 8, failReduction: 0.12 }, log: '坂道が楽になった。配達ミスも少し減った。', level: 2 },
    { id: 'delivery_insulated_bag', name: '保冷バッグ', description: '食事の温度を保つ。自分の体温は保てない。', cost: { gold: 80, resources: { wood: 12 } }, effects: { maxMp: 10, failReduction: 0.08 }, log: '食事の温度は保てる。配達の安定感も少し増した。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('配達アプリLv1：勇者は配達を始めた。\n\n勇者「スマホの地図と現実の道が微妙にズレてる。現代のダンジョン、更新が遅い」', [{ item: 'delivery_app', amount: 1 }], 'level_up'),
    ],
    2: [
      M('配達アプリLv2：配達ルートが少しわかってきた。\n\n勇者「依頼を選んでるつもりでも通知に選ばれてる。召喚魔法としては雑すぎる」', [{ item: 'delivery_app', amount: 1 }], 'level_up'),
    ],
    3: [
      M('配達アプリLv3：時間管理が少し上手くなった。\n\n勇者「高くなるのは誰かがやりたくないからだ。理解が深すぎて、足取りが重い」', [{ item: 'bike_upgrade', amount: 1 }], 'level_up'),
    ],
    4: [
      M('配達アプリLv4：配達師としての自信がついた。\n\n勇者「地図と現実のズレに慣れた。でも雨は別枠。あいつは画面も靴下も攻撃する」', [{ item: 'bike_upgrade', amount: 1 }], 'level_up'),
    ],
    5: [
      M('配達アプリLv5：配達の達人になった。\n\n勇者「通知音だけで距離と疲労が見える。便利な能力ほど、だいたい欲しくなかった」', [{ item: 'bike_upgrade', amount: 2 }], 'level_up'),
    ],
  },
},
  streaming: { name: '動画投稿者', type: 'idle', description: '生活を切り抜き、サムネを磨き、再生数に心拍を握られる。', unlock: { type: 'jobLevel', job: 'remote', level: 3 }, areas: [
    { id: 'game_stream', name: 'ゲーム実況', summary: '自分が遊ぶのを他人が見る。不思議な経済。', seconds: 8, rewards: { gold: [10, 30], xp: 13 }, drops: [D('webcam', 0.07), D('mic', 0.05)], failChance: 0.15, failMusings: ['配信が途中で落ちた。視聴者がいたかは不明', 'マイクのミュートを忘れていた。独り言が全部流れた', 'ゲームがクラッシュした。敵より先にソフトが倒れた', 'サムネを間違えてアップした。内容と違う'], musings: [M('勇者はゲーム実況を始めた。\n\n勇者「自分が遊んでるのを他人が見る。不思議な経済だ。でも、誰も見てない時が一番楽しい気がする」', [{ item: 'webcam', amount: 1 }], 'unlock')] },
    { id: 'short_video_grind', name: '短尺動画量産', summary: '短い動画を何本も作る。短いのは動画だけ。', unlock: { type: 'jobLevel', job: 'streaming', level: 2 }, seconds: 6, rewards: { gold: [18, 45], xp: 15 }, drops: [D('mic', 0.06), D('webcam', 0.06)], failChance: 0.22, failMusings: ['流行の音源が昨日のものになっていた。時代が速すぎる', '字幕が一文字ずれて意味が変わった', '伸びた理由がわからない。伸びない理由もわからない', 'コメント欄を見すぎた。作業時間が消えた'], musings: [M('短尺動画を量産した。一本は短い。作る側の夜は長い。\n\n勇者「視聴維持率って言葉、こっちの精神維持率も測ってない？」', [{ item: 'mic', amount: 1 }], 'unlock')] },
    { id: 'sponsored_review', name: '案件レビュー', summary: '報酬はいい。正直さと家賃が同じ机に座る。', unlock: { type: 'jobLevel', job: 'streaming', level: 4 }, seconds: 10, rewards: { gold: [55, 95], xp: 22 }, drops: [D('webcam', 0.10), D('mic', 0.10)], failChance: 0.28, failMusings: ['台本の熱量と本心の温度差で風邪をひきそうだ', '商品名を噛んだ。報酬の重みで舌が滑った', '提供表記を入れ忘れかけた。信用が崖の上に立っていた', '褒め方が不自然すぎて自分で気づいた'], musings: [M('案件レビューが来た。報酬は普段よりいい。言葉は普段より重い。\n\n勇者「好きって言うだけなら簡単だけど、値段が付くと声の出方が変わるな」')] },
  ], upgrades: [
    { id: 'streaming_webcam', name: '高画質Webカメラ', description: '顔が鮮明に映る。表情筋の疲労も鮮明に増える。', cost: { gold: 120, resources: { ore: 18 } }, effects: { maxMp: 15, failReduction: 0.08 }, log: '顔が鮮明になった。配信の安定感も少し増した。', level: 2 },
    { id: 'streaming_green_screen', name: 'グリーンスクリーン', description: '背景を自由に変えられる。現実は変えられない。', cost: { gold: 90, resources: { wood: 15 } }, effects: { maxMp: 12, failReduction: 0.07 }, log: '背景は変えられる。配信落ちも少し減った。', level: 4 },
  ],
  levelMusings: {
    1: [
      M('動画投稿者Lv1：勇者は動画投稿を始めた。\n\n勇者「自分が遊んでるのを他人が見る。不思議な経済だ。見られてない時の方が上手いのも不思議だ」', [{ item: 'webcam', amount: 1 }], 'level_up'),
    ],
    2: [
      M('動画投稿者Lv2：動画編集が少し上手くなった。\n\n勇者「視聴維持率って言葉、こっちの精神維持率も測ってほしい。低め安定だ」', [{ item: 'mic', amount: 1 }], 'level_up'),
    ],
    3: [
      M('動画投稿者Lv3：トレンドの読み方が少しわかってきた。\n\n勇者「伸びた理由がわからない。伸びない理由もわからない。数字、もう少し日本語で説明してほしい」', [{ item: 'webcam', amount: 1 }], 'level_up'),
    ],
    4: [
      M('動画投稿者Lv4：動画投稿者としての自信がついた。\n\n勇者「好きって言うだけなら簡単。案件になると、急に声がよそ行きになる」', [{ item: 'mic', amount: 1 }], 'level_up'),
    ],
    5: [
      M('動画投稿者Lv5：動画投稿の達人になった。\n\n勇者「再生数を見るのに慣れた。慣れたのに、少ない日はちゃんと刺さる」', [{ item: 'webcam', amount: 2 }], 'level_up'),
    ],
  },
},
};

export { jobs };

export const upgrades = Object.values(jobs).flatMap((j) => j.upgrades);
