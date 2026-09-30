module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "ASSEMBLYAI_API_KEY is not configured on the server"
    });
  }

  try {
    const upstream = await fetch(
      "https://streaming.assemblyai.com/v3/token?expires_in_seconds=60",
      {
        headers: {
          Authorization: apiKey
        }
      }
    );

    const payload = await upstream.json().catch(() => ({}));
    res.setHeader("Cache-Control", "no-store");

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "AssemblyAI token request failed",
        detail: payload
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "Unable to reach AssemblyAI token service",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
};
