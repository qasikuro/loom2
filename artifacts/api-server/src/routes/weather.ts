import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/weather", requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Missing q param' });
  }
  try {
    const url = `https://wttr.in/${encodeURIComponent(q)}?format=j1`;
    const r   = await fetch(url, { headers: { 'User-Agent': 'SkyJournal/1.0' } });
    if (!r.ok) return res.status(502).json({ error: 'Weather unavailable' });
    const json: any = await r.json();
    const cc        = json.current_condition?.[0];
    if (!cc) return res.status(502).json({ error: 'No data' });
    return res.json({
      tempC:         parseInt(cc.temp_C, 10),
      conditionCode: parseInt(cc.weatherCode, 10),
      conditionText: cc.weatherDesc?.[0]?.value ?? '',
    });
  } catch (err) {
    req.log.error({ err }, "Weather proxy failed");
    return res.status(502).json({ error: 'Weather unavailable' });
  }
});

export default router;
