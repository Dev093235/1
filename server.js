const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('frontend'));

app.post('/send-messages', async (req, res) => {
  const { token, message, uids, interval } = req.body;
  if (!token || !message || !uids || !Array.isArray(uids)) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  let count = 0;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  for (const uid of uids) {
    try {
      await fetch(`https://graph.facebook.com/me/messages?access_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: uid },
          message: { text: message }
        })
      });
      count++;
      console.log(`✅ Message sent to ${uid}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${uid}:`, err);
    }
    await delay(interval * 1000);
  }

  res.json({ message: `✅ Finished sending to ${count} UIDs.` });
});

app.listen(PORT, () => console.log(`🚀 Rudra Multi Convo server running on http://localhost:${PORT}`));
