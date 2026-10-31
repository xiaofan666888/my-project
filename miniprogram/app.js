App({
  onLaunch() {
    console.log('[pet] app launch');
  },
  globalData: {
    // 后端地址：先用本地调试，部署后改成线上域名
    apiBase: 'http://127.0.0.1:3000'
  }
});
