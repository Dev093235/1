const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const login = require("fca-unofficial");
const app = express();
const PORT = 10000;

// File upload setup
const upload = multer({ dest: "uploads/" });

app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/send", upload.single("npFile"), async (req, res) => {
  const { password, appstate, uid, time, haterName } = req.body;

  if (password !== "RUDRA") return res.status(401).send("❌ Invalid password");

  if (!req.file || !appstate || !uid || !time) {
    return res.status(400).send("❌ Missing form data");
  }

  const filePath = path.join(__dirname, req.file.path);
  let messages;

  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    messages = fileContent.split("\n").map(msg => msg.trim()).filter(Boolean);
  } catch {
    return res.status(500).send("❌ Error reading message file");
  }

  let appStateParsed;
  try {
    appStateParsed = JSON.parse(appstate);
  } catch {
    return res.status(400).send("❌ Invalid appstate.json format");
  }

  login({ appState: appStateParsed }, (err, api) => {
    if (err) return res.status(500).send("❌ Login failed: " + err.error || err);

    let index = 0;
    const interval = setInterval(() => {
      if (index >= messages.length) {
        clearInterval(interval);
        console.log("✅ All messages sent.");
        return;
      }

      let msg = messages[index];
      if (haterName) msg = msg.replace("{name}", haterName);

      api.sendMessage(msg, uid, (err) => {
        if (err) console.log("❌ Failed to send:", msg, err);
        else console.log("✅ Sent:", msg);
      });

      index++;
    }, parseInt(time) * 1000);
  });

  res.send("✅ Message sending started!");
});

app.listen(PORT, () => {
  console.log(`✅ Server running: http://localhost:${PORT}`);
});
