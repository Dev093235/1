const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = "Rudra";

app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.urlencoded({ extended: true }));
app.use(multer().single("npFile"));

app.post("/start", (req, res) => {
    const { password, token, uids, delay } = req.body;
    if (password !== PASSWORD) return res.send("❌ Incorrect password");
    const npData = req.file?.buffer.toString().split("
").filter(Boolean);
    if (!token || !uids || !npData?.length) return res.send("❌ Missing data");

    return res.send(`
        ✅ Convo Started<br>
        Token: ${token.slice(0, 10)}...<br>
        UIDs: ${uids}<br>
        Delay: ${delay}s<br>
        Messages:<br>${npData.map(m => "👉 " + m).join("<br>")}
    `);
});

app.listen(PORT, () => console.log("✅ Server running on port " + PORT));
