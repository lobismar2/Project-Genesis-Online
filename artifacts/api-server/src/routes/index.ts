import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coopRouter from "./coop";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(coopRouter);

export default router;
