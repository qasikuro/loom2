import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { deleteAccountData, queueAccountDeletionCleanup } from "../services/accountDeletion";
import { emitSSEEvent } from "../lib/sseEmitter";

const router: IRouter = Router();

router.delete("/account", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const conversationPartners = await deleteAccountData(userId);
    for (const partnerId of conversationPartners) {
      emitSSEEvent(`messages:${partnerId}`, {
        type: "partner_account_deleted",
        partnerId: userId,
      });
    }
    queueAccountDeletionCleanup(userId);
    return res.status(202).json({ deleted: true, status: "processing" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete account");
    return res.status(500).json({ error: "Account deletion could not be started. Please try again." });
  }
});

export default router;
