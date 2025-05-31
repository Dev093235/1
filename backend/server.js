const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const upload = multer();

app.post('/api/start', upload.single('npFile'), (req, res) => {
  const { password, token, uid, haterName, time } = req.body;
  const npFile = req.file;

  console.log('Form Data:', { password, token, uid, haterName, time });
  console.log('Uploaded file info:', npFile);

  if (!password || !token || !uid || !haterName || !time) {
    return res.status(400).send('Missing required fields');
  }

  res.status(200).send('Form data received successfully!');
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
