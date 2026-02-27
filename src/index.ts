import express, { Application, Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import routes from "./routes";
import { DbConnect } from "./utils/dbconnect/DbConnect";

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

DbConnect();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});