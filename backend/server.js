const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Multer setup for file upload
const upload = multer({ dest: 'uploads/' });

// Middleware to parse urlencoded form data
app.use(express.urlencoded({ extended: true }));

// Serve frontend files (index.html, style.css) from 'frontend' folder if needed
app.use(express.static(path.join(__dirname, 'frontend')));

// Dummy FB send message function (replace with your real FB API call)
async function sendFbMessage(token, uid, message) {
  console.log(`Sending message to UID: ${uid} with token: ${token}`);
  console.log('Message:', message);
  // Yahan apna FB send request likh sakte ho
  // Example: await axios.post(fb_api_url, { ... })
  // Simulate delay
  await new Promise(r => setTimeout(r, 500));
}

// POST route to start multi convo
app.post('/api/start', upload.single('npFile'), async (req, res) => {
  try {
    const { password, token, uid, time, haterName } = req.body;

    // Simple password check (replace with your own logic)
    if (password !== 'RUDRA') {
      return res.status(401).send('Invalid password');
    }

    // Check required fields
    if (!uid || !time) {
      return res.status(400).send('UID and Time are required');
    }

    // Read uploaded NP file
    if (!req.file) {
      return res.status(400).send('NP file is required');
    }

    const filePath = req.file.path;
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const messages = fileContent.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (messages.length === 0) {
      return res.status(400).send('NP file is empty');
    }

    // Send messages one by one with interval
    const interval = parseInt(time, 10) * 1000;

    (async function sendMessages() {
      for (const msg of messages) {
        await sendFbMessage(token, uid, msg);
        console.log(`Sent: ${msg}`);
        await new Promise(r => setTimeout(r, interval));
      }
      console.log('All messages sent!');
    })();

    res.send('Message sending started. Check server logs for progress.');

    // Delete uploaded file after processing if you want
    // await fs.unlink(filePath);

  } catch (err) {
    console.error('Error in /api/start:', err);
    res.status(500).send('Server error');
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
