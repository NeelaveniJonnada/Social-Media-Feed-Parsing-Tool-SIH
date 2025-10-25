// scrapping/twitter.js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const COOKIES_PATH = path.join(__dirname, "twitter_cookies.json");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "captured_data");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function runTwitterScraper(username, password) {
  console.log(`📌 Twitter scraper starting for ${username}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = (await browser.pages())[0];

  try {
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

    // Load cookies if available
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
      await page.setCookie(...cookies);
      console.log("🍪 Loaded Twitter cookies.");
    }

    // Navigate to Twitter login
    await page.goto("https://twitter.com/login", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    // Detect login
    const loggedIn = async () =>
      await page.$('a[aria-label="Profile"], [data-testid="AppTabBar_Home_Link"]');

    if (!(await loggedIn())) {
      console.log("🔑 Logging in with credentials…");

      await page.waitForSelector('input[name="text"]', { timeout: 60000 });
      await page.type('input[name="text"]', username, { delay: 100 });
      await page.keyboard.press("Enter");
      await delay(2000);

      // Password
      await page.waitForSelector('input[name="password"]', { timeout: 60000 });
      await page.type('input[name="password"]', password, { delay: 100 });
      await page.keyboard.press("Enter");

      // Wait for successful login
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 });
    }

    if (!(await loggedIn())) {
      console.error("❌ Login failed.");
      await browser.close();
      return null;
    }

    console.log("✅ Logged in to Twitter.");

    // Save cookies
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));

    const shots = [];

    // ---------------- Home Timeline ----------------
    const timelineShot = path.join(OUTPUT_DIR, `twitter_timeline_${Date.now()}.png`);
    try {
      await page.goto("https://twitter.com/home", { waitUntil: "networkidle2" });
      await delay(3000);
      await page.screenshot({ path: timelineShot, fullPage: true });
      shots.push({ title: "Home Timeline", path: timelineShot });
      console.log("📸 Captured timeline.");
    } catch (e) {
      console.warn("⚠️ Timeline capture failed:", e.message);
    }

    // ---------------- Profile ----------------
    const profileShot = path.join(OUTPUT_DIR, `twitter_profile_${Date.now()}.png`);
    try {
      await page.goto("https://twitter.com/home", { waitUntil: "networkidle2" });
      await page.waitForSelector('a[aria-label="Profile"]', { timeout: 30000 });
      await page.click('a[aria-label="Profile"]');
      await delay(4000);
      await page.screenshot({ path: profileShot, fullPage: true });
      shots.push({ title: "Profile Page", path: profileShot });
      console.log("📸 Captured profile.");
    } catch (e) {
      console.warn("⚠️ Profile capture failed:", e.message);
    }

    // ---------------- Followers ----------------
    const followersShot = path.join(OUTPUT_DIR, `twitter_followers_${Date.now()}.png`);
    try {
      await page.goto(`https://twitter.com/${username}/followers`, { waitUntil: "networkidle2" });
      await delay(4000);
      await page.screenshot({ path: followersShot, fullPage: true });
      shots.push({ title: "Followers List", path: followersShot });
      console.log("📸 Captured followers.");
    } catch (e) {
      console.warn("⚠️ Followers capture failed:", e.message);
    }

    // ---------------- Following ----------------
    const followingShot = path.join(OUTPUT_DIR, `twitter_following_${Date.now()}.png`);
    try {
      await page.goto(`https://twitter.com/${username}/following`, { waitUntil: "networkidle2" });
      await delay(4000);
      await page.screenshot({ path: followingShot, fullPage: true });
      shots.push({ title: "Following List", path: followingShot });
      console.log("📸 Captured following.");
    } catch (e) {
      console.warn("⚠️ Following capture failed:", e.message);
    }

    // ---------------- Messages ----------------
    const dmShot = path.join(OUTPUT_DIR, `twitter_dms_${Date.now()}.png`);
    try {
      await page.goto("https://twitter.com/messages", { waitUntil: "networkidle2" });
      await delay(5000);
      await page.screenshot({ path: dmShot, fullPage: true });
      shots.push({ title: "Direct Messages", path: dmShot });
      console.log("📸 Captured DMs.");
    } catch (e) {
      console.warn("⚠️ DM capture failed:", e.message);
    }

    // ---------------- Generate PDF ----------------
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfPath = path.join(OUTPUT_DIR, `twitter_report_${timestamp}.pdf`);
    const latestPdf = path.join(OUTPUT_DIR, "twitter_latest.pdf");

    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    doc.addPage().fontSize(18).text("Twitter Capture Report", { align: "center" });
    doc.moveDown().fontSize(12).text(`Captured account: ${username}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    for (const s of shots) {
      doc.addPage();
      doc.fontSize(14).text(s.title, { underline: true });
      doc.moveDown();
      if (fs.existsSync(s.path)) {
        doc.image(s.path, { fit: [500, 700], align: "center" });
      } else {
        doc.text("(Screenshot missing)");
      }
    }

    doc.end();
    await new Promise((res) => stream.on("finish", res));
    fs.copyFileSync(pdfPath, latestPdf);

    console.log("✅ Twitter PDF saved:", pdfPath);

    await browser.close();
    return latestPdf;
  } catch (err) {
    console.error("❌ Error in Twitter scraper:", err.message);
    await browser.close();
    return null;
  }
}

module.exports = runTwitterScraper;
