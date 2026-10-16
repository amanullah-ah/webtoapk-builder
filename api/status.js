// GET /api/status?id=XXXXXXXXXX -> { state: "building" | "done" | "failed", url? }
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  const { GITHUB_TOKEN, GH_OWNER, GH_REPO } = process.env;
  const id = String((req.query && req.query.id) || "");
  if (!/^[a-f0-9]{10}$/.test(id)) return res.status(400).json({ error: "Bad id" });
  if (!GITHUB_TOKEN || !GH_OWNER || !GH_REPO) return res.status(500).json({ error: "Server not configured" });

  try {
    const r = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/tags/job-${id}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "aman-web-to-apk",
      },
    });
    if (r.status === 404) return res.status(200).json({ state: "building" });
    if (!r.ok) return res.status(200).json({ state: "building" });
    const rel = await r.json();
    const asset = (rel.assets || [])[0];
    if (asset && asset.browser_download_url) return res.status(200).json({ state: "done", url: asset.browser_download_url });
    return res.status(200).json({ state: "failed", logs: `https://github.com/${GH_OWNER}/${GH_REPO}/actions` });
  } catch (e) {
    return res.status(200).json({ state: "building" });
  }
};
