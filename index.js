const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const login = require('facebook-chat-api'); // CHANGED: Using original facebook-chat-api

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ dest: 'uploads/' });

let fbApi = null;
let botRunning = false;
let npReplies = []; // To store an array of replies (for plain text NP file)
let listeningThreadIds = new Set();
let botConfig = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/start-bot', upload.single('npFile'), async (req, res) => {
    if (botRunning) {
        return res.status(400).json({ error: 'Bot is already running. Please stop it first if you want to restart.' });
    }

    // RENAMED: appStateJson to accessToken based on UI
    const { accessToken, phoneNumber, rudraName, someNumber } = req.body; // CHANGED: Variable name
    const npFile = req.file;

    botConfig = {
        accessToken: accessToken, // CHANGED: Using accessToken
        inboxConvoUid: phoneNumber || '',
        haterName: rudraName,
        timeSeconds: someNumber,
        npFilePath: npFile ? npFile.path : null,
        npFileOriginalName: npFile ? npFile.originalname : null
    };

    if (!botConfig.accessToken || !npFile) { // CHANGED: Check accessToken
        return res.status(400).json({ error: 'Missing required fields: Facebook Access Token or NP File.' });
    }

    console.log('Received bot start request with config:', botConfig);

    try {
        const fileContent = fs.readFileSync(npFile.path, 'utf8');
        npReplies = fileContent.split(/\r?\n/).filter(line => line.trim() !== ''); // Split by new line and remove empty lines
        console.log('NP File Content Loaded as lines:', npReplies.length, 'replies found.');
    } catch (error) {
        console.error('Error reading NP file:', error);
        return res.status(500).json({ error: 'Failed to read NP file.' });
    } finally {
        fs.unlink(npFile.path, (err) => {
            if (err) console.error("Error deleting uploaded file:", err);
        });
    }

    // This login method uses accessToken directly
    login({ accessToken: botConfig.accessToken }, (err, api) => { // CHANGED: login with accessToken
        if (err) {
            console.error("FCA Login Error:", err);
            // Handle common token-related errors
            if (err.error) {
                if (err.error.includes("invalid token") || err.error.includes("Invalid access token")) {
                    return res.status(401).json({ error: 'Login failed: Invalid Facebook Access Token. Get a new one.' });
                }
                if (err.error.includes("expired token")) {
                     return res.status(401).json({ error: 'Login failed: Expired Facebook Access Token. Get a new one.' });
                }
            }
            return res.status(500).json({ error: `FCA Login Failed: ${err.message || JSON.stringify(err)}` });
        }

        fbApi = api;
        botRunning = true;
        listeningThreadIds.clear();
        console.log(`Successfully logged in to Facebook Messenger with FCA (Token Login) for ID: ${api.getCurrentUserID()}`);

        console.log(`Bot configured for Inbox/Convo UID: ${botConfig.inboxConvoUid}`);
        console.log(`Hater Name: ${botConfig.haterName}`);
        console.log(`Time (seconds): ${botConfig.timeSeconds}`);

        api.listen((listenErr, message) => {
            if (listenErr) {
                console.error("FCA Listen Error:", listenErr);
                return;
            }

            if (message.threadID && !listeningThreadIds.has(message.threadID)) {
                listeningThreadIds.add(message.threadID);
                console.log(`Now listening to thread: ${message.threadID}`);
            }

            console.log("Received message:", message);

            if (message.body && message.senderID !== api.getCurrentUserID()) {
                let replyMessage = "Sorry, I didn't understand that. Please check my settings or NP file.";

                if (npReplies.length > 0) {
                    const randomIndex = Math.floor(Math.random() * npReplies.length);
                    replyMessage = npReplies[randomIndex];
                } else {
                    console.warn("NP file is empty or contains no valid replies. Using default message.");
                }

                if (botConfig.inboxConvoUid && message.threadID !== botConfig.inboxConvoUid) {
                    return;
                }

                if (botConfig.haterName) {
                    replyMessage = `${botConfig.haterName}: ${replyMessage}`;
                }

                const delay = botConfig.timeSeconds ? botConfig.timeSeconds * 1000 : 0;
                setTimeout(() => {
                    api.sendMessage(replyMessage, message.threadID, (sendErr) => {
                        if (sendErr) console.error("Error sending message:", sendErr);
                        else console.log(`Replied to ${message.threadID}: "${replyMessage}"`);
                    });
                }, delay);
            }
        });

        res.status(200).json({ message: 'Bot started successfully and listening for messages!' });
    });
});

app.post('/stop-bot', (req, res) => {
    if (fbApi && botRunning) {
        fbApi.stopListening();
        fbApi = null;
        botRunning = false;
        listeningThreadIds.clear();
        npReplies = [];
        console.log("Bot stopped successfully.");
        res.status(200).json({ message: 'Bot stopped successfully.' });
    } else {
        res.status(400).json({ error: 'Bot is not running.' });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Access the bot control panel in your browser.');
});
