// api/bypass.js — final, regex tahan banting
const LOADSTRING_RE =
  /loadstring\s*\(\s*game\s*:\s*Http\s*Get\s*\(\s*["'""'']([^"'""'']+)["'""'']\s*\)\s*\)\s*\(\s*\)/g;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).send("GET only");
  }

  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).send("url required");
  }

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!r.ok) {
      return res.status(502).send("target error: " + r.status);
    }

    const html = await r.text();

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    // coba regex lengkap dulu
    let urls = [...html.matchAll(LOADSTRING_RE)].map((m) => m[1]);

    // fallback 1: cari pola 'game:HttpGet("..."' aja
    if (urls.length === 0) {
      const fallback =
        /game\s*:\s*Http\s*Get\s*\(\s*["'""'']([^"'""'']+)["'""'']\s*\)/g;
      urls = [...html.matchAll(fallback)].map((m) => m[1]);
    }

    // fallback 2: cari URL raw github langsung
    if (urls.length === 0) {
      const raw = /https?:\/\/raw\.githubusercontent\.com\/[^\s"'<>)]+/g;
      urls = [...html.matchAll(raw)].map((m) => m[0]);
    }

    // fallback 3: decode HTML entity dulu, baru regex normal
    if (urls.length === 0) {
      const decoded = html
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
      urls = [...decoded.matchAll(LOADSTRING_RE)].map((m) => m[1]);
    }

    if (urls.length === 0) {
      return res.status(200).send("script ga ketemu");
    }

    const out = urls
      .map((u) => `loadstring(game:HttpGet("${u}"))()`)
      .join("\n\n");

    return res.status(200).send(out);
  } catch (err) {
    return res.status(500).send("error: " + String(err));
  }
};
