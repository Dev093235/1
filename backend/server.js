const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'np.txt');
  }
});
const upload = multer({ storage });

app.post('/start', upload.single('npfile'), (req, res) => {
  const { password, tokenOption, token, inboxUid, haterName, interval } = req.body;

  if (password !== 'Rudra') {
    return res.status(401).send('Incorrect password!');
  }

  const npText = fs.readFileSync(req.file.path, 'utf8').split('\n').filter(Boolean);

  res.send(`Started conversation automation with ${npText.length} lines using UID ${inboxUid} and token option ${tokenOption}`);
});

// ✅ Add this route to fix "Cannot GET /"
app.get("/", (req, res) => {
  res.send("🚀 Rudra Multi Convo Backend is Running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
