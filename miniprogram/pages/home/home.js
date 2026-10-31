const pet = require('../../utils/pet.js');
const game = require('../../utils/game.js');

const STORE_KEY = 'pet_state_v1';

// 不同部位的台词。同一部位给几句，避免每次反应都一样。
const REACTIONS = {
  head: ['别戳我的头！', '晕了晕了…', '哎哟！', '头发要乱了'],
  belly: ['痒痒的～', '杨珺瑞', '别挠了别挠了', '好痒！'],
  feet: ['别碰我的脚！', '哈哈哈', '站不稳了…', '怕痒']
};

const PARTICLE_ICONS = {
  head: ['💫', '✨', '⭐'],
  belly: ['❤️', '💕', '✨'],
  feet: ['⭐', '💨', '✨']
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function expressionOf(s) {
  if (s.mood < 22) return 'sad';
  if (s.hunger < 18 || s.clean < 18) return 'angry';
  if (s.mood > 76 && s.hunger > 40 && s.clean > 40) return 'happy';
  return 'normal';
}

function moodTextOf(s) {
  if (s.hunger < 20) return '饿到没力气';
  if (s.clean < 20) return '身上脏脏的';
  if (s.mood > 78) return '心情超好';
  if (s.mood < 28) return '有点低落';
  return '看起来还不错';
}

Page({
  data: {
    hunger: 80,
    clean: 80,
    mood: 70,
    avatar: 'cat',
    petImg: '/images/cat/cat-normal.png',
    say: '戳戳我',
    bubbleOn: false,
    anim: '',
    since: '刚刚',
    moodText: '看起来还不错',
    particles: [],
    coins: 0,
    level: 1,
    title: '陌生人',
    expPct: 0,
    expText: '',
    foodCount: 0,
    showCheckIn: false,
    streak: 0,
    checkInReward: 0,
    disFeed: false,
    disBath: false,
    disPlay: false,
    cdFeed: '',
    cdBath: '',
    cdPlay: ''
  },

  onLoad() {
    this.avatar = wx.getStorageSync('avatar_v1') || 'cat';
    this.pid = 0;
    this.setData({ avatar: this.avatar });
    this.loadState();
    this.render();
    this.maybeEvent();
  },

  onShow() {
    // 每次都从存储里重新读，否则从商店回来时买到的食物不会生效
    this.loadState();
    this.render();
    this.refreshCheckIn();
    this.stopTimer();
    this.timer = setInterval(() => this.tick(), 1000);
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
    clearTimeout(this._animT);
    clearTimeout(this._pT);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  loadState() {
    const raw = wx.getStorageSync(STORE_KEY);
    const base = raw && raw.lastTick ? pet.settle(raw, Date.now()) : pet.defaults();
    this.state = game.ensure(base);
    this.awayMs = raw && raw.lastTick ? Date.now() - raw.lastTick : 0;
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

    const lv = game.levelOf(s.exp);

    const patch = {
      hunger: Math.round(s.hunger),
      clean: Math.round(s.clean),
      mood: Math.round(s.mood),
      moodText: moodTextOf(s),
      petImg: '/images/' + this.avatar + '/' + this.avatar + '-' + expressionOf(s) + '.png',
      since: pet.sinceText(s.lastTick),
      coins: s.coins,
      level: lv.lv,
      title: lv.title,
      expPct: lv.progress,
      expText: lv.isMax ? '已满级' : (s.exp + ' / ' + lv.nextNeed),
      foodCount: s.inv.basic,
      streak: s.streak,
      disFeed: !!left.feed,
      disBath: !!left.bath,
      disPlay: !!left.play,
      cdFeed: left.feed,
      cdBath: left.bath,
      cdPlay: left.play
    };

    if (!this._bubble) {
      patch.say = pet.wordsOf(s);
    }

    this.setData(patch);
  },

  refreshCheckIn() {
    const s = this.state;
    const done = s.lastCheckIn === game.todayKey();
    if (done) {
      this.setData({ showCheckIn: false });
      return;
    }
    const reward = Math.min(8 + s.streak * 3, 26);
    this.setData({ showCheckIn: true, checkInReward: reward });
  },

  onCheckIn() {
    const r = game.checkIn(this.state);
    this.save();
    this.setData({ showCheckIn: false });
    this.render();
    if (r.ok) {
      this.say('签到 +' + r.reward + ' 金币，连续 ' + r.streak + ' 天', 'anim-feet');
    }
  },

  /** 离开太久，可能发生点事 */
  maybeEvent() {
    const ev = game.randomEvent(this.awayMs || 0);
    if (!ev) return;
    this.state.mood = pet.clamp(this.state.mood + ev.mood);
    this.save();
    setTimeout(() => {
      this.say(ev.text, '');
    }, 900);
  },

  spawnParticles(part) {
    const icons = PARTICLE_ICONS[part] || ['✨'];
    const list = [];
    for (let i = 0; i < 3; i++) {
      list.push({
        id: this.pid++,
        icon: icons[i % icons.length],
        x: 150 + Math.round(Math.random() * 140),
        delay: i * 70
      });
    }
    this.setData({ particles: list });
    clearTimeout(this._pT);
    this._pT = setTimeout(() => this.setData({ particles: [] }), 1100);
  },

  say(text, anim) {
    this._bubble = true;
    this.setData({ say: text, bubbleOn: true, anim: '' });

    setTimeout(() => {
      this.setData({ anim: anim || '' });
    }, 20);

    clearTimeout(this._animT);
    this._animT = setTimeout(() => {
      this._bubble = false;
      this.setData({ bubbleOn: false, anim: '' });
      this.render();
    }, 1100);
  },

  onTouch(e) {
    const part = e.currentTarget.dataset.part;
    this.state = pet.settle(this.state, Date.now());

    const hungry = this.state.hunger < 25;
    const dirty = this.state.clean < 25;

    let text;
    let anim;

    if (hungry && Math.random() < 0.7) {
      text = '我饿了…先给我吃的好不好';
      anim = 'anim-refuse';
    } else if (dirty && Math.random() < 0.5) {
      text = '别碰我，身上脏脏的';
      anim = 'anim-refuse';
    } else {
      text = pick(REACTIONS[part] || ['嗯？']);
      anim = 'anim-' + part;
    }

    this.state.mood = pet.clamp(this.state.mood + (part === 'belly' ? 3 : 1.2));
    // 互动也给一点点金币和少量经验，但有每日上限
    const gain = game.addCoins(this.state, 1);
    if (gain > 0) game.addExp(this.state, 1);
    this.save();

    this.say(text, anim);
    this.spawnParticles(part);
    this.render();

    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light', fail() {} });
    }
  },

  /** 喂食：消耗一个口粮 */
  onFeed() {
    const s = this.state;
    if ((s.cd.feed || 0) > Date.now()) return;

    if ((s.inv.basic || 0) <= 0) {
      this.say('口粮吃完了，去商店买点吧', 'anim-refuse');
      return;
    }

    const r = game.useFood(s, 'basic');
    if (!r.ok) {
      this.say(r.msg, 'anim-refuse');
      return;
    }
    s.cd.feed = Date.now() + pet.CONFIG.actions.feed.cooldownSec * 1000;
    this.save();

    this.say(r.leveledUp ? '升级了！现在是「' + r.level.title + '」' : '好吃！', 'anim-head');
    this.spawnParticles('belly');
    this.render();
  },

  onAction(e) {
    const name = e.currentTarget.dataset.act;
    if (name === 'feed') {
      this.onFeed();
      return;
    }

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
    game.addCoins(this.state, 2);
    game.addExp(this.state, 3);
    this.save();

    const lines = {
      bath: ['舒服～', '干净了！', '别弄我头发'],
      play: ['再来一次！', '好玩好玩', '累死我了']
    };
    const animMap = { bath: 'anim-belly', play: 'anim-feet' };

    this.say(pick(lines[name] || ['嗯']), animMap[name]);
    this.spawnParticles(name === 'bath' ? 'belly' : 'feet');
    this.render();
  },

  onSkip(e) {
    const seconds = Number(e.currentTarget.dataset.skip);
    this.state = pet.settle(this.state, Date.now() + seconds * 1000);
    this.save();
    this.render();
    const label = seconds >= 86400 ? (seconds / 86400) + ' 天' : (seconds / 3600) + ' 小时';
    this.say('时间快进了 ' + label, '');
  },

  onReset() {
    this.state = game.ensure(pet.defaults());
    this.save();
    this.render();
    this.say('重新开始了', '');
  },

  onSwitchAvatar() {
    this.avatar = this.avatar === 'cat' ? 'me' : 'cat';
    wx.setStorageSync('avatar_v1', this.avatar);
    this.setData({ avatar: this.avatar });
    this.render();
    this.say(this.avatar === 'cat' ? '换回猫猫了' : '换成你自己了', 'anim-head');
  },

  goTalk() {
    wx.navigateTo({ url: '/pages/talk/talk' });
  },

  goShop() {
    wx.navigateTo({ url: '/pages/shop/shop' });
  }
});
