/**
 * 游戏化系统：金币、经验、等级、食物、签到
 *
 * 这一层和 pet.js 分开：pet.js 管"生命状态怎么演化"，
 * game.js 管"玩什么、得到什么"。
 * 上线前这些都应该搬到服务端，否则改本地存储就能刷金币。
 */

const FOODS = {
  basic: {
    id: 'basic',
    name: '普通口粮',
    icon: '🍚',
    price: 5,
    hunger: 25,
    mood: 0,
    exp: 5,
    desc: '管饱，最划算'
  },
  snack: {
    id: 'snack',
    name: '小蛋糕',
    icon: '🍰',
    price: 12,
    hunger: 12,
    mood: 16,
    exp: 8,
    desc: '又甜又开心'
  },
  feast: {
    id: 'feast',
    name: '豪华大餐',
    icon: '🍱',
    price: 30,
    hunger: 45,
    mood: 15,
    exp: 26,
    desc: '加很多经验'
  }
};

// 等级阶梯：need 是达到该等级所需的总经验
const LEVELS = [
  { lv: 1, title: '陌生人', need: 0 },
  { lv: 2, title: '眼熟的人', need: 60 },
  { lv: 3, title: '朋友', need: 160 },
  { lv: 4, title: '好朋友', need: 320 },
  { lv: 5, title: '死党', need: 560 },
  { lv: 6, title: '家人', need: 900 }
];

const DAILY_COIN_CAP = 30;

function todayKey() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

function yesterdayKey() {
  const d = new Date(Date.now() - 86400000);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

/** 补齐老存档里缺的字段 */
function ensure(s) {
  if (typeof s.coins !== 'number') s.coins = 10;
  if (typeof s.exp !== 'number') s.exp = 0;
  if (!s.inv || typeof s.inv !== 'object') s.inv = { basic: 3, snack: 0, feast: 0 };
  if (typeof s.inv.basic !== 'number') s.inv.basic = 3;
  if (typeof s.inv.snack !== 'number') s.inv.snack = 0;
  if (typeof s.inv.feast !== 'number') s.inv.feast = 0;
  if (!s.lastCheckIn) s.lastCheckIn = '';
  if (typeof s.streak !== 'number') s.streak = 0;
  if (!s.dailyKey) s.dailyKey = '';
  if (typeof s.dailyCoins !== 'number') s.dailyCoins = 0;
  return s;
}

/** 经验 → 等级信息 */
function levelOf(exp) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (exp >= LEVELS[i].need) idx = i;
  }
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  const base = cur.need;
  const span = next ? next.need - base : 0;
  const progress = next ? Math.min(100, Math.round(((exp - base) / span) * 100)) : 100;
  return {
    lv: cur.lv,
    title: cur.title,
    exp,
    curNeed: base,
    nextNeed: next ? next.need : null,
    progress,
    isMax: !next
  };
}

/** 加经验，返回是否升级 */
function addExp(s, n) {
  const before = levelOf(s.exp).lv;
  s.exp += n;
  const after = levelOf(s.exp);
  return { leveledUp: after.lv > before, level: after };
}

/** 加金币，受每日上限限制 */
function addCoins(s, n) {
  const key = todayKey();
  if (s.dailyKey !== key) {
    s.dailyKey = key;
    s.dailyCoins = 0;
  }
  const room = Math.max(0, DAILY_COIN_CAP - s.dailyCoins);
  const gain = Math.min(Math.max(0, n), room);
  s.coins += gain;
  s.dailyCoins += gain;
  return gain;
}

/** 每日签到，返回 {ok, reward, streak} */
function checkIn(s) {
  const today = todayKey();
  if (s.lastCheckIn === today) {
    return { ok: false, reward: 0, streak: s.streak };
  }
  const continued = s.lastCheckIn === yesterdayKey();
  s.streak = continued ? s.streak + 1 : 1;
  s.lastCheckIn = today;

  const reward = Math.min(8 + (s.streak - 1) * 3, 26);
  s.coins += reward;

  return { ok: true, reward: reward, streak: s.streak, continued: continued };
}

/** 用食物喂食 */
function useFood(s, foodId) {
  const food = FOODS[foodId];
  if (!food) return { ok: false, msg: '没有这种食物' };
  if ((s.inv[foodId] || 0) <= 0) return { ok: false, msg: '这个吃完了' };

  s.inv[foodId] -= 1;
  s.hunger = Math.max(0, Math.min(100, s.hunger + food.hunger));
  s.mood = Math.max(0, Math.min(100, s.mood + food.mood));
  const lv = addExp(s, food.exp);
  const coins = addCoins(s, 2);

  return { ok: true, food: food, leveledUp: lv.leveledUp, level: lv.level, coins: coins };
}

/** 买食物 */
function buy(s, foodId) {
  const food = FOODS[foodId];
  if (!food) return { ok: false, msg: '没有这种食物' };
  if (s.coins < food.price) return { ok: false, msg: '金币不够' };
  s.coins -= food.price;
  s.inv[foodId] = (s.inv[foodId] || 0) + 1;
  return { ok: true, food: food };
}

/** 空闲时可能发生的小事件 */
const EVENTS = [
  { text: '它刚才偷偷打了个哈欠', mood: 0 },
  { text: '它把被子踢到了地上', mood: -2 },
  { text: '它盯着窗外看了很久', mood: 1 },
  { text: '它好像做梦了，动了动手指', mood: 1 },
  { text: '它偷偷笑了，不知道想到什么', mood: 3 },
  { text: '它把零食藏在了口袋里', mood: 2 }
];

function randomEvent(awayMs) {
  if (awayMs > 2 * 3600 * 1000 && Math.random() < 0.6) {
    return EVENTS[Math.floor(Math.random() * EVENTS.length)];
  }
  return null;
}

module.exports = {
  FOODS,
  LEVELS,
  ensure,
  levelOf,
  addExp,
  addCoins,
  checkIn,
  useFood,
  buy,
  randomEvent,
  todayKey
};
