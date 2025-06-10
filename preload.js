// preload.js
const { contextBridge, ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", () => {
  console.log("Preload script loaded!");
});

// Exponemos una API más completa para la ventana de descarga
contextBridge.exposeInMainWorld("electronAPI", {
  // Recibir actualizaciones del progreso de descarga
  onDownloadProgress: (callback) => {
    ipcRenderer.on("download-progress", (event, percent) => {
      callback(percent);
    });
  },
  
  // Notificación cuando la descarga está completa
  onDownloadComplete: (callback) => {
    ipcRenderer.on("download-complete", () => {
      callback();
    });
  },
  
  // Cancelar la descarga y cerrar la ventana
  cancelDownload: () => {
    ipcRenderer.send("download:cancel");
  },
  
  // Minimizar la ventana de descarga
  minimizeWindow: () => {
    ipcRenderer.send("window:minimize");
  },
  
  // Funciones generales de la aplicación
  closeApp: () => {
    ipcRenderer.send("window:close");
  }
});