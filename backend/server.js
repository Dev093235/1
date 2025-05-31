const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Static files from frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
