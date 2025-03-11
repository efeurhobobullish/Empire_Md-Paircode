const express = require('express');
const fs = require('fs-extra');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

const authInfoDir = './auth_info_baileys';

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function PrabathPair() {
        const { state, saveCreds } = await useMultiFileAuthState(authInfoDir);

        try {
            let PrabathPairWeb = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!PrabathPairWeb.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await PrabathPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            PrabathPairWeb.ev.on('creds.update', saveCreds);
            PrabathPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(10000);
                        const credsPath = `${authInfoDir}/creds.json`;
                        if (!fs.existsSync(credsPath)) {
                            console.error("creds.json not found in auth_info_baileys");
                            return;
                        }

                        const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);

                        function randomMegaId(length = 6, numberLength = 4) {
                            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                            let result = '';
                            for (let i = 0; i < length; i++) {
                                result += characters.charAt(Math.floor(Math.random() * characters.length));
                            }
                            const number = Math.floor(Math.random() * Math.pow(10, numberLength));
                            return `${result}${number}`;
                        }

                        const mega_url = await upload(fs.createReadStream(credsPath), `${randomMegaId()}.json`);
                        const sessionId = mega_url.replace('https://mega.nz/file/', '');

                        await PrabathPairWeb.sendMessage(user_jid, { text: sessionId });

                        await delay(5000);
                        await PrabathPairWeb.sendMessage(user_jid, {
                            text: `> *PAIR CODE HAS BEEN SCANNED SUCCESSFULLY* ✅  
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
╰─────────────────◆`
                        });

                        removeFile(authInfoDir);
                    } catch (e) {
                        console.error("Error in session handling:", e);
                        exec('pm2 restart prabath');
                    }
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    PrabathPair();
                }
            });
        } catch (err) {
            console.error("Error in PrabathPair:", err);
            exec('pm2 restart prabath-md');
            removeFile(authInfoDir);
            if (!res.headersSent) {
                res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await PrabathPair();
});

process.on('uncaughtException', (err) => {
    console.error('Caught exception:', err);
    exec('pm2 restart prabath');
});

module.exports = router;