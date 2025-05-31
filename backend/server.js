
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const upload = multer({ dest: "uploads/" });

app.post("/send", upload.single("txtFile"), (req, res) => {
  const { token, uids, message, delay } = req.body;
  if (!token || !uids || !message || !delay) return res.status(400).send("Missing data");

  console.log("Received Token:", token);
  console.log("Target UIDs:", uids);
  console.log("Message:", message);
  console.log("Delay:", delay);
  res.send("Message would be sent (simulated).");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
