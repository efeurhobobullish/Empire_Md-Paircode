const { exec } = require("child_process");
const { upload } = require('./mega');
const express = require('express');
const pino = require("pino");
const { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { makeInMemoryStore } = require('@whiskeysockets/baileys');
const { useMultiFileAuthState, Browsers, makeWASocket, delay } = require('@whiskeysockets/baileys');

let router = express.Router();

const MESSAGE = process.env.MESSAGE || `> *PAIR CODE HAS BEEN SCANNED SUCCESSFULLY* ✅  
╭───────────────◆  
│⿻ *Gɪᴠᴇ ᴀ ꜱᴛᴀʀ ᴛᴏ ʀᴇᴘᴏ ꜰᴏʀ ᴄᴏᴜʀᴀɢᴇ* 🌟  
│ https://github.com/efeurhobo/Empire_X  
│  
│⿻ *Sᴜᴘᴘᴏʀᴛ Gʀᴏᴜᴘ ꜰᴏʀ ϙᴜᴇʀʏ* 💭  
│ https://chat.whatsapp.com/HnrCOlPdtH1AvhxIroMH90  
│  
│⿻ *Sᴜᴘᴘᴏʀᴛ CHANNEL ꜰᴏʀ ϙᴜᴇʀʏ* 💭  
│ https://whatsapp.com/channel/0029VajVvpQIyPtUbYt3Oz0k  
│  
│⿻ *Yᴏᴜ-ᴛᴜʙᴇ ᴛᴜᴛᴏʀɪᴀʟꜱ* 🪄  
│ https://youtube.com/only_one_empire  
│  
╰────────────────◆  
╭────────────────◆  
│ *EMPIRE_X--WHATTSAPP-BOT*  
╰─────────────────◆`;

const sessionDir = './session';
const authInfoDir = './auth_info_baileys';

if (fs.existsSync(authInfoDir)) {
    fs.emptyDirSync(authInfoDir);
}

router.get('/', async (req, res) => {
    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

    async function startPrabath() {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        try {
            const prabathSocket = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            prabathSocket.ev.on('creds.update', saveCreds);
            prabathSocket.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect, qr } = s;

                if (qr) {
                    if (!res.headersSent) {
                        res.setHeader('Content-Type', 'image/png');
                        try {
                            const qrBuffer = await toBuffer(qr);
                            res.end(qrBuffer); // Send the buffer as the response
                            return;
                        } catch (error) {
                            console.error("Error generating QR Code buffer:", error);
                            res.sendStatus(500); // Internal server error
                            return;
                        }
                    }
                }

                if (connection === "open") {
                    try {
                        await delay(10000);
                        const user = Smd.user.id;

                        // Generate random Mega ID
                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const megaUrl = await upload(fs.createReadStream(authInfoDir + 'creds.json'), `${randomMegaId()}.json`);
                        const sessionId = megaUrl.replace('https://mega.nz/file/', '');

                        console.log(`====================  SESSION ID  ==========================
SESSION-ID ==> ${sessionId}
-------------------   SESSION CLOSED   -----------------------`);

                        await prabathSocket.sendMessage(user_jid, { text: sessionId });

                        await delay(5000);
                        await prabathSocket.sendMessage(user_jid, { text: MESSAGE });

                        fs.emptyDirSync(authInfoDir);
                    } catch (error) {
                        console.error("Error during session open:", error);
                    }
                }

                if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    startPrabath(); // Restart connection if necessary
                }
            });
        } catch (err) {
            console.error("Error in socket creation:", err);
            exec('pm2 restart prabath-md');
            fs.emptyDirSync(sessionDir);
            res.status(503).send({ message: "Service Unavailable" });
        }
    }

    startPrabath().catch(async (err) => {
        console.error("Error during startup:", err);
        fs.emptyDirSync(authInfoDir);
        exec('pm2 restart qasim');
    });

    return await startPrabath();
});

process.on('uncaughtException', (err) => {
    console.error('Caught exception:', err);
    exec('pm2 restart prabath');
});

module.exports = router;
