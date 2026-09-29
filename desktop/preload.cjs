const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('nestedDesktop', {
  initialize: () => ipcRenderer.invoke('project:initialize'),
  status: () => ipcRenderer.invoke('project:status'),
  stage: (doc) => ipcRenderer.invoke('project:stage', doc),
  save: (doc, saveAs = false) => ipcRenderer.invoke('project:save', doc, saveAs),
  open: () => ipcRenderer.invoke('project:open'),
  recover: () => ipcRenderer.invoke('project:recover'),
  newProject: () => ipcRenderer.invoke('project:new'),
  exportImage: (dataUrl) => ipcRenderer.invoke('image:export', dataUrl),
  showExport: () => ipcRenderer.invoke('image:show'),
  openBrief: (kind) => ipcRenderer.invoke('brief:open', kind),
  saveBrief: (text, kind, name) => ipcRenderer.invoke('brief:save', text, kind, name),
  importAsset: () => ipcRenderer.invoke('asset:import'),
  assetStatus: (ids) => ipcRenderer.invoke('asset:status', ids),
})
