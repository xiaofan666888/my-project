const game = require('../../utils/game.js');

const STORE_KEY = 'pet_state_v1';
const DURATION = 30;          // 一局 30 秒
const SPAWN_BASE = 520;       // 初始间隔 ms
const GOOD = ['🍎', '🍰', '🍖', '🍩', '🍓'];
const BAD = ['💣'];

Page({
  data: {
    score: 0,
    time: DURATION,
    items: [],
    playing: false,
    started: false,
    showResult: false,
    coinsEarned: 0,
    best: 0
  },

  onLoad() {
    this.id = 0;
    this.best = wx.getStorageSync('catch_best') || 0;
    this.setData({ best: this.best });
  },

  onUnload() {
    this.stopAll();
  },

  onHide() {
    if (this.data.playing) this.endGame();
  },

  stopAll() {
    if (this.spawnTimer) {
      clearTimeout(this.spawnTimer);
      this.spawnTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    (this.cleanups || []).forEach((t) => clearTimeout(t));
    this.cleanups = [];
  },

  onStart() {
    this.stopAll();
    this.setData({
      score: 0,
      time: DURATION,
      items: [],
      playing: true,
      started: true,
      showResult: false
    });

    const startedAt = Date.now();
    this.cleanups = [];

    // 生成节奏：越到后面掉得越快
    const spawn = () => {
      if (!this.data.playing) return;
      const elapsed = (Date.now() - startedAt) / 1000;
      const dur = Math.max(900, 2000 - elapsed * 35);
      const bad = elapsed > 5 && Math.random() < 0.16;

      const item = {
        id: this.id++,
        icon: bad ? BAD[0] : GOOD[Math.floor(Math.random() * GOOD.length)],
        bad: bad,
        x: 8 + Math.round(Math.random() * 78),
        dur: Math.round(dur)
      };

      this.setData({ items: this.data.items.concat([item]) });

      // 兜底：万一 animationend 没触发，也要清掉
      const t = setTimeout(() => this.removeItem(item.id), item.dur + 250);
      this.cleanups.push(t);

      const next = Math.max(300, SPAWN_BASE - elapsed * 9);
      this.spawnTimer = setTimeout(spawn, next);
    };

    spawn();

    // 倒计时
    this.tickTimer = setInterval(() => {
      const left = DURATION - Math.floor((Date.now() - startedAt) / 1000);
      this.setData({ time: Math.max(0, left) });
      if (left <= 0) {
        this.endGame();
      }
    }, 200);
  },

  removeItem(id) {
    const items = this.data.items.filter((it) => it.id !== id);
    this.setData({ items: items });
  },

  onCatch(e) {
    if (!this.data.playing) return;
    const ds = e.currentTarget.dataset;
    const id = ds.id;
    const bad = ds.bad;

    this.removeItem(id);

    let score = this.data.score + (bad ? -2 : 1);
    if (score < 0) score = 0;

    this.setData({ score: score });

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light', fail() {} });
    }
  },

  onMiss(e) {
    if (!this.data.playing) return;
    this.removeItem(e.currentTarget.dataset.id);
  },

  endGame() {
    if (!this.data.playing) return;

    const score = this.data.score;
    const coins = Math.min(15, Math.floor(score / 2));

    this.stopAll();
    this.setData({ playing: false, showResult: true, items: [], coinsEarned: coins });

    if (score > this.best) {
      this.best = score;
      wx.setStorageSync('catch_best', score);
      this.setData({ best: score });
    }

    if (coins > 0) {
      const s = game.ensure(wx.getStorageSync(STORE_KEY) || {});
      // 小游戏金币不占每日互动上限，单独结算
      s.coins += coins;
      game.addExp(s, Math.floor(score / 3));
      wx.setStorageSync(STORE_KEY, s);
    }
  },

  onClose() {
    this.setData({ showResult: false });
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    });
  }
});
