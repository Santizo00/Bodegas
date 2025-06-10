// ==================== IMPORTACIONES ====================
const { app, BrowserWindow, dialog, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");
const packageJson = require("./package.json");
const fetch = require("node-fetch");
const os = require('os');
const axios = require('axios');
const http = require("http");

// ==================== CONSTANTES ====================
const isDev = !app.isPackaged;
const TMP_UPDATE_EXE = path.join(app.getPath("temp"), "BodegasSetup.exe");

// Constantes para manejo del archivo .env
const ENV_BACKUP_DIR = path.join(os.homedir(), 'AppData', 'Local', 'BodegasConfig');
const ENV_BACKUP_PATH = path.join(ENV_BACKUP_DIR, 'env.backup');
const UPDATE_MARKER_PATH = path.join(ENV_BACKUP_DIR, 'update_marker');

// Posibles ubicaciones de instalación
const POSSIBLE_INSTALL_LOCATIONS = [
  path.join('C:', 'Program Files', 'Bodegas'),
  path.join('C:', 'Program Files (x86)', 'Bodegas'),
  path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Bodegas'),
  // Añadir aquí más ubicaciones si fuera necesario
];

// ==================== VARIABLES GLOBALES ====================
let mainWindow;
let backendProcess;
let downloadWindow = null;
let isAppQuitting = false;
let isCleaningLocalstorage = false;

// ==================== GESTIÓN DE ARCHIVOS .ENV ====================

/**
 * Verifica si es la primera ejecución después de una actualización
 * @returns {boolean} - Verdadero si es primera ejecución tras actualización
 */
function isFirstRunAfterUpdate() {
  try {
    // Solo lee el marcador sin crear nada
    if (!fs.existsSync(UPDATE_MARKER_PATH)) {
      return true;
    }

    const markerVersion = fs.readFileSync(UPDATE_MARKER_PATH, 'utf8');
    return markerVersion !== packageJson.version;
  } catch (error) {
    console.error(`❌ Error al verificar si es primera ejecución: ${error.message}`);
    return false;
  }
}


/**
 * Crea una copia de seguridad del archivo .env
 * @param {string} backendPath - Ruta al directorio backend
 * @returns {boolean} - Resultado de la operación
 */
function backupEnvFile(backendPath) {
  try {
    console.log("🔄 Creando respaldo del archivo .env...");
    
    const envFilePath = path.join(backendPath, '.env');
    
    // Verificar si existe el archivo .env
    if (!fs.existsSync(envFilePath)) {
      console.log("ℹ️ No existe archivo .env para respaldar");
      return false;
    }
    
    // Crear directorio de respaldo si no existe
    if (!fs.existsSync(ENV_BACKUP_DIR)) {
      fs.mkdirSync(ENV_BACKUP_DIR, { recursive: true });
    }
    
    // Leer contenido del archivo original
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    
    // Verificar que el contenido sea válido
    if (!envContent.includes('=')) {
      console.log("⚠️ El archivo .env no tiene un formato válido");
      return false;
    }
    
    // Crear respaldo
    fs.writeFileSync(ENV_BACKUP_PATH, envContent);
    console.log(`✅ Respaldo creado en: ${ENV_BACKUP_PATH}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error al respaldar archivo .env: ${error.message}`);
    return false;
  }
}

/**
 * Restaura una copia de seguridad del archivo .env
 * @param {string} backendPath - Ruta al directorio backend
 * @returns {boolean} - Resultado de la operación
 */
function restoreEnvFile(backendPath) {
  try {
    console.log("🔍 Verificando respaldo del archivo .env...");
    
    // Verificar si existe el respaldo
    if (!fs.existsSync(ENV_BACKUP_PATH)) {
      console.log("ℹ️ No existe respaldo del archivo .env");
      return false;
    }
    
    // Verificar si existe el directorio backend
    if (!fs.existsSync(backendPath)) {
      console.log(`⚠️ No se encontró directorio backend en: ${backendPath}`);
      // Intentar crear el directorio
      try {
        fs.mkdirSync(backendPath, { recursive: true });
        console.log(`✅ Directorio backend creado en: ${backendPath}`);
      } catch (mkdirError) {
        console.error(`❌ No se pudo crear el directorio backend: ${mkdirError.message}`);
        return false;
      }
    }
    
    const envFilePath = path.join(backendPath, '.env');
    
    // Leer contenido del respaldo
    const backupContent = fs.readFileSync(ENV_BACKUP_PATH, 'utf8');
    
    // Verificar que el respaldo sea válido
    if (!backupContent.includes('=')) {
      console.log("⚠️ El archivo de respaldo no tiene un formato válido");
      return false;
    }
    
    // Restaurar respaldo
    fs.writeFileSync(envFilePath, backupContent);
    console.log(`✅ Archivo .env restaurado en: ${envFilePath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error al restaurar respaldo: ${error.message}`);
    return false;
  }
}

/**
 * Gestiona el archivo .env (respaldo o restauración según corresponda)
 * @param {string} backendPath - Ruta al directorio backend
 * @returns {boolean} - Resultado de la operación
 */
function manageEnvFile(backendPath) {
  try {
    const envFilePath = path.join(backendPath, '.env');
    
    // Si no existe el respaldo pero sí existe .env, crear respaldo
    if (!fs.existsSync(ENV_BACKUP_PATH) && fs.existsSync(envFilePath)) {
      return backupEnvFile(backendPath);
    }
    
    // Si existe respaldo pero no existe .env, restaurar
    if (fs.existsSync(ENV_BACKUP_PATH) && !fs.existsSync(envFilePath)) {
      return restoreEnvFile(backendPath);
    }
    
    // Si ambos existen, comparar contenido
    if (fs.existsSync(ENV_BACKUP_PATH) && fs.existsSync(envFilePath)) {
      const backupContent = fs.readFileSync(ENV_BACKUP_PATH, 'utf8');
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      
      // Si el contenido es diferente y el respaldo tiene datos válidos, restaurar
      if (backupContent !== envContent && backupContent.includes('=') && 
          (backupContent.includes('DB_LOCAL_HOST') || backupContent.includes('NOMBRE_SUCURSAL'))) {
        console.log("🔄 Se detectó un archivo .env diferente al respaldo. Restaurando configuración anterior...");
        return restoreEnvFile(backendPath);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error en manageEnvFile: ${error.message}`);
    return false;
  }
}

/**
 * Busca una instalación existente y su archivo .env para respaldarlo antes de la actualización
 * @returns {boolean} - Resultado de la operación
 */
function findAndBackupCurrentEnv() {
  try {
    console.log("🔍 Buscando instalación actual para respaldar .env...");
    
    // Primero verificar ubicaciones comunes para instalaciones
    for (const location of POSSIBLE_INSTALL_LOCATIONS) {
      console.log(`Verificando en: ${location}`);
      
      if (fs.existsSync(location)) {
        // Posibles rutas donde puede estar el archivo .env
        const possibleEnvPaths = [
          path.join(location, 'resources', 'backend', '.env'),
          path.join(location, 'resources', 'app', 'backend', '.env'),
          path.join(location, 'backend', '.env'),
          path.join(location, '.env')
        ];
        
        for (const envPath of possibleEnvPaths) {
          if (fs.existsSync(envPath)) {
            console.log(`✅ Archivo .env encontrado en: ${envPath}`);
            
            // Leer el archivo .env
            const envContent = fs.readFileSync(envPath, 'utf8');
            
            // Verificar que contenga datos válidos
            if (envContent.includes('=') && 
                (envContent.includes('DB_LOCAL_HOST') || 
                 envContent.includes('NOMBRE_SUCURSAL'))) {
              
              // Crear directorio de respaldo si no existe
              if (!fs.existsSync(ENV_BACKUP_DIR)) {
                fs.mkdirSync(ENV_BACKUP_DIR, { recursive: true });
              }
              
              // Crear respaldo
              fs.writeFileSync(ENV_BACKUP_PATH, envContent);
              console.log(`✅ Configuración respaldada en: ${ENV_BACKUP_PATH}`);
              
              return true;
            } else {
              console.log("⚠️ El archivo .env encontrado no contiene datos válidos");
            }
          }
        }
      }
    }
    
    // Buscar en el registro de Windows (solo en Windows)
    if (process.platform === 'win32') {
      try {
        const regResult = childProcess.execSync(
          'reg query "HKCU\\Software\\Bodegas" /v InstallLocation',
          { encoding: 'utf8' }
        );
        
        const match = regResult.match(/InstallLocation\s+REG_SZ\s+(.*)/);
        if (match && match[1]) {
          const regLocation = match[1].trim();
          console.log(`🔍 Instalación encontrada en registro: ${regLocation}`);
          
          if (fs.existsSync(regLocation)) {
            const envPath = path.join(regLocation, 'resources', 'backend', '.env');
            if (fs.existsSync(envPath)) {
              const envContent = fs.readFileSync(envPath, 'utf8');
              
              // Verificar que contenga datos válidos
              if (envContent.includes('=')) {
                // Crear directorio de respaldo si no existe
                if (!fs.existsSync(ENV_BACKUP_DIR)) {
                  fs.mkdirSync(ENV_BACKUP_DIR, { recursive: true });
                }
                
                // Crear respaldo
                fs.writeFileSync(ENV_BACKUP_PATH, envContent);
                console.log(`✅ Configuración respaldada desde registro en: ${ENV_BACKUP_PATH}`);
                
                return true;
              }
            }
          }
        }
      } catch (regError) {
        console.log("No se encontró entrada en el registro:", regError.message);
      }
    }
    
    console.log("⚠️ No se encontró instalación actual para respaldar");
    return false;
  } catch (error) {
    console.error(`❌ Error al buscar instalación actual: ${error.message}`);
    return false;
  }
}

/**
 * Restaura automáticamente la configuración .env previa si existe un respaldo
 * @returns {boolean} - Verdadero si se restauró correctamente
 */
function autoRestorePreviousConfig() {
  try {
    console.log("🔄 Verificando si hay una configuración previa para restaurar...");
    
    // Verificar si existe el respaldo
    if (!fs.existsSync(ENV_BACKUP_PATH)) {
      console.log("ℹ️ No existe respaldo del archivo .env para restaurar");
      return false;
    }
    
    // Leer contenido del respaldo
    const envContent = fs.readFileSync(ENV_BACKUP_PATH, 'utf8');
    
    // Verificar que el contenido sea válido
    if (!envContent.includes('=') || 
        (!envContent.includes('DB_LOCAL_HOST') && !envContent.includes('NOMBRE_SUCURSAL'))) {
      console.log("⚠️ El archivo de respaldo no tiene un formato válido");
      return false;
    }
    
    // Determinar la ruta del backend según el entorno
    const backendPath = isDev 
      ? path.join(__dirname, "Backend") 
      : path.join(process.resourcesPath, "backend");
    
    // Asegurarse que el directorio backend existe
    if (!fs.existsSync(backendPath)) {
      try {
        fs.mkdirSync(backendPath, { recursive: true });
      } catch (mkdirError) {
        console.error(`❌ No se pudo crear el directorio backend: ${mkdirError.message}`);
        return false;
      }
    }
    
    const envFilePath = path.join(backendPath, '.env');
    
    // Si existe un archivo .env actual, verificar su contenido
    if (fs.existsSync(envFilePath)) {
      const currentEnvContent = fs.readFileSync(envFilePath, 'utf8');
      
      // Si el contenido es idéntico, no hacer nada
      if (currentEnvContent === envContent) {
        console.log("✅ El archivo .env actual ya tiene la configuración respaldada");
        return true;
      }
      
      // Si el actual no tiene datos específicos pero el respaldo sí, restaurar
      if ((!currentEnvContent.includes('DB_LOCAL_HOST=172.') && envContent.includes('DB_LOCAL_HOST=172.')) ||
          (!currentEnvContent.includes('NOMBRE_SUCURSAL=') && envContent.includes('NOMBRE_SUCURSAL='))) {
        console.log("🔄 El archivo .env actual no tiene datos específicos. Restaurando respaldo...");
      } else {
        // Crear una copia del archivo actual antes de sobrescribirlo (por seguridad)
        const envBackupTemp = path.join(backendPath, '.env.temp');
        fs.writeFileSync(envBackupTemp, currentEnvContent);
        console.log(`ℹ️ Backup temporal creado en: ${envBackupTemp}`);
      }
    }
    
    // Restaurar el respaldo
    fs.writeFileSync(envFilePath, envContent);
    console.log(`✅ Configuración restaurada automáticamente en: ${envFilePath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error al restaurar configuración: ${error.message}`);
    return false;
  }
}

// ==================== GESTIÓN DEL BACKEND ====================

/**
 * Inicia el servidor backend
 * @returns {ChildProcess|null} - Proceso del backend o null si hay error
 */
function startBackendServer() {
  try {
    console.log("⏳ Iniciando servidor backend...");
    
    // Determinar la ruta del backend según el entorno
    const backendPath = isDev 
      ? path.join(__dirname, "Backend") 
      : path.join(process.resourcesPath, "backend");
    
    console.log(`📁 Ruta del backend: ${backendPath}`);
    
    // Verificar si es primera ejecución después de actualización
    // y restaurar el archivo .env si es necesario
    if (isFirstRunAfterUpdate()) {
      console.log("🔄 Primera ejecución después de actualización detectada");
      // Restaurar automáticamente la configuración anterior
      autoRestorePreviousConfig();
    } else {
      // En ejecuciones normales, solo gestionar si hay diferencias
      manageEnvFile(backendPath);
    }
    
    // Verificar que el directorio existe
    if (!fs.existsSync(backendPath)) {
      console.error(`❌ ERROR: No se encontró el directorio backend en: ${backendPath}`);
      return null;
    }
    
    // Comando para iniciar el backend
    const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
    const serverFile = path.join(backendPath, "src", "server.js");
    
    // Verificar que el archivo server.js existe
    if (!fs.existsSync(serverFile)) {
      console.error(`❌ ERROR: No se encontró el archivo server.js en: ${serverFile}`);
      return null;
    }
    
    console.log(`📄 Usando archivo server.js en: ${serverFile}`);
    
    // Configurar variables de entorno
    const env = {
      ...process.env,
      PORT: 5000,
      NODE_ENV: isDev ? "development" : "production",
      CORS_ORIGIN: isDev ? "http://localhost:3000" : "*"
    };
    
    // Iniciar el proceso
    const proc = childProcess.spawn(nodeCmd, [serverFile], {
      cwd: backendPath,
      env: env,
      stdio: "pipe",
      windowsHide: true
    });
    
    // Manejar la salida del proceso
    proc.stdout.on("data", (data) => {
      console.log(`Backend stdout: ${data.toString()}`);
    });
    
    proc.stderr.on("data", (data) => {
      console.error(`Backend stderr: ${data.toString()}`);
    });
    
    proc.on("error", (error) => {
      console.error(`❌ ERROR al iniciar el backend: ${error.message}`);
      dialog.showErrorBox(
        "Error de Conexión",
        "Es necesario reiniciar la aplicación."
      );
      app.quit();
    });
    
    proc.on("close", (code) => {
      console.log(`Backend cerrado con código: ${code}`);
      // Solo mostrar error si no estamos en proceso de cierre de la aplicación
      if (code !== 0 && code !== null && !isAppQuitting) {
        dialog.showErrorBox(
          "Error de Conexión",
          "Es necesario reiniciar la aplicación."
        );
        app.quit();
      }
      backendProcess = null;
    });
    
    return proc;
  } catch (error) {
    console.error(`❌ ERROR CRÍTICO: ${error.message}`);
    dialog.showErrorBox(
      "Error de Conexión",
      "Es necesario reiniciar la aplicación."
    );
    app.quit();
    return null;
  }
}

/**
 * Verifica si el backend está funcionando correctamente
 * @param {number} retries - Número de intentos
 * @param {number} interval - Intervalo entre intentos en ms
 * @returns {Promise<boolean>} - Promise que resuelve a true si el backend está funcionando
 */
function checkBackendStatus(retries = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let currentRetry = 0;
    
    const checkConnection = () => {
      const req = http.request({
        hostname: "localhost",
        port: 5000,
        path: "/",
        method: "GET",
        timeout: 1000
      }, (res) => {
        console.log(`✅ Backend respondió con código: ${res.statusCode}`);
        resolve(true);
      });
      
      req.on("error", () => {
        currentRetry++;
        console.log(`⏳ Esperando a que el backend inicie... (intento ${currentRetry}/${retries})`);
        
        if (currentRetry >= retries) {
          console.error("❌ Tiempo máximo de espera excedido");
          reject(new Error("No se pudo conectar con el backend después de múltiples intentos"));
        } else {
          setTimeout(checkConnection, interval);
        }
      });
      
      req.on("timeout", () => {
        req.destroy();
      });
      
      req.end();
    };
    
    checkConnection();
  });
}

// ==================== GESTIÓN DE ACTUALIZACIONES ====================

/**
 * Descarga e instala una nueva versión de la aplicación
 * @param {string} urlDescarga - URL de descarga del instalador
 * @returns {Promise<void>}
 */
async function downloadAndInstall(urlDescarga) {
  try {
    // Antes de descargar la actualización, respaldar el .env actual
    findAndBackupCurrentEnv();
    
    const urlNoCache = `${urlDescarga}?t=${Date.now()}`;
    const response = await axios({
      method: "GET",
      url: urlNoCache,
      responseType: "stream"
    });

    const totalBytes = parseInt(response.headers["content-length"] || "0", 10);
    let downloadedBytes = 0;

    const writer = fs.createWriteStream(TMP_UPDATE_EXE);

    response.data.on("data", (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const percentNumber = (downloadedBytes / totalBytes) * 100;
        const percent = percentNumber.toFixed(0); 
        if (downloadWindow && !downloadWindow.isDestroyed()) {
          downloadWindow.webContents.send("download-progress", percent);
        }
      }
    });

    // Conectar y esperar a que termine
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // Notificar que la descarga está completa
    if (downloadWindow && !downloadWindow.isDestroyed()) {
      downloadWindow.webContents.send("download-complete");
    }
    
    // Mostrar un mensaje final antes de ejecutar el instalador
    const result = await dialog.showMessageBox({
      type: "info",
      title: "Actualización lista",
      message: "La actualización se descargó correctamente.\n\n¿Deseas instalarla ahora? La aplicación se cerrará para completar la instalación.",
      buttons: ["Instalar ahora", "Instalar al cerrar la aplicación"],
      defaultId: 0,
      cancelId: 1
    });

    // Determinar ruta del backend para respaldar .env
    const backendPath = isDev 
      ? path.join(__dirname, "Backend") 
      : path.join(process.resourcesPath, "backend");

    if (result.response === 0) {
      // Respaldar .env antes de instalar (verificación final)
      backupEnvFile(backendPath);
      
      // Ejecutar el instalador inmediatamente
      childProcess.spawn(TMP_UPDATE_EXE, {
        detached: true,
        shell: true
      });
      
      // Cerrar la app
      app.quit();
    } else {
      // El usuario eligió instalar al cerrar
      // Cerrar solo la ventana de descarga
      if (downloadWindow && !downloadWindow.isDestroyed()) {
        downloadWindow.close();
        downloadWindow = null;
      }
      
      // Configurar la instalación para cuando se cierre la app
      app.once('will-quit', () => {
        // Respaldar .env antes de instalar (verificación final)
        backupEnvFile(backendPath);
        
        childProcess.spawn(TMP_UPDATE_EXE, {
          detached: true,
          shell: true
        });
      });
    }
  } catch (error) {
    console.error("Error al descargar o iniciar instalación:", error);
    dialog.showErrorBox(
      "Error en la actualización",
      `Ocurrió un error al descargar o ejecutar el instalador: ${error.message}`
    );
    
    // Cerrar la ventana de descarga en caso de error
    if (downloadWindow && !downloadWindow.isDestroyed()) {
      downloadWindow.close();
      downloadWindow = null;
    }
  }
}

/**
 * Verifica si hay actualizaciones disponibles y las maneja
 * @param {BrowserWindow} targetWindow - Ventana donde mostrar el diálogo
 * @returns {Promise<void>}
 */
async function checkForUpdates(targetWindow) {
  try {
    const localVersion = packageJson.version;
    
    // Agregamos un timestamp para forzar una request nueva cada vez
    const urlVersionJson = `https://raw.githubusercontent.com/AxelSantizo/VersionBodegas/refs/heads/main/version.json?t=${Date.now()}`;
    
    // Cabeceras para forzar no-caché
    const response = await fetch(urlVersionJson, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    });
    
    if (!response.ok) {
      throw new Error(`No se pudo leer versión remota: ${response.statusText}`);
    }

    const remoteData = await response.json();
    const remoteVersion = remoteData.version;
    
    if (remoteVersion && remoteVersion !== localVersion) {
      const result = await dialog.showMessageBox(targetWindow, {
        type: "info",
        title: "Nueva versión disponible",
        message: `Se encontró una nueva versión (${remoteVersion})`,
        detail: `Notas de la versión: ${remoteData.notes || 'No disponibles'}`,
        buttons: ["Descargar ahora", "Descargar más tarde"],
        cancelId: 1,
        noLink: true
      });
      
      if (result.response === 0) {
        // Mostrar ventana de descarga sin bloquear la aplicación principal
        showDownloadWindow();
        // Iniciar descarga en segundo plano
        downloadAndInstall(remoteData.url_descarga);
      }
    }
    
    return remoteData;
  } catch (error) {
    console.error(`⚠️ Error al consultar versión remota: ${error.message}`);
    return null;
  }
}

// ==================== GESTIÓN DE VENTANAS ====================

/**
 * Limpia localStorage y luego cierra la aplicación
 */
function cleanLocalStorageAndClose() {
  if (isCleaningLocalstorage) return; // Evitamos múltiples llamadas
  isCleaningLocalstorage = true;
  
  console.log("🧹 Limpiando localStorage antes de cerrar...");
  
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript('localStorage.clear(); "cleaned"')
      .then((result) => {
        console.log(`✅ localStorage limpiado: ${result}`);
        isAppQuitting = true;
        mainWindow.close();
      })
      .catch(err => {
        console.error("❌ Error al limpiar localStorage:", err);
        isAppQuitting = true;
        mainWindow.close();
      });
  } else {
    app.quit();
  }
}

/**
 * Muestra la ventana de descarga de actualizaciones
 * @returns {BrowserWindow} - Instancia de la ventana de descarga
 */
function showDownloadWindow() {
  // Cerrar ventana existente si hay una
  if (downloadWindow && !downloadWindow.isDestroyed()) {
    downloadWindow.close();
  }
  
  downloadWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  downloadWindow.loadFile(path.join(__dirname, "splash_download.html"));
  downloadWindow.setTitle("Descargando actualización");
  
  downloadWindow.once("ready-to-show", () => downloadWindow.show());
  
  downloadWindow.on("closed", () => {
    downloadWindow = null;
  });
  
  return downloadWindow;
}

/**
 * Crea la ventana principal y splash de la aplicación
 * @returns {Promise<void>}
 */
const createWindow = async () => {
  console.log("⏳ Iniciando proceso de creación de ventanas...");

  // 1. Crear la ventana de Splash
  const splash = new BrowserWindow({
    width: 500,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.once("ready-to-show", () => {
    splash.show();
  });

  // 2. Iniciar el backend
  backendProcess = startBackendServer();
  if (!backendProcess) {
    dialog.showErrorBox(
      "Error de Conexión",
      "Es necesario reiniciar la aplicación."
    );
    app.quit();
    return;
  }

  try {
    // 3. Esperar a que el backend esté listo
    await checkBackendStatus().catch(err => {
      console.error(`Error al verificar backend: ${err.message}`);
      dialog.showErrorBox(
        "Error de Conexión",
        "Es necesario reiniciar la aplicación."
      );
      app.quit();
      return;
    });

    // 4. Crear la ventana principal
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow = new BrowserWindow({
      width,
      height,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: isDev
      }
    });

    mainWindow.maximize();

    if (isDev) {
      console.log("🔨 Modo desarrollo: Cargando http://localhost:3000");
      mainWindow.loadURL("http://localhost:3000");
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      console.log("🚀 Modo producción: Cargando desde archivos locales");
      const prodURL = path.join(__dirname, "Frontend", "dist", "index.html");
      if (fs.existsSync(prodURL)) {
        mainWindow.loadFile(prodURL);
      } else {
        console.error(`❌ ERROR: No se encontró index.html en ${prodURL}`);
        dialog.showErrorBox(
          "Error de carga",
          "No se encontró la interfaz de usuario. La aplicación no puede continuar."
        );
        app.quit();
        return;
      }
    }

    // 5. Cuando mainWindow esté lista para mostrarse
    mainWindow.once("ready-to-show", async () => {
      if (splash && !splash.isDestroyed()) {
        splash.destroy();
      }
      mainWindow.show();
      
      // 6. Restaurar automáticamente la configuración anterior si es necesario
      // (esto ocurre silenciosamente)
      if (isFirstRunAfterUpdate()) {
        autoRestorePreviousConfig();
      }
      
      // 7. Verificar si hay actualizaciones disponibles
      await checkForUpdates(mainWindow);
    });

    // Interceptar evento de cierre para limpieza de localStorage
    mainWindow.on("close", (event) => {
      if (!isAppQuitting) {
        event.preventDefault();
        cleanLocalStorageAndClose();
      }
    });

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

  } catch (error) {
    console.error(`❌ ERROR al crear ventana principal: ${error.message}`);
    if (splash && !splash.isDestroyed()) {
      splash.destroy();
    }
    dialog.showErrorBox(
      "Error de inicio",
      `Error al iniciar la aplicación: ${error.message}`
    );
    app.quit();
  }
};

// ==================== EVENTOS DE IPC ====================

// Manejador para cerrar la aplicación
ipcMain.on('window:close', () => {
  cleanLocalStorageAndClose();
});

// Manejador para cancelar descarga
ipcMain.on('download:cancel', () => {
  if (downloadWindow && !downloadWindow.isDestroyed()) {
    downloadWindow.close();
    downloadWindow = null;
  }
});

// Manejador para minimizar la ventana de descarga
ipcMain.on('window:minimize', () => {
  if (downloadWindow && !downloadWindow.isDestroyed()) {
    downloadWindow.minimize();
  }
});

// Manejador para forzar el respaldo de la configuración actual (silencioso)
ipcMain.on('backup:config', () => {
  const backendPath = isDev 
    ? path.join(__dirname, "Backend") 
    : path.join(process.resourcesPath, "backend");
  
  backupEnvFile(backendPath);
});

// ==================== EVENTOS DE LA APP ====================

// Cuando la app esté lista, crear la ventana
app.whenReady().then(createWindow);

// Gestionar el cierre de la aplicación
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// En macOS, reactivar la app al hacer clic en el dock
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Asegurarse de cerrar el backend cuando la app se cierre
app.on("before-quit", () => {
  console.log("🔄 Cerrando la aplicación...");
  isAppQuitting = true;
  
  // Si aún no se ha limpiado el localStorage, hacerlo ahora
  if (mainWindow && !isCleaningLocalstorage) {
    try {
      // Intentamos una limpieza síncrona como último recurso
      mainWindow.webContents.executeJavaScript('localStorage.clear()', true);
    } catch (err) {
      console.error("Error en limpieza final:", err);
    }
  }
  
  if (backendProcess) {
    // En Windows hay que ser más agresivos para cerrar el proceso
    if (process.platform === "win32") {
      try {
        childProcess.execSync(`taskkill /pid ${backendProcess.pid} /f /t`);
      } catch (error) {
        console.error(`Error al cerrar proceso: ${error.message}`);
      }
    } else {
      backendProcess.kill("SIGTERM");
    }
    console.log("✅ Proceso del backend terminado");
  }
});