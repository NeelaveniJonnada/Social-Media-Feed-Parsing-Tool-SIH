// instagram.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');

async function autoScroll(page, scrollLimit = 10) {
  await page.evaluate(async (scrollLimit) => {
    let scrolled = 0;
    await new Promise((resolve) => {
      const distance = 100;
      const delay = 200;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrolled++;
        if (scrolled >= scrollLimit) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  }, scrollLimit);
}

async function takeFullScreenshot(page, filepath) {
  await autoScroll(page, 20);
  await page.screenshot({ path: filepath, fullPage: true });
}

async function runInstagramScraper(username, password) {
  // Directory for captured data
  const screenshotsDir = path.join(__dirname, '../public/captured_data');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const pdfPath = path.join(screenshotsDir, 'instagram_report.pdf');
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(pdfPath));

  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', // Path to Chrome
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // Login
  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[name="username"]', { visible: true });
  await page.type('input[name="username"]', username, { delay: 100 });
  await page.type('input[name="password"]', password, { delay: 100 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Feed
await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
const feedPath = path.join(screenshotsDir, 'feed.png');
await takeFullScreenshot(page, feedPath);

doc.addPage()
   .fontSize(20).text("Instagram Feed", { align: "center" })
   .moveDown()
   .image(feedPath, { fit: [500, 700], align: "center", valign: "center" });

// Profile posts
await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle2' });
const postPath = path.join(screenshotsDir, 'posts.png');
await takeFullScreenshot(page, postPath);

doc.addPage()
   .fontSize(20).text("Profile Posts", { align: "center" })
   .moveDown()
   .image(postPath, { fit: [500, 700], align: "center", valign: "center" });

// Followers
try {
  await page.click(`a[href="/${username}/followers/"]`);
  await page.waitForSelector('div[role="dialog"]', { visible: true });
  const followersPath = path.join(screenshotsDir, 'followers.png');
  await takeFullScreenshot(page, followersPath);

  doc.addPage()
     .fontSize(20).text("Followers", { align: "center" })
     .moveDown()
     .image(followersPath, { fit: [500, 700], align: "center", valign: "center" });

  await page.keyboard.press('Escape');
} catch (err) {
  console.warn('⚠ Followers capture failed:', err.message);
}

// Following
try {
  await page.click(`a[href="/${username}/following/"]`);
  await page.waitForSelector('div[role="dialog"]', { visible: true });
  const followingPath = path.join(screenshotsDir, 'following.png');
  await takeFullScreenshot(page, followingPath);

  doc.addPage()
     .fontSize(20).text("Following", { align: "center" })
     .moveDown()
     .image(followingPath, { fit: [500, 700], align: "center", valign: "center" });

  await page.keyboard.press('Escape');
} catch (err) {
  console.warn('⚠ Following capture failed:', err.message);
}

// Chat List
try {
  await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('main');
  const chatPath = path.join(screenshotsDir, 'chat.png');
  await takeFullScreenshot(page, chatPath);

  doc.addPage()
     .fontSize(20).text("Chat List", { align: "center" })
     .moveDown()
     .image(chatPath, { fit: [500, 700], align: "center", valign: "center" });
} catch (err) {
  console.warn('⚠ Chat list capture failed:', err.message);
}


  // Finalize
  doc.end();
  await browser.close();

// Ensure a "latest" copy for frontend
const latestPath = path.join(screenshotsDir, "instagram_latest.pdf");
try {
  fs.copyFileSync(pdfPath, latestPath);
  console.log("📂 Copied to instagram_latest.pdf");
} catch (err) {
  console.warn("⚠ Could not copy to instagram_latest.pdf:", err.message);
}

console.log('✅ Instagram scraping complete. PDF saved to:', pdfPath);
return latestPath;


}

module.exports = runInstagramScraper;
