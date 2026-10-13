// api/bypass.js — versi ringan, tanpa Chromium
const LOADSTRING_RE =
  /loadstring\s*\(\s*game:HttpGet\s*\(\s*["']([^"']+)["']\s*\)\s*\)\s*\(\s*\)/g;

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

    const urls = [...html.matchAll(LOADSTRING_RE)].map((m) => m[1]);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    if (urls.length === 0) {
      return res.status(200).send("script ga ketemu");
    }

    // balikin loadstring lengkap, siap tempel
    const out = urls
      .map((u) => `loadstring(game:HttpGet("${u}"))()`)
      .join("\n\n");

    return res.status(200).send(out);
  } catch (err) {
    return res.status(500).send("error: " + String(err));
  }
};
