const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const login = require('facebook-chat-api'); // FCA API

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Setup ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ dest: 'uploads/' });

// --- Global variables for bot state ---
let fbApi = null;
let botRunning = false;
let npFileContent = null;
let listeningThreadIds = new Set();
let botConfig = {}; // To store all form inputs for bot logic

// --- Routes ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// This route handles the form submission to start the bot
app.post('/start-bot', upload.single('npFile'), async (req, res) => {
    if (botRunning) {
        return res.status(400).json({ error: 'Bot is already running. Please stop it first if you want to restart.' });
    }

    // Capture all form fields based on the new UI (with appStateJson)
    const { appStateJson, phoneNumber, rudraName, someNumber } = req.body;
    const npFile = req.file;

    // Store all captured config for bot's use later
    botConfig = {
        appState: appStateJson, // Now directly taking appState JSON string
        inboxConvoUid: phoneNumber,
        haterName: rudraName,
        timeSeconds: someNumber,
        npFilePath: npFile ? npFile.path : null,
        npFileOriginalName: npFile ? npFile.originalname : null
    };

    if (!botConfig.appState || !npFile) {
        return res.status(400).json({ error: 'Missing required fields: Facebook Cookies (appState JSON) or NP File.' });
    }

    console.log('Received bot start request with config:', botConfig);

    // Read uploaded np file content
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

    // --- FCA Login Logic using appState ---
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
            if (err.error === 'login-fac') {
                return res.status(401).json({ error: 'Facebook 2FA required for this appState. You might need a fresh appState.' });
            }
            return res.status(500).json({ error: `FCA Login Failed: ${err.message || err}` });
        }

        fbApi = api;
        botRunning = true;
        listeningThreadIds.clear();
        console.log("Successfully logged in to Facebook Messenger with FCA using appState!");

        // Example of using the other form fields (botConfig)
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

            // --- Auto-reply logic (using npFileContent and other configs) ---
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

                api.sendMessage(replyMessage, message.threadID, (sendErr) => {
                    if (sendErr) console.error("Error sending message:", sendErr);
                    else console.log(`Replied to ${message.threadID}: "${replyMessage}"`);
                });
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
