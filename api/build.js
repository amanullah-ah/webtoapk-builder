// Vercel serverless function: receives the form, commits job files to the
// builder repo and triggers the GitHub Actions workflow.
// Env vars needed: GITHUB_TOKEN, GH_OWNER, GH_REPO  (optional: GH_BRANCH, default "main")
const crypto = require("crypto");

// ---------- Rate limiting ----------
// Optional env vars (all have safe defaults):
//   RATE_IP_MAX (3)          builds allowed per visitor ...
//   RATE_IP_WINDOW_MIN (10)  ... within this many minutes
//   RATE_GLOBAL_HOUR (10)    builds allowed for the whole site per hour
//   RATE_GLOBAL_DAY (40)     builds allowed for the whole site per day
const num = (v, d) => { const n = parseInt(v, 10); return n > 0 ? n : d; };
const IP_MAX = num(process.env.RATE_IP_MAX, 3);
const IP_WINDOW_MS = num(process.env.RATE_IP_WINDOW_MIN, 10) * 60 * 1000;
const GLOBAL_HOUR = num(process.env.RATE_GLOBAL_HOUR, 10);
const GLOBAL_DAY = num(process.env.RATE_GLOBAL_DAY, 40);

// Per-visitor memory. Lives while the serverless instance is warm (best effort);
// the global limit below is the hard ceiling that always applies.
const hits = new Map();
const clientIp = (req) =>
  String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "unknown")
    .split(",")[0].trim();
function ipWait(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.set(ip, arr);
  return arr.length >= IP_MAX ? Math.ceil((IP_WINDOW_MS - (now - arr[0])) / 1000) : 0;
}
function ipRecord(ip) {
  const now = Date.now();
  const arr = hits.get(ip) || [];
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] >= IP_WINDOW_MS) hits.delete(k);
  }
}
const tooMany = (res, seconds, what) => {
  const wait = Math.max(1, seconds);
  res.setHeader("Retry-After", String(wait));
  const mins = Math.ceil(wait / 60);
  return res.status(429).json({
    error: `${what} Please try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
  });
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Retry-After");
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
    pkg = "com.amanullah." + slug;
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

  // How many builds the whole site started in the last `ms` (asked from GitHub, so it survives restarts)
  async function runsSince(ms) {
    const iso = new Date(Date.now() - ms).toISOString().replace(/\.\d+Z$/, "Z");
    try {
      const r = await api(`/actions/workflows/build.yml/runs?per_page=1&created=${encodeURIComponent(">=" + iso)}`);
      if (!r.ok) return null;
      const j = await r.json();
      return typeof j.total_count === "number" ? j.total_count : null;
    } catch (e) { return null; }
  }

  const ip = clientIp(req);
  const wait = ipWait(ip);
  if (wait > 0) return tooMany(res, wait, `You started ${IP_MAX} builds in a short time.`);
  const [lastHour, lastDay] = await Promise.all([runsSince(60 * 60 * 1000), runsSince(24 * 60 * 60 * 1000)]);
  if (lastHour !== null && lastHour >= GLOBAL_HOUR) return tooMany(res, 10 * 60, "The builder is busy right now.");
  if (lastDay !== null && lastDay >= GLOBAL_DAY) return tooMany(res, 60 * 60, "Today's build limit is reached.");
  ipRecord(ip);

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
