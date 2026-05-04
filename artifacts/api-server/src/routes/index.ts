import { Router, type IRouter } from "express";
import healthRouter from "./health";
import characterRouter from "./character";
import journalEntriesRouter from "./journal-entries";
import storiesRouter from "./stories";
import outfitsRouter from "./outfits";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(characterRouter);
router.use(journalEntriesRouter);
router.use(storiesRouter);
router.use(outfitsRouter);
router.use(uploadRouter);

export default router;
