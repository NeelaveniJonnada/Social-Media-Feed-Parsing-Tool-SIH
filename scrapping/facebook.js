// scrapping/facebook.js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

puppeteer.use(StealthPlugin());
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const USER_DATA_DIR = "C:\Users\UMA SANKAR\AppData\Local\Google\Chrome\User Data\Profile 8";

async function scrollPage(page, scrollTimes = 5) {
  for (let i = 0; i < scrollTimes; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(2000);
  }
}

async function safeScreenshot(page, url, filename, waitSelector) {
  const dir = path.join(__dirname, "..", "public", "captured_data");
  const filepath = path.join(dir, filename);
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector(waitSelector, { timeout: 15000 });
    await scrollPage(page, 3);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Captured: ${filename}`);
    return filepath;
  } catch (err) {
    console.warn(`⚠️ Screenshot failed for ${filename}: ${err.message}`);
    return null;
  }
}

async function runFacebookScraper(loginUser, loginPass) {
  console.log(`📌 Facebook scraper starting for login: ${loginUser}`);

  const outDir = path.join(__dirname, "..", "public", "captured_data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--start-maximized",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      `--user-data-dir=${USER_DATA_DIR}`
    ],
  });

  const page = (await browser.pages())[0];

  try {
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 60000 });

    // Check login
    const emailField = await page.$("input[name='email']");
    if (emailField) {
      console.log("🔐 Not logged in — logging in...");
      await page.type("input[name='email']", loginUser, { delay: 70 });
      await page.type("input[name='pass']", loginPass, { delay: 70 });
      await page.click("button[name='login']");
      console.log("⏳ Waiting for login (handle CAPTCHA manually if shown)...");
      await delay(20000);
    } else {
      console.log("✅ Already logged in (session active).");
    }

    if (page.url().includes("login") || page.url().includes("checkpoint")) {
      console.log("❌ Login failed or CAPTCHA not completed.");
      await browser.close();
      return null;
    }

    // 1️⃣ Profile Info
    const profileShot = await safeScreenshot(page, "https://www.facebook.com/me", "facebook_profile.png", "[role='main']");
    const profileInfo = await page.evaluate(() => {
      const info = {};
      info.name = document.querySelector("h1")?.innerText || "Unknown";
      info.bio = document.querySelector("[data-testid='profile_intro_card']")?.innerText || "No bio available";
      return info;
    });

    // 2️⃣ Posts Feed
    const feedShot = await safeScreenshot(page, "https://www.facebook.com/", "facebook_feed.png", "div[role='feed']");
    const posts = await page.evaluate(() => {
      const list = [];
      document.querySelectorAll("div[role='article']").forEach((p) => {
        const txt = p.innerText?.trim();
        if (txt && txt.length > 60) list.push(txt);
      });
      return list.slice(0, 5);
    });

    // 3️⃣ Friends
    const friendsShot = await safeScreenshot(page, "https://www.facebook.com/me/friends", "facebook_friends.png", "a[role='link']");
    const friends = await page.evaluate(() => {
      const list = [];
      document.querySelectorAll("a[role='link'] span").forEach((el) => {
        const txt = el.innerText?.trim();
        if (txt && txt.length > 2) list.push(txt);
      });
      return [...new Set(list)].slice(0, 15);
    });

    // 4️⃣ Followers
    const followersShot = await safeScreenshot(page, "https://www.facebook.com/me/followers", "facebook_followers.png", "a[role='link']");
    const followers = await page.evaluate(() => {
      const list = [];
      document.querySelectorAll("a[role='link'] span").forEach((el) => {
        const txt = el.innerText?.trim();
        if (txt && txt.length > 2) list.push(txt);
      });
      return [...new Set(list)].slice(0, 15);
    });

    // 5️⃣ Messages
    const messagesShot = await safeScreenshot(page, "https://www.facebook.com/messages", "facebook_messages.png", "ul[role='list']");
    const messages = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("ul[role='list'] li").forEach((li) => {
        const txt = li.innerText?.trim();
        if (txt && txt.length > 25) out.push(txt);
      });
      return out.slice(0, 10);
    });

    // 6️⃣ Generate PDF
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfPath = path.join(outDir, `facebook_report_${timestamp}.pdf`);
    const latestPdf = path.join(outDir, "facebook_latest.pdf");

    const doc = new PDFDocument({ autoFirstPage: false });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    const addSection = (title, data, imagePath) => {
      doc.addPage();
      doc.fontSize(18).text(title, { underline: true });
      doc.moveDown();
      if (Array.isArray(data) && data.length)
        data.forEach((item, i) => doc.fontSize(11).text(`${i + 1}. ${item}`));
      else if (data && typeof data === "object")
        Object.entries(data).forEach(([k, v]) => doc.fontSize(11).text(`${k}: ${v}`));
      else doc.fontSize(11).text("No textual data found.");
      doc.moveDown();
      if (imagePath && fs.existsSync(imagePath)) doc.image(imagePath, { fit: [500, 700], align: "center" });
    };

    doc.addPage().fontSize(22).text(" Facebook Data Capture Report", { align: "center" });
    doc.moveDown().fontSize(13).text(`Account: ${loginUser}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    addSection("Profile Info", profileInfo, profileShot);
    addSection("Recent Posts", posts, feedShot);
    addSection("Friends", friends, friendsShot);
    addSection("Followers", followers, followersShot);
    addSection("Messages", messages, messagesShot);

    doc.end();
    await new Promise((res) => writeStream.on("finish", res));
    fs.copyFileSync(pdfPath, latestPdf);

    console.log(`✅ Facebook report saved → ${pdfPath}`);
    await browser.close();
    return latestPdf;

  } catch (err) {
    console.error("❌ Facebook scraper error:", err.message);
    await browser.close();
    return null;
  }
}

module.exports = runFacebookScraper;
