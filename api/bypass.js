// api/bypass.js
const chromium = require("@sparticuz/chromium");
const { chromium: pw } = require("playwright-core");

const CHAIN = ["Like Video 1", "Like Video 2", "Like Video 3", "Subscribe"];
const CONTINUE_LABEL = "Continue to Script";
const LOADSTRING_RE =
  /loadstring\s*\(\s*game:HttpGet\s*\(\s*["']([^"']+)["']\s*\)\s*\)\s*\(\s*\)/g;

const TOTAL_TIMEOUT = 50000; // 50s, aman di bawah limit Vercel

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") return res.status(405).send("GET only");

  const url = req.query.url;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).send("url required");
  }

  const deadline = Date.now() + TOTAL_TIMEOUT;
  const timeLeft = () => deadline - Date.now();

  let browser;
  try {
    const args = [...chromium.args].filter((a) => !a.startsWith("--headless"));

    browser = await pw.launch({
      args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    // kalo browser mati sendiri, batalkan
    browser.on("disconnected", () => {
      console.log("[!] browser disconnected");
    });

    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      locale: "en-US",
      viewport: { width: 412, height: 915 },
    });

    const page = await ctx.newPage();

    // log kalo page nutup sendiri
    page.on("close", () => console.log("[!] page closed"));
    page.on("crash", () => console.log("[!] page crashed"));

    // tutup popup/tab baru otomatis
    ctx.on("page", async (p) => {
      if (p !== page) {
        await p.waitForTimeout(500).catch(() => {});
        await p.close().catch(() => {});
      }
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(30000, timeLeft()),
    });
    await page.waitForTimeout(1200);

    // rantai tombol — defensif
    for (let i = 0; i < CHAIN.length; i++) {
      if (timeLeft() < 5000) {
        console.log("[!] waktu hampir habis, stop rantai");
        break;
      }

      // cek browser masih idup ga
      if (!browser.isConnected()) {
        console.log("[!] browser mati di tengah rantai");
        break;
      }

      const label = CHAIN[i];
      const step = i + 1;

      try {
        const btn = page.locator(`text=${label}`).first();

        const count = await btn.count().catch(() => 0);
        if (count === 0) continue;

        await btn
          .waitFor({ state: "visible", timeout: Math.min(8000, timeLeft()) })
          .catch(() => {});

        // tunggu enabled, max 8 detik
        for (let t = 0; t < 40; t++) {
          if (timeLeft() < 5000) break;
          const disabled = await btn.getAttribute("disabled").catch(() => null);
          const aria = await btn.getAttribute("aria-disabled").catch(() => null);
          const cls = (await btn.getAttribute("class").catch(() => "")) || "";
          if (
            !disabled &&
            aria !== "true" &&
            !cls.toLowerCase().includes("disabled")
          )
            break;
          await page.waitForTimeout(200).catch(() => {});
        }

        await btn.click({ timeout: Math.min(5000, timeLeft()) }).catch(() => {});

        await page
          .waitForFunction(
            (m) => document.body.innerText.includes(m),
            `(${step}/4)`,
            { timeout: Math.min(15000, timeLeft()) }
          )
          .catch(() => {});
      } catch (e) {
        console.log(`[!] step ${step} gagal: ${e.message}`);
      }
    }

    // Continue to Script
    if (timeLeft() > 5000 && browser.isConnected()) {
      try {
        const cont = page.locator(`text=${CONTINUE_LABEL}`).first();
        if ((await cont.count().catch(() => 0)) > 0) {
          await cont
            .waitFor({ state: "visible", timeout: Math.min(8000, timeLeft()) })
            .catch(() => {});
          await cont.click({ timeout: Math.min(5000, timeLeft()) }).catch(() => {});
          await page.waitForTimeout(1200).catch(() => {});
        }
      } catch (e) {
        console.log("[!] continue gagal: " + e.message);
      }
    }

    // ekstrak, tetap coba walau ada error
    let urls = [];
    try {
      const html = await page.content();
      urls = [...html.matchAll(LOADSTRING_RE)].map((m) => m[1]);
    } catch (e) {
      console.log("[!] gagal ambil content: " + e.message);
    }

    if (urls.length === 0) {
      for (const sel of ["textarea", "pre", "code"]) {
        try {
          const els = page.locator(sel);
          const n = await els.count();
          for (let j = 0; j < n; j++) {
            const txt = await els.nth(j).innerText();
            const m = LOADSTRING_RE.exec(txt);
            if (m) urls.push(m[1]);
          }
        } catch (_) {
          // skip
        }
      }
    }

    await browser.close().catch(() => {});

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    if (urls.length === 0) {
      return res.status(200).send("script ga ketemu");
    }

    const out = urls
      .map((u) => `loadstring(game:HttpGet("${u}"))()`)
      .join("\n\n");

    return res.status(200).send(out);
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).send("error: " + String(err));
  }
};
