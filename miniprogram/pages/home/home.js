const pet = require('../../utils/pet.js');

const STORE_KEY = 'pet_state_v1';

Page({
  data: {
    hunger: 80,
    clean: 80,
    mood: 70,
    face: '🐣',
    say: '你好呀',
    since: '刚刚',
    disFeed: false,
    disBath: false,
    disPlay: false,
    cdFeed: '',
    cdBath: '',
    cdPlay: ''
  },

  onLoad() {
    this.loadState();
    this.render();
  },

  onShow() {
    if (this.state) {
      this.state = pet.settle(this.state, Date.now());
      this.save();
      this.render();
    }
    this.timer = setInterval(() => this.tick(), 1000);
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  loadState() {
    const raw = wx.getStorageSync(STORE_KEY);
    this.state = raw && raw.lastTick ? pet.settle(raw, Date.now()) : pet.defaults();
  },

  save() {
    wx.setStorageSync(STORE_KEY, this.state);
  },

  tick() {
    this.state = pet.settle(this.state, Date.now());
    this.save();
    this.render();
  },

  render() {
    const s = this.state;
    const now = Date.now();
    const left = {};
    ['feed', 'bath', 'play'].forEach((k) => {
      const ms = (s.cd[k] || 0) - now;
      left[k] = ms > 0 ? Math.ceil(ms / 1000) + 's' : '';
    });

    this.setData({
      hunger: Math.round(s.hunger),
      clean: Math.round(s.clean),
      mood: Math.round(s.mood),
      face: pet.faceOf(s),
      say: pet.wordsOf(s),
      since: pet.sinceText(s.lastTick),
      disFeed: !!left.feed,
      disBath: !!left.bath,
      disPlay: !!left.play,
      cdFeed: left.feed,
      cdBath: left.bath,
      cdPlay: left.play
    });
  },

  onAction(e) {
    const name = e.currentTarget.dataset.act;
    const cfg = pet.CONFIG.actions[name];
    if (!cfg) return;

    const now = Date.now();
    this.state = pet.settle(this.state, now);
    if ((this.state.cd[name] || 0) > now) return;

    Object.keys(cfg).forEach((k) => {
      if (k === 'cooldownSec' || k === 'label' || k === 'icon') return;
      this.state[k] = pet.clamp(this.state[k] + cfg[k]);
    });
    this.state.cd[name] = now + cfg.cooldownSec * 1000;

    this.save();
    this.render();

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light', fail() {} });
    }
  },

  onSkip(e) {
    const seconds = Number(e.currentTarget.dataset.skip);
    this.state = pet.settle(this.state, Date.now() + seconds * 1000);
    this.save();
    this.render();
  },

  onReset() {
    this.state = pet.defaults();
    this.save();
    this.render();
  }
});
