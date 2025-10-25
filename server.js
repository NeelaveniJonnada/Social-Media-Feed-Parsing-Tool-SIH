// server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const runInstagramScraper = require('./scrapping/instagram'); // import your scraper
const runTwitterScraper = require("./scrapping/twitter");
const runFacebookScraper = require('./scrapping/facebook'); 
const runWhatsappScraper = require('./scrapping/whatsapp');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Serve static files (HTML, CSS, JS, images, captured_data folder)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index1.html'));
});

// Capture Instagram data route
app.post('/capture-instagram', async (req, res) => {
    const { username, password } = req.body;

    console.log(`📌 Received Instagram capture request for: ${username}`);

    try {
        const filePath = await runInstagramScraper(username, password); 
        if (filePath) {
            console.log("✅ Instagram capture complete");
            res.json({ status: "success", file: "/captured_data/instagram_latest.pdf" });
        } else {
            console.log("❌ Instagram capture failed - no PDF generated");
            res.json({ status: "fail" });
        }
    } catch (err) {
        console.error("❌ Instagram capture failed:", err.message);
        res.json({ status: "fail" });
    }
});



// Twitter username/password flow
app.post("/capture-twitter", async (req, res) => {
  const { username, password } = req.body;
  console.log(`📌 Twitter request for: ${username}`);

  try {
    const filePath = await runTwitterScraper(username, password);
    if (filePath) {
      res.json({ status: "success", file: `/captured_data/twitter_latest.pdf` });
    } else {
      res.json({ status: "failed" });
    }
  } catch (err) {
    console.error("❌ Twitter scraper error:", err.message);
    res.json({ status: "failed", error: err.message });
  }
});

// Capture Facebook data route
app.post('/capture-facebook', async (req, res) => {
    const { username, password } = req.body;

    console.log(`📌 Received Facebook capture request for: ${username}`);

    try {
        const filePath = await runFacebookScraper(username, password);
        if (filePath) {
            console.log("✅ Facebook capture complete");
            // Always return JSON
            res.json({ status: "success", file: "/captured_data/facebook_latest.pdf" });
        } else {
            console.log("❌ Facebook capture failed - no PDF generated");
            res.json({ status: "fail" });
        }
    } catch (err) {
        console.error("❌ Facebook capture error:", err.message);
        res.json({ status: "fail" });
    }
});





// At top: const runWhatsappScraper = require('./scrapping/whatsapp');

app.post('/capture-whatsapp', async (req, res) => {
  const { label } = req.body; // label is optional (for naming)
  console.log(`📌 Received WhatsApp capture request for: ${label || 'default'}`);

  try {
    const pdfPath = await runWhatsappScraper(label || 'default');
    if (pdfPath && fs.existsSync(pdfPath)) {
      // respond success so frontend enables buttons and can open /captured_data/whatsapp_latest.pdf
      res.json({ status: 'success', file: '/captured_data/whatsapp_latest.pdf' });
    } else {
      res.status(500).json({ status: 'fail' });
    }
  } catch (err) {
    console.error("❌ WhatsApp capture error:", err.message);
    res.status(500).json({ status: 'fail' });
  }
});




// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});