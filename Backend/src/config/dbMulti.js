import mysql from "mysql2/promise";
import dotenv from "dotenv";
import EventEmitter from "events";

dotenv.config();

class MultiDatabaseManager extends EventEmitter {
  constructor() {
    super();
    this.centralDB = null;
    this.sucursalesDB = null;
  }

  async initializeCentralDB(config = null) {
    return await this.initializeDB("centralDB", {
      host: process.env.DB_CENTRAL_HOST,
      user: process.env.DB_CENTRAL_USER,
      password: process.env.DB_CENTRAL_PASS || "",
      database: process.env.DB_CENTRAL_NAME,
    }, config);
  }

  async initializeSucursalesDB(config = null) {
    return await this.initializeDB("sucursalesDB", {
      host: process.env.DB_SUCURSALES_HOST,
      user: process.env.DB_SUCURSALES_USER,
      password: process.env.DB_SUCURSALES_PASS || "",
      database: process.env.DB_SUCURSALES_NAME,
    }, config);
  }

  async initializeDB(dbName, defaultConfig, customConfig = null) {
    try {
      if (this[dbName]) {
        await this[dbName].end();
        this[dbName] = null;
      }

      const dbConfig = customConfig || defaultConfig;

      if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
        console.warn(`Configuración de ${dbName} incompleta`);
        return false;
      }

      this[dbName] = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000,
      });

      const conn = await this[dbName].getConnection();
      await conn.ping();
      conn.release();

      console.log(`Conexión a ${dbName} establecida exitosamente`);
      this.emit(`${dbName}Connected`);
      return true;
    } catch (error) {
      console.error(`Error al conectar a ${dbName}:`, error.message);
      this[dbName] = null;
      return false;
    }
  }

  async executeQuery(dbName, query, params = []) {
    if (!this[dbName]) {
      throw new Error(`Base de datos ${dbName} no está configurada`);
    }
    const [results] = await this[dbName].query(query, params);
    return results;
  }

  async reconfigureDB(dbName, config) {
    return await this.initializeDB(dbName, config);
  }

  isDBConfigured(dbName) {
    return this[dbName] !== null;
  }
}

const multiDBManager = new MultiDatabaseManager();

// Inicializar conexiones de Central y Sucursales
await multiDBManager.initializeCentralDB();
await multiDBManager.initializeSucursalesDB();

export default multiDBManager;
