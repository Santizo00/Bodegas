// config/db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import EventEmitter from 'events';

dotenv.config();

class DatabaseManager extends EventEmitter {
  constructor() {
    super();
    this.localDB = null;
    this.centralDB = null;
    this.isInitialized = false;
  }

  async initializeLocalDB(config = null) {
    try {
      // Si hay una conexión existente, cerrarla
      if (this.localDB) {
        await this.localDB.end();
        this.localDB = null;
      }

      // Usar la configuración proporcionada o las variables de entorno
      const dbConfig = config || {
        host: process.env.DB_LOCAL_HOST,
        user: process.env.DB_LOCAL_USER,
        password: process.env.DB_LOCAL_PASS || "",
        database: process.env.DB_LOCAL_NAME,
      };

      // Verificar que tengamos toda la configuración necesaria
      if (!dbConfig.host || !dbConfig.user || !dbConfig.database) {
        console.warn("Configuración de base de datos local incompleta");
        return false;
      }

      // Crear el pool de conexiones
      this.localDB = mysql.createPool({
        ...dbConfig,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000
      });

      // Verificar la conexión
      const conn = await this.localDB.getConnection();
      await conn.ping();
      conn.release();

      console.log("Conexión local establecida exitosamente");
      this.isInitialized = true;
      this.emit('localDbConnected');
      return true;
    } catch (error) {
      console.error("Error al conectar a la base de datos local:", error.message);
      this.localDB = null;
      return false;
    }
  }

  async executeLocalQuery(query, params = []) {
    if (!this.localDB) {
      throw new Error("Base de datos local no está configurada");
    }
    const [results] = await this.localDB.query(query, params);
    return results;
  }

  // Método para reconfigurar la base de datos local
  async reconfigureLocalDB(config) {
    const success = await this.initializeLocalDB(config);
    return success;
  }

  // Método para verificar si la base de datos local está configurada
  isLocalDBConfigured() {
    return this.localDB !== null;
  }
}

// Crear una instancia única del gestor de base de datos
const dbManager = new DatabaseManager();

// Inicializar la conexión inicial
await dbManager.initializeLocalDB();

export default dbManager;