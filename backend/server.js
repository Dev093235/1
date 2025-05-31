const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({ dest: "uploads/" });

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
    messages = fileContent.split("\n").map(msg => msg.trim()).filter(Boolean);
  } catch (error) {
    return res.status(500).send("❌ Error reading np.txt file");
  }

  const sendMessage = async (msg) => {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/me/messages`,
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
      console.error("❌ Error sending:", msg, error?.response?.data || error.message);
    }
  };

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

app.listen(PORT, () => {
  console.log(`✅ Rudra Multi Convo Server running at: http://localhost:${PORT}`);
});
