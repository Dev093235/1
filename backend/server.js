const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = 10000;

// Multer setup for file upload
const upload = multer({ dest: "uploads/" });

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/send", upload.single("npFile"), async (req, res) => {
  const { password, token, uid, time, haterName } = req.body;

  if (password !== "RUDRA") {
    return res.status(401).send("❌ Invalid password");
  }

  if (!req.file || !token || !uid || !time) {
    return res.status(400).send("❌ Missing form data");
  }

  const filePath = path.join(__dirname, req.file.path);
  let messages;

  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    messages = fileContent.split("\n").filter(Boolean);
  } catch (error) {
    return res.status(500).send("❌ Error reading file");
  }

  // Function to send message
  const sendMessage = async (msg) => {
    try {
      const url = `https://graph.facebook.com/${uid}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_type: "RESPONSE",
          recipient: { id: uid },
          message: { text: msg }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      console.log("✅ Sent:", msg);
    } catch (error) {
      console.error("❌ Error sending:", msg);
    }
  };

  // Send messages with interval
  let index = 0;
  const interval = setInterval(() => {
    if (index >= messages.length) {
      clearInterval(interval);
      console.log("✅ All messages sent.");
      return;
    }

    let msg = messages[index];
    if (haterName) msg = msg.replace("{name}", haterName);
    sendMessage(msg);
    index++;
  }, parseInt(time) * 1000);

  res.send("✅ Message sending started!");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
