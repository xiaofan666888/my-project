const MIN_MS = 600;          // 短于这个时长认为是误触
const MAX_MS = 8000;         // 最长录 8 秒

Page({
  data: {
    petImg: '/images/cat/cat-normal.png',
    recording: false,
    playing: false,
    hasVoice: false,
    rate: 1.45,
    status: '按住下面的按钮说话',
    hint: '松开后它会用奇怪的声音学你'
  },

  onLoad() {
    const avatar = wx.getStorageSync('avatar_v1') || 'cat';
    this.setData({ petImg: '/images/' + avatar + '/' + avatar + '-normal.png' });

    this.ctx = null;
    this.buffer = null;
    this.src = null;
    this.pressAt = 0;
    this.decoded = false;

    this.rec = wx.getRecorderManager();

    this.rec.onStart(() => {
      this.setData({ recording: true, status: '在听…松手结束' });
    });

    this.rec.onStop((res) => {
      this.setData({ recording: false });
      if (!res || !res.tempFilePath) {
        this.setData({ status: '没录到声音，再试一次' });
        return;
      }
      this.loadRecording(res.tempFilePath);
    });

    this.rec.onError((err) => {
      this.setData({
        recording: false,
        status: '录音失败：' + ((err && err.errMsg) || '未知原因')
      });
    });

    // 尝试创建 WebAudio 上下文（用于变速播放）
    if (wx.createWebAudioContext) {
      try {
        this.ctx = wx.createWebAudioContext();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (!this.ctx) {
      this.setData({ hint: '当前基础库不支持变声，会直接播放原声' });
    }
  },

  onUnload() {
    this.stopRecorder();
    this.stopPlay();
    if (this.ctx && this.ctx.close) {
      try { this.ctx.close(); } catch (e) { /* noop */ }
    }
  },

  stopRecorder() {
    if (this.data.recording) {
      try { this.rec.stop(); } catch (e) { /* noop */ }
    }
  },

  stopPlay() {
    if (this.src) {
      try { this.src.stop(); } catch (e) { /* noop */ }
      this.src = null;
    }
  },

  /** 麦克风授权：首次会弹系统框，拒绝过就引导去设置 */
  ensureAuth() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (s) => {
          if (s.authSetting && s.authSetting['scope.record']) {
            resolve(true);
            return;
          }
          wx.authorize({
            scope: 'scope.record',
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '需要麦克风权限',
                content: '打开「录音」权限后，它才能学你说话',
                confirmText: '去设置',
                success: (m) => {
                  if (m.confirm) {
                    wx.openSetting({ success: () => resolve(false) });
                  } else {
                    resolve(false);
                  }
                },
                fail: () => resolve(false)
              });
            }
          });
        },
        fail: () => resolve(false)
      });
    });
  },

  onTouchStart() {
    if (this.data.playing) return;

    this.ensureAuth().then((ok) => {
      if (!ok) return;
      this.pressAt = Date.now();
      try {
        this.rec.start({
          duration: MAX_MS,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: 'mp3'
        });
      } catch (e) {
        this.setData({ status: '启动录音失败，检查权限后重试' });
      }
    });
  },

  onTouchEnd() {
    if (!this.data.recording) return;
    const held = Date.now() - this.pressAt;
    this.rec.stop();
    if (held < MIN_MS) {
      this.setData({ status: '说得太短了，按住久一点' });
    }
  },

  /** 读文件 → 解码 → 播放 */
  loadRecording(tempFilePath) {
    this.setData({ status: '处理中…' });
    this.decoded = false;

    wx.getFileSystemManager().readFile({
      filePath: tempFilePath,
      success: (res) => {
        if (!this.ctx) {
          this.playRaw(tempFilePath);
          return;
        }
        this.decode(res.data, tempFilePath);
      },
      fail: () => this.setData({ status: '读取录音失败' })
    });
  },

  decode(arrayBuffer, tempFilePath) {
    const onOk = (buffer) => {
      if (this.decoded) return;
      this.decoded = true;
      this.buffer = buffer;
      this.setData({ hasVoice: true });
      this.play(this.data.rate);
    };

    const onFail = () => {
      if (this.decoded) return;
      this.decoded = true;
      this.setData({ status: '解码失败，改为播放原声', hint: '可以用「原声」这个音色听听原音' });
      this.playRaw(tempFilePath);
    };

    try {
      const maybePromise = this.ctx.decodeAudioData(arrayBuffer, onOk, onFail);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(onOk).catch(onFail);
      }
    } catch (e) {
      onFail();
    }
  },

  /** 变速播放：playbackRate > 1 音调变高、语速变快 */
  play(rate) {
    if (!this.ctx || !this.buffer) {
      this.setData({ status: '还没有录音，先说一句' });
      return;
    }
    this.stopPlay();

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffer;
      src.playbackRate.value = rate;
      src.connect(this.ctx.destination);
      src.onended = () => {
        this.src = null;
        this.setData({ playing: false, status: '再来一次？' });
      };
      src.start(0);
      this.src = src;
      this.setData({ playing: true, status: '变声中… ×' + rate });
    } catch (e) {
      this.setData({ status: '播放失败：' + (e.message || '未知') });
    }
  },

  /** 没有 WebAudio 时的兜底：直接播原声 */
  playRaw(tempFilePath) {
    const inner = wx.createInnerAudioContext();
    inner.src = tempFilePath;
    inner.onEnded(() => {
      inner.destroy();
      this.setData({ playing: false, status: '再来一次？' });
    });
    inner.onError(() => {
      inner.destroy();
      this.setData({ playing: false, status: '播放失败' });
    });
    this.setData({ playing: true, status: '播放原声…' });
    inner.play();
  },

  onRate(e) {
    const rate = Number(e.currentTarget.dataset.rate);
    this.setData({ rate });
    if (this.data.hasVoice) {
      this.play(rate);
    } else {
      this.setData({ status: '先说一句，再换音色' });
    }
  }
});
