import { Router } from "express";
import { ok } from "../utils/http.js";
import { pool } from "../db/pool.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    return ok(res, { service: "up", database: "up" }, "Health check passed");
  } catch (error) {
    return next(error);
  }
});

export default router;
