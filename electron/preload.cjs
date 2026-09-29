const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('workertinkDesktop', {
  notify(payload) {
    ipcRenderer.send('workertink:notify', {
      title: String(payload?.title || 'WorkerTink').slice(0, 160),
      body: String(payload?.body || '').slice(0, 1000),
      url: typeof payload?.url === 'string' ? payload.url : ''
    });
  }
});
