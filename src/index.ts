import express, { Application, Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import routes from "./routes";
import { DbConnect } from "./config/dbconnect/DbConnect";

const app: Application = express();

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.use("/api/v1", routes);

app.use("/*path", (req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

let isConnected = false;
export const connectToDb = async () => {
  if (!isConnected) {
    await DbConnect();
    isConnected = true;
  }
};

// Only start the server if we are running this file directly (not as a module)
// RUN_LOCAL is set to true for local development
if (process.env.RUN_LOCAL === "true" || process.env.NODE_ENV !== "production") {
  connectToDb().then(() => {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  });
}

export { app };