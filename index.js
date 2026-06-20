/**
 * RAJPOOT BOT MD — Launcher
 * GitHub pe sirf yeh file hai — asli code CDN se aata hai
 */

require('dotenv').config();
const crypto = require('crypto');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');

// ============================================
//   USER CONFIG — Yahan apni info dalo
// ============================================
const USER_CONFIG = {
    owner_name:    process.env.OWNER_NAME    || "My Bot",
    owner_number:  process.env.OWNER_NUMBER  || "92300XXXXXXX",
    bot_name:      process.env.BOT_NAME      || "RAJPOOT BOT MD",
    telegram_token: process.env.TELEGRAM_BOT_TOKEN || "",
    openai_key:    process.env.OPENAI_API_KEY || "",
    port:          process.env.PORT           || 3000,
    app_url:       process.env.APP_URL        || ""
};

// ============================================
//   CDN CONFIG — Yahan CDN token dalo
// ============================================
const CDN_URL   = process.env.CDN_URL   || "http://fi13.bot-hosting.cloud:21118";
const CDN_TOKEN = process.env.CDN_TOKEN || "";
const CDN_SECRET = process.env.CDN_SECRET || "";

// ============================================
//   DECRYPTION
// ============================================
function decrypt(text) {
    const [ivHex, encrypted] = text.split(':');
    const iv  = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(CDN_SECRET, 'rajpoot_salt_v2', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let dec = decipher.update(encrypted, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
}

// ============================================
//   WRITE FILES TO TEMP DIR
// ============================================
function writeFiles(files, baseDir) {
    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(baseDir, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
    }
}

// ============================================
//   MERGE CONFIG
//   allow_github_config = false → CDN config wins
//   allow_github_config = true  → User config applies
// ============================================
function mergeConfig(cdnConfig, userConfig, allowGithub) {
    if (!allowGithub) {
        // CDN config lock — user github config ignore
        console.log('🔒 Config locked by CDN — GitHub config ignored');
        return {
            ...cdnConfig,
            // Only these user-specific things are always allowed
            telegram_token: userConfig.telegram_token,
            openai_key: userConfig.openai_key,
            port: userConfig.port,
            app_url: userConfig.app_url
        };
    } else {
        // User config allowed
        console.log('🔓 GitHub config enabled');
        return {
            ...cdnConfig,
            owner_name:   userConfig.owner_name   || cdnConfig.owner_name,
            owner_number: userConfig.owner_number || cdnConfig.owner_number,
            bot_name:     userConfig.bot_name     || cdnConfig.bot_name,
            telegram_token: userConfig.telegram_token,
            openai_key: userConfig.openai_key,
            port: userConfig.port,
            app_url: userConfig.app_url
        };
    }
}

// ============================================
//   MAIN LAUNCHER
// ============================================
async function launch() {
    console.log('');
    console.log('╔═══════════════════════════════════╗');
    console.log('║      RAJPOOT BOT MD v2.0          ║');
    console.log('║      Fetching from CDN...         ║');
    console.log('╚═══════════════════════════════════╝');
    console.log('');

    if (!CDN_TOKEN || !CDN_SECRET) {
        console.error('❌ CDN_TOKEN or CDN_SECRET missing in .env!');
        console.error('   Get these from the bot owner.');
        process.exit(1);
    }

    // Fetch source from CDN
    let payload;
    try {
        console.log(`📡 Connecting to CDN: ${CDN_URL}`);
        const res = await axios.get(`${CDN_URL}/api/source`, {
            headers: { 'x-cdn-token': CDN_TOKEN },
            timeout: 30000
        });

        if (!res.data?.success) throw new Error('CDN returned error');

        const decrypted = decrypt(res.data.data);
        payload = JSON.parse(decrypted);
        console.log(`✅ Source fetched! Version: ${payload.version}`);
    } catch (err) {
        console.error('❌ CDN fetch failed:', err.message);
        console.error('   Check CDN_URL, CDN_TOKEN, CDN_SECRET in your .env');
        process.exit(1);
    }

    // Merge configs
    const finalConfig = mergeConfig(
        payload.config,
        USER_CONFIG,
        payload.allow_github_config
    );

    // Write files to temp directory
    const tmpDir = path.join(os.tmpdir(), 'rajpoot-bot-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    writeFiles(payload.files, tmpDir);
    console.log(`📁 Files written to: ${tmpDir}`);

    // Write merged config for the bot to use
    const configPath = path.join(tmpDir, 'cdn-config.json');
    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));

    // Set env vars for the bot
    process.env.BOT_OWNER_NAME   = finalConfig.owner_name;
    process.env.BOT_OWNER_NUMBER = finalConfig.owner_number;
    process.env.BOT_NAME         = finalConfig.bot_name;
    process.env.CHANNEL_JID      = finalConfig.channel_jid || '';
    process.env.SUPPORT_GROUP    = finalConfig.support_group || '';
    process.env.PORT              = finalConfig.port;
    process.env.APP_URL           = finalConfig.app_url;
    process.env.CDN_CONFIG_PATH  = configPath;

    // Launch the actual bot
    console.log('🚀 Launching bot...');
    const botMain = path.join(tmpDir, 'index.js');
    if (!fs.existsSync(botMain)) {
        console.error('❌ Bot index.js not found in CDN payload!');
        process.exit(1);
    }

    require(botMain);
}

launch().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
