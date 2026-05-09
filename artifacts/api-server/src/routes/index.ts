import { Router, type IRouter } from "express";
import healthRouter from "./health";
import characterRouter from "./character";
import journalEntriesRouter from "./journal-entries";
import storiesRouter from "./stories";
import outfitsRouter from "./outfits";
import uploadRouter from "./upload";
import socialRouter from "./social";
import notificationsRouter from "./notifications";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(characterRouter);
router.use(journalEntriesRouter);
router.use(storiesRouter);
router.use(outfitsRouter);
router.use(uploadRouter);
router.use(socialRouter);
router.use(notificationsRouter);
router.use(reportsRouter);

export default router;
