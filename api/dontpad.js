export default async function handler(req, res) {
  const key = String(req.query?.key || req.body?.key || 'sistema-escalas-bueno')
    .trim()
    .replace(/^\/+|\/+$/g, '');

  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    Referer: `https://dontpad.com/${key}`,
    Origin: 'https://dontpad.com'
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(`https://api.dontpad.com/${key}.body.json?lastModified=0`, { headers });
      if (!r.ok) {
        return res.status(r.status).json({ ok: false });
      }
      const payload = await r.json();
      if (payload && typeof payload.body === 'string' && payload.body.trim().startsWith('{')) {
        const parsed = JSON.parse(payload.body);
        return res.status(200).json({ ok: true, data: parsed, lastModified: payload.lastModified });
      }
      return res.status(200).json({ ok: false, empty: true });
    }

    if (req.method === 'POST') {
      const dataObj = req.body?.data;
      if (!dataObj) {
        return res.status(400).json({ ok: false, error: 'Missing data' });
      }
      const textStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj, null, 2);
      const bodyParams = new URLSearchParams();
      bodyParams.set('text', textStr);
      bodyParams.set('lastModified', '0');
      bodyParams.set('force', 'true');

      const r = await fetch(`https://api.dontpad.com/${key}`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        body: bodyParams.toString()
      });
      return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
    }

    return res.status(405).json({ ok: false });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
