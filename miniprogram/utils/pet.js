/**
 * 宠物核心逻辑
 *
 * 注意：这里的 everything 都是"客户端临时实现"。
 * v0.2 要把它整体搬到服务端——客户端只负责展示，
 * 否则改手机时间就能刷满状态，而且换手机数据就没了。
 */

const CONFIG = {
  // 每小时衰减多少点（0-100）
  decayPerHour: {
    hunger: 1.5,      // 约 53 小时从 100 饿到 0
    clean: 1,         // 约 80 小时从 100 脏到 0
    mood: 0.5,        // 基础心情衰减
    moodPenalty: 1.5, // 饥饿或清洁低于阈值时的额外衰减
    penaltyBelow: 30
  },
  initial: { hunger: 80, clean: 80, mood: 70 },
  actions: {
    feed: { hunger: +30, mood: +2, cooldownSec: 30, label: '喂食', icon: '🍖' },
    bath: { clean: +35, mood: +3, cooldownSec: 60, label: '洗澡', icon: '🛁' },
    play: { mood: +25, hunger: -8, clean: -5, cooldownSec: 45, label: '陪玩', icon: '🎾' }
  }
};

function clamp(v) {
  return Math.max(0, Math.min(100, v));
}

function defaults() {
  return Object.assign({}, CONFIG.initial, {
    lastTick: Date.now(),
    cd: { feed: 0, bath: 0, play: 0 }
  });
}

/**
 * 按经过的时间结算衰减。
 * 分段（每小时一段）是为了让"低于阈值才扣心情惩罚"只作用于真正饿的那段时间，
 * 而不是把惩罚平摊到整段离线时间。
 */
function settle(s, now) {
  let seconds = Math.max(0, (now - s.lastTick) / 1000);
  const d = CONFIG.decayPerHour;
  const next = Object.assign({}, s, { cd: Object.assign({}, s.cd) });

  while (seconds > 0) {
    const step = Math.min(seconds, 3600);
    const hours = step / 3600;

    next.hunger = clamp(next.hunger - d.hunger * hours);
    next.clean = clamp(next.clean - d.clean * hours);

    let moodDrop = d.mood * hours;
    if (next.hunger < d.penaltyBelow || next.clean < d.penaltyBelow) {
      moodDrop += d.moodPenalty * hours;
    }
    next.mood = clamp(next.mood - moodDrop);

    seconds -= step;
  }

  next.lastTick = now;
  return next;
}

function faceOf(s) {
  if (s.hunger < 15 || s.clean < 15) return '😫';
  if (s.mood < 20) return '😭';
  if (s.mood < 40) return '😢';
  if (s.hunger < 35) return '😋';
  if (s.clean < 35) return '🫠';
  if (s.mood > 75) return '🥰';
  if (s.mood > 55) return '😊';
  return '😐';
}

function wordsOf(s) {
  if (s.hunger < 20) return '我饿了…';
  if (s.clean < 20) return '身上好脏…';
  if (s.mood < 25) return '有点难过';
  if (s.mood > 80) return '今天很开心！';
  return '你好呀';
}

function sinceText(lastTick) {
  const sec = Math.max(0, Math.round((Date.now() - lastTick) / 1000));
  if (sec < 10) return '刚刚';
  if (sec < 3600) return Math.floor(sec / 60) + ' 分钟前';
  if (sec < 86400) return Math.floor(sec / 3600) + ' 小时前';
  return Math.floor(sec / 86400) + ' 天前';
}

module.exports = { CONFIG, clamp, defaults, settle, faceOf, wordsOf, sinceText };
