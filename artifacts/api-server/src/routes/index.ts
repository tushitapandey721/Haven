import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sentinelRouter from "./sentinel";
import authRouter from "./auth";
import { journalRouter } from "./journal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/journal", journalRouter);
router.use(sentinelRouter);

export default router;
