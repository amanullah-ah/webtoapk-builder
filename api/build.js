// Vercel serverless function: receives the form, commits job files to the
// builder repo and triggers the GitHub Actions workflow.
// Env vars needed: GITHUB_TOKEN, GH_OWNER, GH_REPO  (optional: GH_BRANCH, default "main")
const crypto = require("crypto");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { GITHUB_TOKEN, GH_OWNER, GH_REPO } = process.env;
  const BRANCH = process.env.GH_BRANCH || "main";
  if (!GITHUB_TOKEN || !GH_OWNER || !GH_REPO) {
    return res.status(500).json({ error: "Server not configured (env vars missing)" });
  }

  let b = req.body;
  try { if (typeof b === "string") b = JSON.parse(b); } catch (e) { b = null; }
  if (!b) return res.status(400).json({ error: "Invalid request" });

  const mode = b.mode === "html" ? "html" : "url";
  const url = String(b.url || "").trim();
  const name = String(b.name || "").trim();
  let pkg = String(b.package || "").trim().toLowerCase();
  const version = String(b.version || "1.0.0").trim();
  const icon = String(b.icon || "").replace(/^data:image\/png;base64,/, "");

  let siteFile = null;
  let siteB64 = "";
  if (mode === "html") {
    const fname = String(b.fileName || "").toLowerCase();
    const ext = fname.endsWith(".zip") ? "zip" : (fname.endsWith(".html") || fname.endsWith(".htm")) ? "html" : null;
    if (!ext) return res.status(400).json({ error: "Upload a .html file or a .zip with index.html" });
    siteB64 = String(b.file || "").replace(/\s/g, "");
    if (!siteB64 || siteB64.length > 4100000 || !/^[A-Za-z0-9+/=]+$/.test(siteB64)) {
      return res.status(400).json({ error: "File is invalid or larger than 3MB" });
    }
    if (ext === "zip") {
      const magic = Buffer.from(siteB64.slice(0, 8), "base64");
      if (magic.length < 2 || magic[0] !== 0x50 || magic[1] !== 0x4b) return res.status(400).json({ error: "This is not a valid ZIP file" });
    }
    siteFile = "site." + ext;
  } else if (!/^https?:\/\/[^\s<>"']{3,2000}$/.test(url)) {
    return res.status(400).json({ error: "Invalid website URL" });
  }
  if (name.length < 1 || name.length > 30 || /[\x00-\x1f]/.test(name)) return res.status(400).json({ error: "App name must be 1-30 characters" });
  if (!/^\d+(\.\d+){0,3}$/.test(version)) return res.status(400).json({ error: "Version like 1.0.0" });

  if (!pkg) {
    let slug = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30) || "app";
    if (/^\d/.test(slug)) slug = "app" + slug;
    pkg = "com.aman." + slug;
  }
  if (pkg.length > 100 || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg)) {
    return res.status(400).json({ error: "Invalid package name (example: com.example.app)" });
  }

  if (!icon || icon.length > 400000 || !/^[A-Za-z0-9+/=]+$/.test(icon)) return res.status(400).json({ error: "Invalid icon" });
  const head = Buffer.from(icon.slice(0, 24), "base64");
  if (head.length < 8 || head.compare(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 0, 8, 0, 8) !== 0) {
    return res.status(400).json({ error: "Icon must be a PNG image" });
  }

  const id = crypto.randomBytes(5).toString("hex");
  const api = (path, opts = {}) =>
    fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "aman-web-to-apk",
        "Content-Type": "application/json",
      },
    });

  const put = (file, contentB64) =>
    api(`/contents/jobs/${id}/${file}`, {
      method: "PUT",
      body: JSON.stringify({ message: `job ${id}: ${file}`, content: contentB64, branch: BRANCH }),
    });

  try {
    const cfg = Buffer.from(JSON.stringify(
      mode === "html" ? { mode, siteFile, name, package: pkg, version } : { mode, url, name, package: pkg, version }
    )).toString("base64");
    let r = await put("config.json", cfg);
    if (!r.ok) throw new Error("GitHub config upload failed (" + r.status + ")");
    r = await put("icon.png", icon);
    if (!r.ok) throw new Error("GitHub icon upload failed (" + r.status + ")");
    if (siteFile) {
      r = await put(siteFile, siteB64);
      if (!r.ok) throw new Error("GitHub file upload failed (" + r.status + ")");
    }

    r = await api(`/actions/workflows/build.yml/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: BRANCH, inputs: { id } }),
    });
    if (r.status !== 204) throw new Error("Could not start build (" + r.status + ")");

    return res.status(200).json({ id, package: pkg });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Build request failed" });
  }
};
