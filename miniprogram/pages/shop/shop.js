const game = require('../../utils/game.js');

const STORE_KEY = 'pet_state_v1';

Page({
  data: {
    coins: 0,
    foods: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const s = game.ensure(wx.getStorageSync(STORE_KEY) || {});
    this.state = s;
    const foods = Object.keys(game.FOODS).map((k) => {
      const f = game.FOODS[k];
      return {
        id: f.id,
        name: f.name,
        icon: f.icon,
        price: f.price,
        desc: f.desc,
        hunger: f.hunger,
        mood: f.mood,
        exp: f.exp,
        count: s.inv[f.id] || 0,
        affordable: s.coins >= f.price
      };
    });
    this.setData({ coins: s.coins, foods: foods });
  },

  onBuy(e) {
    const id = e.currentTarget.dataset.id;
    const s = this.state;
    const r = game.buy(s, id);

    if (!r.ok) {
      wx.showToast({ title: r.msg, icon: 'none' });
      return;
    }

    wx.setStorageSync(STORE_KEY, s);
    this.refresh();
    wx.showToast({ title: '买到 ' + r.food.name, icon: 'none' });

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light', fail() {} });
    }
  },

  goHome() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    });
  }
});
