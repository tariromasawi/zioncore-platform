import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walletRouter from "./wallet";
import billingRouter from "./billing";
import aiInterpretationRouter from "./ai-interpretation";
import aiAudioInterpretationRouter from "./ai-audio-interpretation";
import resonanceAudioRouter from "./resonance-audio";
import resonanceVisualsRouter from "./resonance-visuals";
import ownerRouter from "./owner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletRouter);
router.use(billingRouter);
router.use(aiInterpretationRouter);
router.use(aiAudioInterpretationRouter);
router.use(resonanceAudioRouter);
router.use(resonanceVisualsRouter);
router.use(ownerRouter);

export default router;
