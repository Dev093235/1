const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Handle form submission from frontend
app.post('/api/start', (req, res) => {
  const { password, token, uid, message, time } = req.body;

  console.log('Form Data:', { password, token, uid, message, time });

  // You can do your processing here
  res.status(200).send('Form data received successfully!');
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
