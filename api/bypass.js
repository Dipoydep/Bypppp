// api/bypass.js
const chromium = require("@sparticuz/chromium");
const { chromium: pw } = require("playwright-core");

const CHAIN = ["Like Video 1", "Like Video 2", "Like Video 3", "Subscribe"];
const CONTINUE_LABEL = "Continue to Script";
const LOADSTRING_RE =
  /loadstring\s*\(\s*game:HttpGet\s*\(\s*["']([^"']+)["']\s*\)\s*\)\s*\(\s*\)/g;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  const url = req.query.url;

  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({
      error: "url required",
      usage: "/api/bypass?url=https://scriptpastebins.com/xxx/",
    });
  }

  let browser;
  try {
    const args = [...chromium.args].filter((a) => !a.startsWith("--headless"));

    browser = await pw.launch({
      args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      locale: "en-US",
      viewport: { width: 412, height: 915 },
    });

    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);

    for (let i = 0; i < CHAIN.length; i++) {
      const label = CHAIN[i];
      const step = i + 1;
      const btn = page.locator(`text=${label}`).first();

      if ((await btn.count()) === 0) continue;

      await btn.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

      for (let t = 0; t < 50; t++) {
        const disabled = await btn.getAttribute("disabled");
        const aria = await btn.getAttribute("aria-disabled");
        const cls = (await btn.getAttribute("class")) || "";
        if (!disabled && aria !== "true" && !cls.toLowerCase().includes("disabled"))
          break;
        await page.waitForTimeout(200);
      }

      await btn.click({ timeout: 5000 }).catch(() => {});

      await page
        .waitForFunction(
          (m) => document.body.innerText.includes(m),
          `(${step}/4)`,
          { timeout: 15000 }
        )
        .catch(() => {});
    }

    const cont = page.locator(`text=${CONTINUE_LABEL}`).first();
    if ((await cont.count()) > 0) {
      await cont.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      await cont.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1200);
    }

    const html = await page.content();
    const hits = [...html.matchAll(LOADSTRING_RE)].map((m) => m[1]);

    if (hits.length === 0) {
      for (const sel of ["textarea", "pre", "code"]) {
        const els = page.locator(sel);
        const n = await els.count();
        for (let j = 0; j < n; j++) {
          const txt = await els.nth(j).innerText();
          const m = LOADSTRING_RE.exec(txt);
          if (m) hits.push(m[1]);
        }
      }
    }

    await browser.close();

    if (hits.length === 0) {
      return res.status(200).json({ ok: false, message: "script ga ketemu" });
    }

    return res.status(200).json({ ok: true, scripts: hits });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ ok: false, error: String(err) });
  }
};
