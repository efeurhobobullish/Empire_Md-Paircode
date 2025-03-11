const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
const pino = require("pino");
const { toBuffer } = require("qrcode");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

let router = express.Router();

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    async function PrabathQr() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let PrabathQrWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,  // Disable printing QR to terminal
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            PrabathQrWeb.ev.on('creds.update', saveCreds);
            PrabathQrWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s; // ✅ Fixed destructuring

                if (qr) {
                    console.log("QR Code received!");
                    if (!res.headersSent) {
                        res.setHeader('Content-Type', 'image/png');
                        try {
                            const qrBuffer = await toBuffer(qr);  // Convert QR to buffer
                            res.end(qrBuffer);  // Send the buffer as the response
                            return; // ✅ Prevent multiple responses
                        } catch (error) {
                            console.error("Error generating QR Code buffer:", error);
                            return; // ✅ Exit after sending the error response
                        }
                    }
                }

                if (connection === "open") {
                    console.log("Connection opened successfully!");

                    try {
                        await delay(10000); // Wait before sending messages
                        const authPath = './session/';
                        const user_jid = jidNormalizedUser(PrabathQrWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const sessionFile = authPath + 'creds.json';
                        const mega_url = await upload(fs.createReadStream(sessionFile), `${randomMegaId()}.json`);

                        const sid = mega_url.replace('https://mega.nz/file/', '');

                        await PrabathQrWeb.sendMessage(user_jid, { text: sid });

                        await delay(5000); // Wait before sending additional message
                        await PrabathQrWeb.sendMessage(user_jid, {
                            text: `> *PAIR CODE HAS BEEN SCANNED SUCCESSFULLY* ✅  
╭───────────────◆  
│⿻ *Give a star to the repo for support* 🌟  
│ https://github.com/efeurhobo/Empire_X  
│  
│⿻ *Support Group for Queries* 💭  
│ https://chat.whatsapp.com/HnrCOlPdtH1AvhxIroMH90  
│  
│⿻ *Support Channel for Queries* 💭  
│ https://whatsapp.com/channel/0029VajVvpQIyPtUbYt3Oz0k  
│  
│⿻ *YouTube Tutorials* 🪄  
│ https://youtube.com/only_one_empire  
│  
╰────────────────◆  
╭────────────────◆  
│ *EMPIRE_X - WhatsApp Bot*  
╰─────────────────◆`
                        });

                    } catch (e) {
                        console.error("Error sending message:", e);
                        exec('pm2 restart prabath');
                    }

                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    console.log("Connection closed, retrying...");
                    await delay(10000);
                    PrabathQr();
                }
            });
        } catch (err) {
            console.error("Error in PrabathQr function:", err);
            exec('pm2 restart prabath-md');
            PrabathQr();
            removeFile('./session');

            if (!res.headersSent) {
                res.status(503).json({ error: "Service Unavailable" });
            }
        }
    }

    return PrabathQr();
});

process.on('uncaughtException', function (err) {
    console.error('Uncaught exception:', err);
    exec('pm2 restart prabath-md');
});

module.exports = router;
