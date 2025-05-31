require('dotenv').config(); // .env फ़ाइल से पर्यावरण वेरिएबल्स लोड करें
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer'); // फ़ाइल अपलोड हैंडलिंग के लिए
const path = require('path');
const fs = require('fs'); // फ़ाइल सिस्टम ऑपरेशंस के लिए

const login = require('facebook-chat-api'); // FCA API

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware Setup ---
app.use(bodyParser.json()); // JSON बॉडी पार्स करने के लिए
app.use(bodyParser.urlencoded({ extended: true })); // URL-encoded बॉडी पार्स करने के लिए

// 'public' फोल्डर से स्टैटिक फ़ाइलें सर्व करें (यह बाद में बनाएंगे)
app.use(express.static(path.join(__dirname, 'public')));

// फ़ाइल अपलोड के लिए Multer सेटअप
// अस्थायी रूप से 'uploads/' डायरेक्टरी में फ़ाइलें सेव करेगा
const upload = multer({ dest: 'uploads/' });

// --- Global variables for bot state ---
let fbApi = null; // facebook-chat-api इंस्टेंस को स्टोर करेगा
let botRunning = false;
let npFileContent = null; // 'np' फ़ाइल के कंटेंट को स्टोर करेगा

// --- Routes ---

// यह रूट बाद में हमारे UI (HTML) को सर्व करेगा
app.get('/', (req, res) => {
    // अभी के लिए एक साधारण मैसेज भेजें, जब हम 'public' फोल्डर बनाएंगे तो इसे अपडेट करेंगे
    res.send('<h1>Rudra Multi Convo Bot Server is running!</h1><p>UI will be here soon.</p>');
});

// यह रूट बॉट को शुरू करने के लिए फॉर्म सबमिशन को हैंडल करेगा
app.post('/start-bot', upload.single('npFile'), async (req, res) => {
    if (botRunning) {
        return res.status(400).json({ error: 'Bot is already running. Please stop it first if you want to restart.' });
    }

    const { fbEmail, fbPassword, tokenType, tokenValue, phoneNumber, rudraName, someNumber } = req.body;
    const npFile = req.file; // अपलोड की गई np फ़ाइल

    if (!fbEmail || !fbPassword || !npFile) {
        return res.status(400).json({ error: 'Missing required fields: Facebook Email, Password, or NP File.' });
    }

    console.log('Received bot start request:');
    console.log('Email:', fbEmail);
    // console.log('Password:', fbPassword); // उत्पादन में पासवर्ड लॉग न करें!
    console.log('NP File:', npFile.originalname);

    // अपलोड की गई np फ़ाइल के कंटेंट को पढ़ें
    try {
        npFileContent = fs.readFileSync(npFile.path, 'utf8');
        console.log('NP File Content Loaded.');
    } catch (error) {
        console.error('Error reading NP file:', error);
        return res.status(500).json({ error: 'Failed to read NP file.' });
    } finally {
        // अपलोड की गई फ़ाइल को हटा दें
        fs.unlink(npFile.path, (err) => {
            if (err) console.error("Error deleting uploaded file:", err);
        });
    }

    // --- FCA लॉगिन लॉजिक ---
    const credentials = {
        email: fbEmail,
        password: fbPassword
    };

    login(credentials, (err, api) => {
        if (err) {
            console.error("FCA Login Error:", err);
            // FCA API के लिए, appstate.json बनाना महत्वपूर्ण है।
            // यदि 'appstate.json' फ़ाइल नहीं बनती है, तो आप 'Login refused' या 2FA संबंधित त्रुटियां देख सकते हैं।
            // हम बाद में ऐपस्टेट को कैसे संभालना है, इस पर चर्चा करेंगे।
            if (err.error === 'login-fac') {
                return res.status(401).json({ error: 'Facebook 2FA required. Please handle 2FA manually or use appstate.json.' });
            }
            return res.status(500).json({ error: `FCA Login Failed: ${err.message || err}` });
        }

        fbApi = api; // API इंस्टेंस को स्टोर करें
        botRunning = true;
        console.log("Successfully logged in to Facebook Messenger with FCA!");

        // संदेशों के लिए सुनना शुरू करें
        api.listen((listenErr, message) => {
            if (listenErr) {
                console.error("FCA Listen Error:", listenErr);
                return;
            }

            console.log("Received message:", message);

            // --- ऑटो-रिप्लाई लॉजिक (npFileContent का उपयोग करके) ---
            if (message.body) {
                let replyMessage = "Sorry, I don't understand that.";

                // यह वह जगह है जहाँ आप अपनी 'np' फ़ाइल लुकअप लागू करेंगे।
                // अभी के लिए, हम मान लेते हैं कि npFileContent एक JSON स्ट्रिंग है
                // जिसमें प्रश्न-उत्तर जोड़े हैं।
                try {
                    const parsedNp = JSON.parse(npFileContent);
                    if (parsedNp[message.body.toLowerCase()]) {
                        replyMessage = parsedNp[message.body.toLowerCase()];
                    }
                } catch (e) {
                    // यदि npFileContent JSON नहीं है, तो एक डिफ़ॉल्ट रिप्लाई
                    replyMessage = `You said: "${message.body}". I'm set up with NP file but cannot parse it yet.`;
                }


                api.sendMessage(replyMessage, message.threadID, (sendErr) => {
                    if (sendErr) console.error("Error sending message:", sendErr);
                });
            }
        });

        res.status(200).json({ message: 'Bot started successfully and listening for messages!' });
    });
});


// --- Error Handling ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// --- सर्वर शुरू करें ---
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Visit / to see the temporary UI message.');
});
