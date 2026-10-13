// api/bypass.js — debug mode
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

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
      },
      redirect: "follow",
    });

    const html = await r.text();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    // cari semua kemunculan 'loadstring'
    const idx = html.indexOf("loadstring");

    if (idx === -1) {
      return res.send(
        "=== HTML MENTAH GA ADA 'loadstring' ===\n" +
        "Panjang HTML: " + html.length + "\n" +
        "Status fetch: " + r.status + "\n\n" +
        "=== 500 karakter pertama ===\n" +
        html.slice(0, 500)
      );
    }

    // kalau ada, ambil sekitarnya biar keliatan format aslinya
    return res.send(
      "=== KETEMU 'loadstring' di index " + idx + " ===\n\n" +
      "=== 400 karakter sebelum ===\n" +
      html.slice(Math.max(0, idx - 200), idx) + "\n\n" +
      "=== 800 karakter dari 'loadstring' ===\n" +
      html.slice(idx, idx + 800)
    );
  } catch (err) {
    return res.status(500).send("error: " + String(err));
  }
};
