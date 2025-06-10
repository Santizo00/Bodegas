import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import testConnection from "./routes/testConnection.js";
import loginRoutes from "./routes/loginRoute.js";
import generalRoutes from "./routes/generalRoutes.js";
import configRouter from "./config/Router.js";

import pedidosRoutes from "./routes/pedidos.js";
import progressRoutes from "./routes/progressRoute.js";
import cronogramRoutes from "./routes/cronogramRoute.js";
import allordersRoutes from "./routes/allordersRoute.js";

import locationRoutes from "./routes/locationRoute.js";
import changesRoutes from "./routes/changesRoute.js";


dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 30000,
  pingTimeout: 60000,
});

const activeClients = new Map();

app.use(express.json());

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rutas
app.use(testConnection);
app.use(configRouter);

app.use("/login", loginRoutes);
app.use("/general", generalRoutes);
app.use("/pedidos", pedidosRoutes);

app.use("/progress", progressRoutes);
app.use("/cronogram", cronogramRoutes);
app.use("/allorders", allordersRoutes);
app.use("/changes", changesRoutes);
app.use("/location", locationRoutes);

io.on("connection", (socket) => {
  activeClients.set(socket.id, socket);

  socket.on("disconnect", (reason) => {
    activeClients.delete(socket.id);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });

  setTimeout(() => {
    if (activeClients.has(socket.id)) {
      socket.disconnect();
      activeClients.delete(socket.id);
    }
  }, 30000);
});

app.use((err, req, res, next) => {
  console.error("Error en el servidor:", err.message);
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    error: err.message,
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});