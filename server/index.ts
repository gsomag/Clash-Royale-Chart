import "dotenv/config";
import express, { type Request, type Response } from "express";
import {
  syncHandler,
  candlesHandler,
  statusHandler,
  type ApiReq,
  type ApiRes,
} from "../lib/handlers.js";

// Adapt the framework-agnostic handlers (also used by Vercel functions) to Express.
const wrap =
  (h: (req: ApiReq, res: ApiRes) => Promise<void>) => (req: Request, res: Response) => {
    void h(req as unknown as ApiReq, res as unknown as ApiRes);
  };

const app = express();
app.use(express.json());

app.all("/api/sync", wrap(syncHandler));
app.get("/api/candles", wrap(candlesHandler));
app.get("/api/status", wrap(statusHandler));

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!process.env.CR_API_TOKEN) {
    console.warn("[server] 警告: CR_API_TOKEN が未設定です。.env を作成してください。");
  }
});
