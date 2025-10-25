// scrapping/whatsapp.js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

puppeteer.use(StealthPlugin());
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Cookie & output dirs
const COOKIES_PATH = path.join(__dirname, "whatsapp_cookies.json");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "captured_data");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function runWhatsappScraper(label = "default") {
  console.log(`📌 WhatsApp scraper starting (label=${label})`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = (await browser.pages())[0];

  try {
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // load cookies
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
      if (cookies && cookies.length) {
        await page.setCookie(...cookies);
        console.log("🍪 Loaded WhatsApp cookies.");
      }
    }

    await page.goto("https://web.whatsapp.com/", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    // Detect login
    async function isLoggedIn() {
      try {
        const pane = await page.$("#pane-side, [data-testid='chat-list']");
        if (pane) return true;
        const qr = await page.$("canvas[aria-label*='Scan me'], img[alt*='Scan me']");
        if (qr) return false;
        return false;
      } catch {
        return false;
      }
    }

    if (!(await isLoggedIn())) {
      console.log("🔔 Please scan QR with WhatsApp mobile now.");
      const maxWait = 10 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < maxWait) {
        if (await isLoggedIn()) break;
        await delay(2000);
      }
      if (!(await isLoggedIn())) {
        console.error("❌ QR not scanned in time.");
        await browser.close();
        return null;
      }
    }
    console.log("✅ Logged into WhatsApp Web.");

    // save cookies
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));

    await page.waitForSelector("#pane-side, [data-testid='chat-list']", { timeout: 20000 }).catch(() => {});
    await delay(1500);

    // ------------------ Chat List ------------------
    const chatListShot = path.join(OUTPUT_DIR, `whatsapp_chatlist_${Date.now()}.png`);
    await page.screenshot({ path: chatListShot, fullPage: false });
    console.log("📸 Chat list screenshot saved.");

    // ------------------ Normal Chats (Top 10) ------------------
    const normalChatShots = [];
    try {
      const chatEls = await page.$$('[id="pane-side"] div[role="row"], [data-testid="cell-frame-container"]');
      const takeCount = Math.min(10, chatEls.length);
      console.log(`📌 Capturing top ${takeCount} normal chats`);
      for (let i = 0; i < takeCount; i++) {
        await chatEls[i].click();
        await delay(2000);
        const shotPath = path.join(OUTPUT_DIR, `whatsapp_normalchat_${i+1}_${Date.now()}.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        normalChatShots.push(shotPath);
        console.log(`📸 Saved normal chat #${i+1}`);
      }
    } catch (e) {
      console.warn("⚠️ Normal chats capture error:", e.message);
    }

    // ------------------ Helper to capture sections ------------------
    async function captureSection(label, filename) {
      const shot = path.join(OUTPUT_DIR, filename);
      let captured = false;
      try {
        const btn = await page.$(`[aria-label='${label}']`);
        if (btn) {
          await btn.click();
          await delay(2000);
          await page.screenshot({ path: shot, fullPage: false });
          captured = true;
          await page.click("[aria-label='Back']").catch(() => {});
          await delay(1000);
        }
        if (captured) console.log(`📸 ${label} captured.`);
      } catch (e) {
        console.warn(`⚠️ ${label} capture error:`, e.message);
      }
      return captured ? shot : null;
    }

    const archivedShot = await captureSection("Archived", `whatsapp_archived_${Date.now()}.png`);
    const callsShot = await captureSection("Calls", `whatsapp_calls_${Date.now()}.png`);
    // ------------------ Capture Status ------------------
const statusShot = path.join(OUTPUT_DIR, `whatsapp_status_${Date.now()}.png`);
let statusCaptured = false;
try {
  const statusBtn = await page.$("button[aria-label='Status']");
  if (statusBtn) {
    await statusBtn.click();
    await delay(4000); // wait for list to load

    // Screenshot the visible status list panel
    const statusPanel = await page.$("div[aria-label='Status updates']");
    if (statusPanel) {
      await statusPanel.screenshot({ path: statusShot });
      console.log("📸 Status list captured.");
    } else {
      await page.screenshot({ path: statusShot, fullPage: false });
      console.log("📸 Fallback: full page status screenshot.");
    }

    statusCaptured = true;

    // Return back to main chat list
    const chatsBtn = await page.$("button[aria-label='Chats']");
    if (chatsBtn) {
      await chatsBtn.click();
      await delay(2000);
    } else {
      await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" });
    }
  } else {
    console.log("⚠️ Status button not found.");
  }
} catch (e) {
  console.warn("⚠️ Status capture error:", e.message);
}


    // ------------------ Communities ------------------
    const communitiesShot = path.join(OUTPUT_DIR, `whatsapp_communities_${Date.now()}.png`);
    const communityChatShots = [];
    try {
      const commBtn = await page.$("[aria-label='Communities']");
      if (commBtn) {
        await commBtn.click();
        await delay(2000);
        await page.screenshot({ path: communitiesShot, fullPage: false });
        console.log("📸 Communities list screenshot saved.");

        const commChats = await page.$$('[role="row"]');
        const commTake = Math.min(5, commChats.length);
        console.log(`📌 Capturing top ${commTake} community chats`);
        for (let i = 0; i < commTake; i++) {
          await commChats[i].click();
          await delay(2000);
          const shotPath = path.join(OUTPUT_DIR, `whatsapp_communitychat_${i+1}_${Date.now()}.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
          communityChatShots.push(shotPath);
          console.log(`📸 Saved community chat #${i+1}`);
          await page.click("[aria-label='Back']").catch(() => {});
          await delay(1000);
        }
        await page.click("[aria-label='Back']").catch(() => {});
      }
    } catch (e) {
      console.warn("⚠️ Communities capture error:", e.message);
    }

    // ------------------ Build PDF ------------------
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const pdfPath = path.join(OUTPUT_DIR, `whatsapp_report_${timestamp}.pdf`);
    const latestPdf = path.join(OUTPUT_DIR, "whatsapp_latest.pdf");

    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Cover page
    doc.addPage({ size: "A4" });
    doc.fontSize(18).text("WhatsApp Capture Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Label: ${label}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);

    // Sections
    const sections = [
      { title: "Chat List", shot: chatListShot },
      { title: "Archived Chats", shot: archivedShot },
      { title: "Calls", shot: callsShot },
      { title: "Status", shot: statusShot },
      { title: "Communities", shot: communitiesShot },
    ];

    for (const s of sections) {
      doc.addPage();
      doc.fontSize(14).text(s.title, { underline: true });
      doc.moveDown();
      if (s.shot && fs.existsSync(s.shot)) doc.image(s.shot, { fit: [500, 700] });
      else doc.text("(Screenshot not available or capture skipped.)");
    }

    // Normal chats
    for (const n of normalChatShots) {
      doc.addPage();
      doc.fontSize(14).text("Normal Chat - Message View", { underline: true });
      doc.moveDown();
      doc.image(n, { fit: [500, 700] });
    }

    // Community chats
    for (const c of communityChatShots) {
      doc.addPage();
      doc.fontSize(14).text("Community Chat - Message View", { underline: true });
      doc.moveDown();
      doc.image(c, { fit: [500, 700] });
    }

    doc.end();
    await new Promise((res, rej) => {
      stream.on("finish", res);
      stream.on("error", rej);
    });

    fs.copyFileSync(pdfPath, latestPdf);
    console.log("✅ WhatsApp PDF saved:", pdfPath);

    await browser.close();
    return latestPdf;
  } catch (err) {
    console.error("❌ Error in WhatsApp scraper:", err);
    try { await browser.close(); } catch {}
    return null;
  }
}

module.exports = runWhatsappScraper;
