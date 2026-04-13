const { exec } = require('child_process');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const axios = require('axios');
const FormData = require('form-data');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. DYNAMIC CONFIGURATION SYSTEM
// ==========================================
const configPath = path.join(__dirname, 'config.json');
let config = { 
    whitelist: "", 
    targetChat: "", 
    telegramToken: "", 
    telegramChatId: "",
    passphrase: "",
    passphraseEnabled: false
};

if (fs.existsSync(configPath)) {
    const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config = { ...config, ...savedConfig }; 
} else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const FOOTER = '\n\n---\n🤖 This automation is developed by *Jaival* \nSee source code: github.com/jaival-11/wa-autoforward-bot';

let botState = 'STARTING';
let qrCodeData = '';

// ==========================================
// 2. WEB UI (EXPRESS SERVER)
// ==========================================
const app = express();
app.use(express.json());

const HTML_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot Dashboard</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <style>

@import url('https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&family=Playpen+Sans:wght@100..800&display=swap');

        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #e0e5ec, #f0f5fc); color: #333; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; min-height: 100vh;}
        .container { max-width: 650px; width: 100%; }
        .card { background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: 20px; padding: 20px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.5); margin-bottom: 20px; }
        h2 { margin-top: 0; font-size: 1.4rem; border-bottom: 2px solid rgba(0,0,0,0.05); padding-bottom: 10px; }
        label { font-weight: bold; font-size: 0.9rem; display: block; margin-top: 15px; color: #444;}
        input[type="text"] { width: 100%; padding: 12px; margin-top: 5px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); background: rgba(255,255,255,0.7); box-sizing: border-box; font-family: monospace;}
        .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-top: 15px; background: rgba(255,255,255,0.5); padding: 10px 15px; border-radius: 12px;}
        .toggle-row label { margin: 0; }
        button { background: #007bff; color: white; border: none; padding: 12px 18px; border-radius: 12px; cursor: pointer; font-weight: bold; margin-top: 15px; transition: 0.3s; width: 100%;}
        button:hover { background: #0056b3; box-shadow: 0 4px 15px rgba(0,123,255,0.3);}
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; box-shadow: 0 4px 15px rgba(220,53,69,0.3);}
        .row { display: flex; gap: 10px; align-items: center; }
        .row button { margin-top: 0; width: auto; }
        
        /* Profile Section */
        .profile-container { display: flex; align-items: center; gap: 20px; padding: 10px; display: none; }
        .profile-pic { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .profile-info h3 { margin: 0 0 5px 0; font-size: 1.5rem; }
        .profile-info p { margin: 0; color: #555; font-size: 0.9rem; font-family: monospace; }
        
        .auth-status { font-size: 1.2rem; font-weight: bold; margin-bottom: 15px; text-align: center; }
        #qrContainer { margin-top: 15px; padding: 15px; background: white; display: inline-block; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);}
        #statusMsg { color: #28a745; font-weight: bold; margin-top: 10px; display: none; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        
        <div class="card">
            <div id="connStatus" class="auth-status">🔄 Checking status...</div>
            <div id="qrContainer" style="text-align: center; width: 100%; display: none;"></div>
            
            <div class="profile-container" id="profileData">
                <img id="pPic" src="" alt="Profile Picture" class="profile-pic">
                <div class="profile-info">
                    <h3 id="pName">Loading...</h3>
                    <p>📞 <span id="pPhone"></span></p>
                    <p>🆔 <span id="pId"></span></p>
                </div>
            </div>
            <button onclick="logoutBot()" id="logoutBtn" class="btn-danger" style="display:none;">🔴 Log Out Account</button>
        </div>
        
        <div class="card">
            <h2>⚙️ Bot Configuration</h2>
            
            <label>Whitelist User IDs (Comma separated)</label>
            <input type="text" id="whitelist" placeholder="e.g. 65240570056773, 919876543210">
            
            <label>Target Group ID</label>
            <input type="text" id="targetChat" placeholder="e.g. 1234567890-123456@g.us">
            
            <label>Telegram Bot Token</label>
            <input type="text" id="telegramToken" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11">
            
            <label>Telegram Chat ID</label>
            <input type="text" id="telegramChatId" placeholder="123456789">
        <div style="margin-top: 15px; background: rgba(0,0,0,0.1); padding: 10px; border-radius: 6px;">
            <label style="display:flex; align-items:center; cursor:pointer; margin:0;">
                <input type="checkbox" id="telegramHeartbeat" style="width:auto; margin-right:10px; margin-bottom:0; transform: scale(1.2);">
                <b>Enable Telegram Heartbeat Pings (Every 10 mins)</b>
            </label>
        </div>

            <h2 style="margin-top: 25px;">🔑 Auto-Whitelist (Passphrase)</h2>
            <div class="toggle-row">
                <label for="passphraseEnabled">Enable Passphrase Log-In</label>
                <input type="checkbox" id="passphraseEnabled" style="width: 20px; height: 20px;">
            </div>
            <input type="text" id="passphrase" placeholder="Enter a secret passphrase (e.g. letme-in-123)">
            <p style="font-size: 0.8rem; color: #666; margin-top: 5px;">Users can text <b>/id &lt;passphrase&gt;</b> to instantly authorize themselves.</p>
            
            <button onclick="saveConfig()">💾 Save Configuration</button>
            <div id="statusMsg">Settings Saved! Telegram audit log sent.</div>
        </div>

        <div class="card">
            <h2>👥 Extract Group IDs</h2>
            <button onclick="fetchGroups()">Fetch My Groups</button>
            <div id="groupList" style="margin-top: 15px; max-height: 300px; overflow-y: auto;"></div>
        </div>

        <div class="card">
            <h2>🔍 Extract ID from Number</h2>
            <div class="row">
                <input type="text" id="phoneInput" placeholder="919876543210 (Country code required)">
                <button onclick="getIdFromNumber()">Get ID</button>
            </div>
            <div id="idResult" style="margin-top: 10px; font-weight: bold; font-family: monospace;"></div>
        </div>
    </div>

    <script>
        let currentQR = '';

        async function updateDashboard() {
            try {
                const r = await fetch('/api/status');
                const d = await r.json();
                
                const st = document.getElementById('connStatus');
                const btn = document.getElementById('logoutBtn');
                const qrC = document.getElementById('qrContainer');
                const prof = document.getElementById('profileData');

                if (d.state === 'CONNECTED') {
                    st.style.display = 'none'; 
                    btn.style.display = 'block';
                    qrC.style.display = 'none';
                    prof.style.display = 'flex';
                    currentQR = '';

                    const pr = await fetch('/api/profile');
                    const pd = await pr.json();
                    if(pd.success) {
                        document.getElementById('pPic').src = pd.pic;
                        document.getElementById('pName').innerText = pd.name;
                        document.getElementById('pPhone').innerText = pd.phone;
                        document.getElementById('pId').innerText = pd.id;
                    }
                } else if (d.state === 'QR') {
                    st.style.display = 'block';
                    st.innerHTML = '🟡 Waiting for WhatsApp Scan...';
                    st.style.color = '#d39e00';
                    btn.style.display = 'none';
                    prof.style.display = 'none';
                    qrC.style.display = 'block';
                    
                    if (currentQR !== d.qr && d.qr) {
                        currentQR = d.qr;
                        qrC.innerHTML = ''; 
                        new QRCode(qrC, { text: d.qr, width: 220, height: 220 });
                    }
                } else {
                    st.style.display = 'block';
                    st.innerHTML = '🔴 Disconnected / Restarting...';
                    st.style.color = 'red';
                    btn.style.display = 'none';
                    prof.style.display = 'none';
                    qrC.style.display = 'none';
                }
            } catch (e) { console.error('Dashboard sync failed'); }
        }
        setInterval(updateDashboard, 3000);
        updateDashboard();

        fetch('/api/config').then(r => r.json()).then(data => {
            document.getElementById('whitelist').value = data.whitelist;
            document.getElementById('targetChat').value = data.targetChat;
            document.getElementById('telegramToken').value = data.telegramToken;
            document.getElementById('telegramChatId').value = data.telegramChatId;
            if(document.getElementById('telegramHeartbeat')) {
                document.getElementById('telegramHeartbeat').checked = data.telegramHeartbeat !== false;
            }
            document.getElementById('passphrase').value = data.passphrase;
            document.getElementById('passphraseEnabled').checked = data.passphraseEnabled;
        });

        function saveConfig() {
            const newConfig = {
                whitelist: document.getElementById('whitelist').value,
                targetChat: document.getElementById('targetChat').value,
                telegramToken: document.getElementById('telegramToken').value,
                telegramChatId: document.getElementById('telegramChatId').value,
            telegramHeartbeat: document.getElementById('telegramHeartbeat') ? document.getElementById('telegramHeartbeat').checked : true,
                passphrase: document.getElementById('passphrase').value,
                passphraseEnabled: document.getElementById('passphraseEnabled').checked
            };
            fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            }).then(() => {
                const msg = document.getElementById('statusMsg');
                msg.style.display = 'block';
                setTimeout(() => msg.style.display = 'none', 3000);
            });
        }

        async function logoutBot() {
            if(confirm("Log out? You will need to scan a new QR code to reconnect.")) {
                document.getElementById('connStatus').style.display = 'block';
                document.getElementById('connStatus').innerHTML = '🔴 Wiping session...';
                document.getElementById('profileData').style.display = 'none';
                await fetch('/api/logout', { method: 'POST' });
            }
        }

        function copyText(text) { navigator.clipboard.writeText(text); }

        async function fetchGroups() {
            const list = document.getElementById('groupList');
            list.innerHTML = 'Loading...';
            try {
                const res = await fetch('/api/groups');
                const groups = await res.json();
                list.innerHTML = '';
                if(groups.error || groups.length === 0) {
                    list.innerHTML = '<span style="color:red">No groups found or bot not connected.</span>';
                    return;
                }
                groups.forEach(g => {
                    list.innerHTML += \`<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(0,0,0,0.1);">
                        <div><b style="font-family: 'Segoe UI';">\${g.name}</b><br><small style="font-family: monospace; color: #555;">\${g.id}</small></div>
                        <button onclick="copyText('\${g.id}')" style="margin: 0; padding: 5px 10px; background: #28a745; width: auto;">Copy ID</button>
                    </div>\`;
                });
            } catch(e) { list.innerHTML = '<span style="color:red">Error fetching groups.</span>'; }
        }

        async function getIdFromNumber() {
            const number = document.getElementById('phoneInput').value;
            const res = await fetch('/api/get-id', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number })
            });
            const data = await res.json();
            const resultDiv = document.getElementById('idResult');
            if (data.success) {
                resultDiv.innerHTML = \`\${data.id} <button onclick="copyText('\${data.id}')" style="background:#28a745; margin-left:10px; padding:5px 10px;">Copy ID</button>\`;
            } else {
                resultDiv.innerHTML = \`<span style="color:red">Failed to find ID.</span>\`;
            }
        }
    </script>

<footer style="font-family: 'Playpen Sans', cursive; text-align: center; padding: 20px; margin-top: 20px;">
    <b>Made with ❤️, by <a href="https://x.com/techironic11" target="_blank" style="color: black; text-decoration: none;"><u>Jaival</u></a></b>
    
    <div style="margin: 15px 0;">
        <a href="https://github.com/jaival-11/wa-autoforward-bot" target="_blank" style="color: black; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: bold;">
            <svg height="22" width="22" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            See Repo
        </a>
    </div>

    <div style="font-size: 0.85em; color: #666; font-family: sans-serif; line-height: 1.4;">
        &copy; 2026 Jaival. <br>
        Distributed under the MIT License. <br>
        Free for personal and commercial use.
    </div>
</footer>

</body>
</html>
`;

app.get('/', (req, res) => res.send(HTML_UI));
app.get('/api/config', (req, res) => res.json(config));
app.get('/api/status', (req, res) => res.json({ state: botState, qr: qrCodeData }));

app.get('/api/profile', async (req, res) => {
    if (botState !== 'CONNECTED' || !client.info) return res.json({ success: false });
    try {
        const wid = client.info.wid._serialized;
        const picUrl = await client.getProfilePicUrl(wid).catch(() => null);
        res.json({
            success: true,
            name: client.info.pushname || 'WhatsApp User',
            phone: client.info.wid.user,
            id: wid,
            pic: picUrl || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'
        });
    } catch (err) { res.json({ success: false }); }
});

app.post('/api/config', async (req, res) => {
    const oldConfig = { ...config };
    config = req.body;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    let changes = [];
    if(oldConfig.whitelist !== config.whitelist) changes.push(`- Whitelist updated`);
    if(oldConfig.targetChat !== config.targetChat) changes.push(`- Target Chat updated`);
    if(oldConfig.passphrase !== config.passphrase) changes.push(`- Passphrase changed`);
    if(oldConfig.passphraseEnabled !== config.passphraseEnabled) changes.push(`- Passphrase Login: ${config.passphraseEnabled ? 'ENABLED' : 'DISABLED'}`);
    if(oldConfig.telegramHeartbeat !== config.telegramHeartbeat) changes.push(`- Telegram Heartbeat: ${config.telegramHeartbeat ? 'ENABLED' : 'DISABLED'}`);

    if(changes.length > 0) {
        const auditLog = `⚙️ *Dashboard Audit Log*\nWeb UI configuration was modified:\n\n${changes.join('\n')}\n\n#Config #Update #Audit`;
        await sendTelegram(auditLog);
        console.log('[SYSTEM] Config updated via Web UI.');
    }
    res.json({ success: true });
});

app.post('/api/logout', async (req, res) => {
    try {
        botState = 'DISCONNECTED';
        qrCodeData = '';
        await client.logout().catch(()=>{}); 
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/groups', async (req, res) => {
    if (botState !== 'CONNECTED') return res.status(400).json({error: 'Bot not connected'});
    try {
        const chats = await client.getChats();
        const groups = chats.filter(c => c.isGroup).map(g => ({ name: g.name, id: g.id._serialized }));
        res.json(groups);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/get-id', async (req, res) => {
    if (botState !== 'CONNECTED') return res.json({ success: false });
    try {
        const numberId = await client.getNumberId(req.body.number);
        if (numberId) res.json({ success: true, id: numberId.user });
        else res.json({ success: false });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.listen(3000, '0.0.0.0', () => console.log('🌐 Web UI running at http://localhost:3000'));

// ==========================================
// 3. TELEGRAM HELPERS
// ==========================================
async function sendTelegram(text, retries = 3) {
    if (!config.telegramToken || config.telegramToken === "") return;
    for (let i = 0; i < retries; i++) {
        try {
            await axios.post(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
                chat_id: config.telegramChatId, text: text, parse_mode: 'Markdown'
            });
            return; // Success, exit the loop
        } catch (err) { 
            if (i === retries - 1) console.error("Telegram error after 3 retries:", err.message); 
            else await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds before retrying
        }
    }
}

async function sendTelegramMedia(caption, mediaData) {
    if (!config.telegramToken) return;
    try {
        const buffer = Buffer.from(mediaData.data, 'base64');
        const form = new FormData();
        form.append('chat_id', config.telegramChatId);
        form.append('caption', caption.length > 1000 ? caption.substring(0, 1000) + '...' : caption); 
        form.append('parse_mode', 'Markdown');
        
        let filename = mediaData.filename || `media_file.${mediaData.mimetype.split('/')[1].split(';')[0]}`;
        form.append('document', buffer, { filename });

        await axios.post(`https://api.telegram.org/bot${config.telegramToken}/sendDocument`, form, {
            headers: form.getHeaders(), maxBodyLength: Infinity, maxContentLength: Infinity
        });
    } catch (err) { await sendTelegram(caption + "\n\n⚠️ *Media upload failed.*"); }
}

// ==========================================
// 4. INITIALIZE WHATSAPP CLIENT
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/data/data/com.termux/files/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu']
    }
});

client.on('qr', (qr) => { botState = 'QR'; qrCodeData = qr; });

client.on('ready', async () => {
    botState = 'CONNECTED';
    qrCodeData = '';
    await sendTelegram('✅ *System Ready*\nAutomation Server is up and listening!\n\n#System #Ready');
});

// FEATURE: Auto-Wipe Session Folder on Disconnect
client.on('disconnected', async () => {
    console.log('[SYSTEM] Disconnected! Wiping old session data...');
    botState = 'DISCONNECTED';
    qrCodeData = '';
    
    // Safely kill the browser
    await client.destroy().catch(()=>{});

    // The automated "rm -rf .wwebjs_auth"
    const authPath = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        console.log('[SYSTEM] Session folder successfully deleted.');
    }

    // Restart fresh
    

// --- System Heartbeat Module ---
client.on('ready', () => {
    const sendPing = async () => {
        const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        
        // 1. Non-blocking Network Check (Matches Watchdog logic)
        const isConnected = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), 5000);
            require('dns').resolve('api.telegram.org', (err) => {
                clearTimeout(timer);
                resolve(!err);
            });
        });
        
        if (isConnected) {
            console.log(`\n➡️ [${time}] System Heartbeat: Server is active and connected to the internet.`);
            
            // Strictly respects the Web UI toggle
            if (config.telegramHeartbeat !== false) {
                sendTelegram(`🟢 *System Heartbeat:* Bot is actively listening at ${time}`).catch(() => {});
                console.log("   └─ Telegram notification sent!");
            } else {
                console.log("   └─ Telegram notification skipped (Disabled via Web UI).");
            }
        } else {
            // Logs offline status without attempting Telegram or freezing the OS
            console.log(`\n🔴 [${time}] System Heartbeat ALERT: Server is running, but NO INTERNET connection detected!`);
        }
    };
    
    setTimeout(sendPing, 2000); // Wait 2 seconds, then send startup ping
    setInterval(sendPing, 10 * 60 * 1000); // Start the 10-minute loop

            // --- Active Network State Monitor (V3: Non-Blocking & Toggle-Aware) ---
    let isOffline = false;
    let offlineStartTime = null;

    setInterval(async () => {
        // 1. Non-blocking Network Check with a strict 5-second timeout
        const isConnected = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), 5000);
            require('dns').resolve('api.telegram.org', (err) => {
                clearTimeout(timer);
                resolve(!err);
            });
        });

        if (isConnected) {
            // State Change: Offline -> Online
            if (isOffline) {
                isOffline = false;
                const recoveryTime = new Date();
                const timeStr = recoveryTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                
                let durationStr = "Unknown";
                let offlineTimeStr = "Unknown";
                if (offlineStartTime) {
                    offlineTimeStr = offlineStartTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                    const diffMs = recoveryTime - offlineStartTime;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffSecs = Math.floor((diffMs % 60000) / 1000);
                    durationStr = diffMins > 0 ? diffMins + "m " + diffSecs + "s" : diffSecs + "s";
                }
                
                console.log("\n🟢 [" + timeStr + "] NETWORK RECOVERED: Internet connection is back online! (Offline since: " + offlineTimeStr + " | Downtime: " + durationStr + ")");
            exec('termux-notification-remove bot_net_alert', () => {});
                
                // 2. Strict UI Toggle Check for the Recovery Ping
                if (config.telegramHeartbeat !== false) {
                    const alertMsg = "✅ *Network Recovered*\nServer internet connection restored at " + timeStr + "\n⏱️ *Downtime:* " + durationStr + " (Went offline at " + offlineTimeStr + ")\n\n#Network #SystemLog";
                    sendTelegram(alertMsg).catch(() => {}); 
                } else {
                    console.log("   └─ Recovery Telegram alert skipped (Disabled via Web UI).");
                }
            }
        } else {
            // State Change: Online -> Offline
            if (!isOffline) {
                isOffline = true;
                offlineStartTime = new Date();
                const timeStr = offlineStartTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                console.log("\n🔴 [" + timeStr + "] NETWORK DROPPED: Server lost internet connection!");
            exec('termux-notification --id "bot_net_alert" --title "🔴 Bot Offline" --content "Internet dropped. Heartbeat suspended." --priority max --sound', () => {});
            }
        }
    }, 30000); // Poll network state every 30 seconds
});


// --- Pairing Code Authentication Failsafe ---
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

client.on('qr', (qr) => {
    // 1-second delay ensures this prints AFTER the giant QR code finishes drawing
    setTimeout(() => {
        console.log('\n==================================================');
        console.log('📱 CAN\'T SCAN THE QR CODE? LET\'S USE A PAIRING CODE!');
        console.log('==================================================');
        rl.question('Enter your WhatsApp phone number with country code (e.g., 919876543210): ', async (phone) => {
            if (phone.trim() !== '') {
                try {
                    const pairingCode = await client.requestPairingCode(phone.trim());
                    console.log('\n✅ YOUR 8-DIGIT PAIRING CODE IS: ' + pairingCode);
                    console.log('Go to your primary phone: WhatsApp -> Linked Devices -> Link with phone number');
                    console.log('Enter the code exactly as shown above!');
                } catch (err) {
                    console.log('\n❌ Failed to get code. Ensure the number is correct. Error: ' + err.message);
                }
            } else {
                console.log('Skipping pairing code. Waiting for QR scan...');
            }
        });
    }, 1000); 
});


// --- FORCE PURE TERMINAL AUTHENTICATION ---
client.removeAllListeners('qr'); // Nuke the Web UI QR listener completely

const qrcodeTerminal = require('qrcode-terminal');
const readlinePair = require('readline');
const rlPair = readlinePair.createInterface({ input: process.stdin, output: process.stdout });

client.on('qr', (qr) => {
    console.log('\n==================================================');
    console.log('🔄 FRESH LOGIN REQUESTED');
    console.log('==================================================\n');
    
    // Force the QR to print to the terminal natively
    qrcodeTerminal.generate(qr, { small: true });

    setTimeout(() => {
        console.log('\n==================================================');
        console.log('📱 CAN\'T SCAN THE QR CODE? LET\'S USE A PAIRING CODE!');
        console.log('==================================================');
        rlPair.question('Enter your WhatsApp phone number with country code (e.g., 919876543210): ', async (phone) => {
            if (phone.trim() !== '') {
                try {
                    const pairingCode = await client.requestPairingCode(phone.trim());
                    console.log('\n✅ YOUR 8-DIGIT PAIRING CODE IS: ' + pairingCode);
                    console.log('Go to your primary phone: WhatsApp -> Linked Devices -> Link with phone number');
                } catch (err) {
                    console.log('\n❌ Failed to get code. Error: ' + err.message);
                }
            } else {
                console.log('Skipping pairing code. Waiting for QR scan...');
            }
        });
    }, 1500); 
});

client.initialize();
});

// ==========================================
// 5. MESSAGE HANDLING LOGIC
// ==========================================
// --- Message Deduplication Cache ---
const processedMessages = new Set();

// --- Global FIFO Queue Manager ---
const globalQueue = { isBusy: false, tasks: [] };

client.on('message', async (msg) => {
    const senderId = msg.from.split('@')[0];
    const isGroup = msg.from.includes('@g.us');

    // 1. Structural Integrity Check (Ghost Packet Filter)
    if (!msg.hasMedia && (!msg.body || msg.body.trim() === '')) {
        console.log(`\n👻 Ignored incomplete ghost packet: ${msg.id.id}`);
        sendTelegram(`👻 *Ghost Packet Blocked*\nPacket ID: \`${msg.id.id}\`\nStatus: Dropped. No WhatsApp reply sent.\n\n#Ghost #SystemLog`);
        return; 
    }

    // 2. Deduplication Check (Duplicate Packet Filter)
    if (processedMessages.has(msg.id._serialized)) {
        console.log(`\n♻️ Ignored duplicate network event for message: ${msg.id.id}`);
        sendTelegram(`♻️ *Duplicate Packet Blocked*\nPacket ID: \`${msg.id.id}\`\nStatus: Dropped. No WhatsApp reply sent.\n\n#Duplicate #SystemLog`);
        return;
    }
    processedMessages.add(msg.id._serialized);
    
    // Auto-clean cache after 1 hour to save Android RAM
    setTimeout(() => { processedMessages.delete(msg.id._serialized); }, 60 * 60 * 1000);
    
    let activeWhitelist = config.whitelist.split(',').map(id => id.trim()).filter(id => id);
    
    const contact = await msg.getContact();
    const senderName = contact.pushname || contact.name || 'Unknown User';
    const senderPhone = contact.number || 'Hidden';

    // FEATURE: Passphrase Auto-Whitelist (SILENT ON WHATSAPP)
    if (msg.body.startsWith('/id ')) {
        const providedPhrase = msg.body.split(' ')[1];
        if (config.passphraseEnabled && providedPhrase === config.passphrase) {
            if (!activeWhitelist.includes(senderId)) {
                activeWhitelist.push(senderId);
                config.whitelist = activeWhitelist.join(', ');
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); 
                
                await sendTelegram(`🎉 *New Whitelist User*\n👤 Name: ${senderName}\n📞 Phone: ${senderPhone}\n🆔 ID: \`${senderId}\`\n\n_User authorized themselves via Passphrase._\n\n#Whitelist #Update #Auth`);
            }
            return; 
        }
    }

    if (msg.body === '/id') {
        const idReport = `🔍 *#ID Request*\n👤 Name: ${senderName}\n📞 Phone: ${senderPhone}\n🆔 WA User ID: \`${senderId}\`\n\n#IDReport`;
        await sendTelegram(idReport);
        return; 
    }

    if (activeWhitelist.includes(senderId)) {
        const timestamp = new Date().toLocaleString();
        const charCount = msg.body ? msg.body.length : 20;
        // Silent delay based on message length + random jitter
        const readingDelayMs = ((charCount / 5) * 1000) + Math.floor(Math.random() * 4000) + 2000;
        const readingDelaySec = (readingDelayMs / 1000).toFixed(1);

        // --- FIFO Queue: Enqueue & Lock ---
        if (globalQueue.isBusy) {
            await sendTelegram(`🚦 *Message Enqueued*\n👤 User: ${senderName}\n📊 Current Queue Size: ${globalQueue.tasks.length + 1}\n\n#Queue #SystemLog`);
            await new Promise(resolve => {
                globalQueue.tasks.push({ senderName, unlock: resolve });
            });
        }
        globalQueue.isBusy = true; // Lock the system

        await sendTelegram(`⏳ *Silent Navigation*\n👤 User: ${senderName} (${senderPhone})\n⏱️ Read & Forward Delay: *${readingDelaySec}s*\n\n#Log`);

        const sourceChat = await msg.getChat();
        await sourceChat.sendSeen();
        await client.sendPresenceAvailable();
        await new Promise(r => setTimeout(r, readingDelayMs));
            try {
                const targetChatObj = await client.getChatById(config.targetChat);
                const targetChatName = targetChatObj.name || 'Target Group';

                let messageContent = msg.body || '';
                let mediaData = null;
                if (msg.hasMedia) {
                    mediaData = await msg.downloadMedia();
                    messageContent = msg.body ? `[Media Attached] ${msg.body}` : `[Media attached without text]`;
                }

                await msg.forward(config.targetChat);

                // --- 10 to 15 Second Dynamic Typing Simulator ---
                const typingDelayMs = Math.floor(Math.random() * 5000) + 10000;
                await sourceChat.sendStateTyping();
                await new Promise(r => setTimeout(r, typingDelayMs));
                await sourceChat.clearState();
                
                await client.sendPresenceUnavailable();
                await msg.reply(`Your message has been forwarded successfully to *${targetChatName}*!${FOOTER}`);

                const report = `✅ *Automation Success*\n👤 Sender: ${senderName}\n📞 Phone: ${senderPhone}\n🆔 ID: \`${senderId}\`\n📍 Group: ${targetChatName}\n⏱️ Delay Used: ${readingDelaySec}s\n\n📝 *Message:*\n${messageContent}\n\n#Success #Forwarded`;
                
                if (mediaData) await sendTelegramMedia(report, mediaData);
                else await sendTelegram(report); 

        // --- FIFO Queue: Advance & Unlock (Success) ---
        if (globalQueue.tasks.length > 0) {
            const nextTask = globalQueue.tasks.shift();
            
            // Random delay between 3000ms and 5000ms
            const cooldownMs = Math.floor(Math.random() * 2000) + 3000; 
            const cooldownSecStr = (cooldownMs / 1000).toFixed(3); 
            
            await sendTelegram(`🔄 *Queue Advancing*\n▶️ Next Message: ${nextTask.senderName}\n📊 Remaining in Queue: ${globalQueue.tasks.length}\n⏱️ Human Cooldown: ${cooldownSecStr}s\n\n#Queue #SystemLog`);

            setTimeout(() => { nextTask.unlock(); }, cooldownMs);
        } else {
            globalQueue.isBusy = false; // Unlock completely
        }
                
            } catch (error) {
                await sendTelegram(`❌ *Automation Failed*\n👤 From: ${senderName} (${senderPhone})\n⚠️ Error: ${error.message}\n\n#Fail`); 

        // --- FIFO Queue: Advance & Unlock (Error/Deleted Override) ---
        await sendTelegram(`🗑️ *Message Skipped*\nStatus: A message failed or was manually deleted. Safely unlocking queue.\n\n#Queue #SystemLog`);
        
        if (globalQueue.tasks.length > 0) {
            const nextTask = globalQueue.tasks.shift();
            const errorCooldownMs = Math.floor(Math.random() * 1000) + 1500; // Shorter 1.5s - 2.5s delay to recover
            setTimeout(() => { nextTask.unlock(); }, errorCooldownMs);
        } else {
            globalQueue.isBusy = false;
        }
            }
        
    } else {
        if (!isGroup) {
            await sendTelegram(`⚠️ *Non-Whitelist Message Received*\n👤 Name: ${senderName}\n📞 Phone: ${senderPhone}\n🆔 ID: \`${senderId}\`\n\n📝 *Content:*\n${msg.body || '[Media/File Attachment]'}\n\n#Alert #NonWhitelist`);
        }
    }
});

client.initialize();



// --- Unified Network & Heartbeat Manager ---
client.on('ready', () => {
    let isOffline = false;
    let offlineStartTime = null;
    let heartbeatTimer = null;

    // Non-blocking DNS Check (Bypasses Android OS freezing with a strict 5-second timeout)
    const checkInternet = () => {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(false), 5000);
            require('dns').resolve('api.telegram.org', (err) => {
                clearTimeout(timer);
                resolve(!err);
            });
        });
    };

    // The Subordinate Heartbeat Loop
    const runHeartbeat = () => {
        const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`\n➡️ [${time}] System Heartbeat: Server is active and connected to the internet.`);
        
        if (config.telegramHeartbeat !== false) {
            sendTelegram(`🟢 *System Heartbeat:* Bot is actively listening at ${time}`).catch(() => {});
            console.log("   └─ Telegram notification sent!");
        } else {
            console.log("   └─ Telegram notification skipped (Disabled via Web UI).");
        }
    };

    // The Master Watchdog Loop
    const runWatchdog = async () => {
        const isConnected = await checkInternet();
        const timeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

        if (!isConnected && !isOffline) {
            // EVENT: Network Drops
            isOffline = true;
            offlineStartTime = new Date();
            
            console.log(`\n🔴 [${timeStr}] NETWORK DROPPED: Server lost internet connection!`);
            exec('termux-notification --id "bot_net_alert" --title "🔴 Bot Offline" --content "Internet dropped. Heartbeat suspended." --priority max --sound', () => {});
            console.log(`   └─ Heartbeat suspended until network restores.`);
            
            // Kill the heartbeat
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        } 
        else if (isConnected && isOffline) {
            // EVENT: Network Restores
            isOffline = false;
            const recoveryTime = new Date();
            
            // Calculate Downtime Math
            let durationStr = "Unknown";
            let offlineTimeStr = "Unknown";
            if (offlineStartTime) {
                offlineTimeStr = offlineStartTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                const diffMs = recoveryTime - offlineStartTime;
                const diffMins = Math.floor(diffMs / 60000);
                const diffSecs = Math.floor((diffMs % 60000) / 1000);
                durationStr = diffMins > 0 ? `${diffMins}m ${diffSecs}s` : `${diffSecs}s`;
            }
            
            console.log(`\n🟢 [${timeStr}] NETWORK RECOVERED: Internet connection is back online!`);
            exec('termux-notification-remove bot_net_alert', () => {});
            console.log(`   └─ Downtime: ${durationStr} (Offline since: ${offlineTimeStr})`);
            console.log(`   └─ Resuming Heartbeat module.`);

            // Mandatory Recovery Ping (Bypasses UI Toggle completely)
            const alertMsg = `✅ *Network Recovered*\nServer internet connection restored at ${timeStr}\n⏱️ *Downtime:* ${durationStr} (Went offline at ${offlineTimeStr})\n\n#Network #SystemLog`;
            sendTelegram(alertMsg).catch(() => {});

            // Restart the Heartbeat Loop
            heartbeatTimer = setInterval(runHeartbeat, 10 * 60 * 1000);
        }
    };

    // Boot Sequence: Start the timers
    heartbeatTimer = setInterval(runHeartbeat, 10 * 60 * 1000);
    setInterval(runWatchdog, 30000);
});
