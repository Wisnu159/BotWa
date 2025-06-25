// index.js
require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { OpenAI } = require('openai');
const knowledgeBase = require('./knowledge');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

const userSessions = {};

client.on('qr', qr => {
    console.log('Scan QR berikut dengan WhatsApp kamu:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot aktif dan siap menerima pesan!');
});

// GPT dengan error handling aman
async function askGPT(text) {
    try {
        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: text }],
        });
        return res.choices[0].message.content;
    } catch (err) {
        console.error('❌ GPT error:', err?.message || err);
        return null; // balikkan null jika error (misal saldo habis)
    }
}

function checkKnowledge(text) {
    text = text.toLowerCase();
    return knowledgeBase.find(item =>
        item.keywords.some(k => text.includes(k))
    );
}

// Fungsi kirim menu
async function sendMenu(to) {
    await client.sendMessage(to, {
        text: 'Silakan pilih layanan:',
        buttons: [
            { type: 'replyButton', reply: { id: 'info_produk', title: '💡 Info Produk' } },
            { type: 'replyButton', reply: { id: 'cek_order', title: '📦 Cek Order' } },
            { type: 'replyButton', reply: { id: 'kontak_cs', title: '📞 Kontak CS' } }
        ],
        footer: 'Pilih salah satu layanan',
        header: 'Menu Utama'
    });
}

client.on('message', async (msg) => {
    const text = msg.body.toLowerCase();
    const sender = msg.from;

    // Munculkan menu jika user baru
    if (!userSessions[sender]) {
        await sendMenu(sender);
        userSessions[sender] = { lastInteraction: Date.now() };
        return;
    }

    // User ketik 'menu'
    if (text === 'menu') {
        await sendMenu(sender);
        return;
    }

    // Tombol menu
    if (text === 'info_produk' || text === '💡 info produk') {
        return client.sendMessage(sender, 'Produk kami: Internet, CCTV, jaringan kantor, instalasi rumah.');
    }

    if (text === 'cek_order' || text === '📦 cek order') {
        return client.sendMessage(sender, 'Ketik "CekOrder [nomor]" untuk status order Anda.');
    }

    if (text === 'kontak_cs' || text === '📞 kontak cs') {
        return client.sendMessage(sender, 'Silakan hubungi CS kami di 0822-xxxx-xxxx (WhatsApp & Telepon).');
    }

    // Knowledge TA Cilacap
    const knowledge = checkKnowledge(text);
    if (knowledge) {
        await client.sendMessage(sender, knowledge.response);
        if (knowledge.image) {
            const media = MessageMedia.fromFilePath(knowledge.image);
            await client.sendMessage(sender, media);
        }
        return;
    }

    // 🔁 GPT untuk pertanyaan lain
    const reply = await askGPT(text);
    if (reply) {
        await client.sendMessage(sender, reply);
    } else {
        await client.sendMessage(sender, 'Saat ini bot belum bisa menjawab pertanyaan ini. Silakan coba lagi nanti atau ketik *menu*.');
    }
});

client.initialize();
