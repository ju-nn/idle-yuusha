import type { Achievement } from '../types';

export const ITEM: Record<string, [string, string, string]> = {
  resolve_to_fish: ['釣りをする決意', '重要', '最初の一歩を踏み出した証。釣りは最初からできる。'],
  permission_to_rest: ['休む許可', '重要', '休憩を解禁する。'],
  small_fish: ['小魚', '素材', '小さいが生活には効く。'],
  quiet_scale: ['静かな鱗', '重要', '謎に落ち着く鱗。'],
  field_note: ['小さな畑のメモ', '重要', '畑の考え方が書かれたメモ。農業への気持ちが少し育つ。'],
  twig: ['細い枝', '素材', '細い。だが始まりには十分。'],
  hinoki_stick: ['ひのきのぼう', '重要', '戦う覚悟を少しだけ支える棒。'],
  old_pickaxe: ['古びたツルハシ', '重要', '採掘の匂いがする道具。腰への予告でもある。'],
  pebble_ore: ['くず鉱石', '素材', '一発当てたい心を削る石。'],
  daikon_seed: ['しょぼい大根の種', '素材', 'しょぼいが植えられる。'],
  daikon: ['しょぼい大根', '素材', '明日の味噌汁になれる。'],
  sleepy_herb: ['眠気ざまし草', '素材', '眠気にだけ強気な草。勇者より朝に詳しい。'],
  safe_potato: ['安心じゃがいも', '素材', '腹持ちがいい。安心はだいたい炭水化物の顔をしている。'],
  moonbean: ['夜更け豆', '素材', '夜の間に増える豆。睡眠時間を責めずに成果へ変えてくれる。'],
  rent_rice: ['家賃米', '素材', '名前だけで頼もしい米。実際に家賃は払えないが、夕飯にはなる。'],
  slime_jelly: ['スライムゼリー', '素材', '食べるかは微妙。'],
  employee_badge: ['王国職員証', '重要', '安定収入の気配がする。気配だけでも少し重い。'],
  mute_button: ['ミュート確認ボタン', '重要', '在宅作業の境界線を守るための小さな儀式。'],
  red_flag: ['赤い違和感', '重要', '危ない依頼を見分けるための直感。見なかったことにもできる。'],
  merchant_license: ['商人の屋台許可証', '重要', '売る場所があると素材が急にお金に見える。'],
  upgrade_better_rod: ['中古の釣り竿', '拠点整備', '釣れる気が少しする。'],
  upgrade_wrist_care: ['手首ケアセット', '拠点整備', '手首へ謝罪する道具。'],
  upgrade_small_shelf: ['小さな収納棚', '拠点整備', '床の素材圧を下げる。'],
  goblin_ear: ['ゴブリンの耳', '素材', 'ゴブリンの耳。形が微妙に気になる。'],
  wolf_fang: ['オオカミの牙', '素材', '鋭い牙。アクセサリーには向かない。'],
};

export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_musing: { name: '読んだだけで偉い', description: '最初のぼやきを読んだ。テキストを読むと人生が進むこともある。' },
  first_fish: { name: '食費への抵抗運動', description: '小魚を手に入れた。無料の食料は心の防具。' },
  fishing_lv2: { name: '釣り糸の勤務態度', description: '釣りLv2になった。働いているのは糸なのに、なぜか勇者が疲れている。' },
  unlock_merchant: { name: '値札を付けた瞬間に在庫', description: '商人が解禁された。素材が急に帳簿っぽく見える。' },
  first_sale: { name: '個人事業主、爆誕', description: '素材を売った。売上は出たが、確定申告の気配もした。' },
  unlock_combat: { name: '棒を持っただけの自信', description: 'ひのきのぼうを見つけた。自己肯定感の振れ幅が危険。' },
  first_battle: { name: '説明がシンプルな不安', description: '戦闘した。敵の反撃は会社の仕様変更よりわかりやすい。' },
  first_upgrade: { name: '生活感のある装備強化', description: '拠点整備を導入した。冒険とはまず部屋を片付けること。' },
  first_daikon: { name: '野菜に労働を委託', description: '大根を収穫した。自分が寝ている間に育つもの、かなり理想。' },
  first_long_crop: { name: '寝かせる勇気', description: '長時間作物を収穫した。待つだけで増えるものは、心に効く。' },
  first_rent_rice: { name: '家賃は払えないが米はある', description: '家賃米を収穫した。生活の安心感が、炊飯器の顔をしている。' },
  ten_achievements: { name: '人生ログが厚い', description: '実績を10個集めた。派手ではないが、生活はちゃんと進んでいる。' },
  all_jobs_unlocked: { name: '職業欄が騒がしい', description: 'すべての仕事を解禁した。自由に近づくほど、選択肢も増えてしまう。' },
  release_goal: { name: 'そこそこ安心生活', description: 'リリース版の生活目標に到達した。世界最強ではないが、今日の勇者はかなり勝っている。' },
};

export const itemName = (id: string) => ITEM[id]?.[0] || id;
export const itemKind = (id: string) => ITEM[id]?.[1] || '';
export const itemDesc = (id: string) => ITEM[id]?.[2] || '';
