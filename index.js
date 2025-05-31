const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const login = require('fca-smart-shankar'); // fca-smart-shankar library import

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Setup ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ dest: 'uploads/' });

// --- Global variables for bot state ---
let fbApi = null; // Single bot instance
let botRunning = false;
let npFileContent = null;
let listeningThreadIds = new Set();
let botConfig = {}; // To store all form inputs for the single bot

// --- Routes ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// This route handles the form submission to start the single bot
app.post('/start-bot', upload.single('npFile'), async (req, res) => {
    if (botRunning) {
        return res.status(400).json({ error: 'Bot is already running. Please stop it first if you want to restart.' });
    }

    const { appStateJson, phoneNumber, rudraName, someNumber } = req.body;
    const npFile = req.file;

    botConfig = {
        appState: appStateJson,
        inboxConvoUid: phoneNumber || '',
        haterName: rudraName,
        timeSeconds: someNumber,
        npFilePath: npFile ? npFile.path : null,
        npFileOriginalName: npFile ? npFile.originalname : null
    };

    if (!botConfig.appState || !npFile) {
        return res.status(400).json({ error: 'Missing required fields: Facebook Cookies (appState JSON) or NP File.' });
    }

    console.log('Received bot start request with config:', botConfig);

    try {
        npFileContent = fs.readFileSync(npFile.path, 'utf8');
        console.log('NP File Content Loaded.');
    } catch (error) {
        console.error('Error reading NP file:', error);
        return res.status(500).json({ error: 'Failed to read NP file.' });
    } finally {
        fs.unlink(npFile.path, (err) => {
            if (err) console.error("Error deleting uploaded file:", err);
        });
    }

    let appState;
    try {
        appState = JSON.parse(botConfig.appState);
        if (!Array.isArray(appState)) {
            throw new Error("appState must be a JSON array.");
        }
    } catch (e) {
        console.error("Error parsing appState JSON:", e);
        return res.status(400).json({ error: 'Invalid Facebook Cookies (appState JSON) provided. It must be a valid JSON array.' });
    }

    login({ appState: appState }, (err, api) => {
        if (err) {
            console.error("FCA Login Error:", err);
            if (err.error) {
                if (err.error.includes("invalid credentials") || err.error.includes("Login refused")) {
                    return res.status(401).json({ error: 'Login failed: Invalid appState JSON or Facebook blocked the login attempt. Try fresh cookies.' });
                }
                if (err.error.includes("2FA")) {
                     return res.status(401).json({ error: 'Facebook 2FA required for this appState. Try fresh cookies or disable 2FA.' });
                }
            }
            return res.status(500).json({ error: `FCA Login Failed: ${err.message || JSON.stringify(err)}` });
        }

        fbApi = api;
        botRunning = true;
        listeningThreadIds.clear();
        console.log(`Successfully logged in to Facebook Messenger with FCA (fca-smart-shankar) for ID: ${api.getCurrentUserID()}`);

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

                try {
                    const parsedNp = JSON.parse(npFileContent);
                    const userMessage = message.body.toLowerCase();

                    if (parsedNp[userMessage]) {
                        replyMessage = parsedNp[userMessage];
                    } else {
                        for (const key in parsedNp) {
                            if (userMessage.includes(key.toLowerCase())) {
                                replyMessage = parsedNp[key];
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("NP file content is not valid JSON. Treating as plain text or default.", e);
                    replyMessage = `I received your message: "${message.body}". My NP file isn't parsed as JSON.`;
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

// --- Stop Bot Route ---
app.post('/stop-bot', (req, res) => {
    if (fbApi && botRunning) {
        fbApi.stopListening();
        fbApi = null;
        botRunning = false;
        listeningThreadIds.clear();
        npFileContent = null;
        console.log("Bot stopped successfully.");
        res.status(200).json({ message: 'Bot stopped successfully.' });
    } else {
        res.status(400).json({ error: 'Bot is not running.' });
    }
});

// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Access the bot control panel in your browser.');
});
