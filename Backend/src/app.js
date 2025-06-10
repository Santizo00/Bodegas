import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import routes from "./routes/index.js"; // Importa las rutas

dotenv.config();

const app = express();

app.use(express.json()); 
app.use(cors());
app.use(morgan("dev")); 

app.use("/api", routes);

import { errorHandler } from "./middleware/errorHandler.js";
app.use(errorHandler);


export default app;
