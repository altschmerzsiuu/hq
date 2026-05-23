require("dotenv").config(); // Load environment variables
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const db = require("./database");
const cron = require('node-cron');
const axios = require('axios');
const path = require('path');
const dayjs = require("dayjs");
const e = require("express");
const utc = require("dayjs/plugin/utc");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const timezone = require("dayjs/plugin/timezone");

const app = express();
const port = process.env.PORT || 3003;

// Ambil variabel dari .env
const token = process.env.TELEGRAM_BOT_TOKEN;
// const bot = new TelegramBot(token, { polling: true }); // Dipindahkan ke bawah

// Initialize Supabase if credentials are available
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_KEY;
// const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// const allowedChatIds = process.env.TELEGRAM_CHAT_IDS ? process.env.TELEGRAM_CHAT_IDS.split(",").map(id => id.trim()) : [];
const allowedChatIds = process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim());

// Cek konfigurasi
if (!token || !process.env.DATABASE_URL) {
    console.error("❌ Konfigurasi .env tidak lengkap!");
    console.error("   Pastikan TELEGRAM_BOT_TOKEN dan DATABASE_URL sudah diisi.");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Hapus Webhook jika ada sisa-sisa (Best Practice untuk Dev Bot)
bot.deleteWebHook().then(() => {
    console.log("cwl -> Polling Telegram dimulai...");
});

cron.schedule('0 0 * * *', () => {
    console.log("⏰ Menjalankan reset harian...");

    messageHistory.forEach((messageIds, chatId) => {
        messageIds.forEach(messageId => {
            bot.deleteMessage(chatId, messageId).catch(err => {
                console.log(`❌ Gagal hapus pesan ${messageId} di chat ${chatId}:`, err.response?.body || err.message);
            });
        });
    });

    // Kosongkan riwayat pesan setelah dihapus
    messageHistory.clear();
});

app.use(express.json());

const URL = "https://iot-peternakaan-kandang.onrender.com";
// bot.setWebHook(`${URL}/bot${token}`); // <-- Matikan ini biar gak kirim ke Render
bot.deleteWebHook(); // <-- Paksa hapus hook lama biar balik ke Polling (Local)

// Status scan RFID per user
const userScanStatus = new Map();
const userRegisterStatus = new Map();
const userRegisterData = new Map();
const userDeleteStatus = new Map();
const userSearchStatus = new Map();
const userEditStatus = new Map();
const userEditField = new Map();
const userEditTemp = new Map();
const messageHistory = new Map();
const userReproStatus = new Map();
const userReproData = new Map();
const userDeleteReproStatus = new Map();

// ===================================== START OF FUNCTIONS ==============================================
function isAllowed(chatId) {
    return allowedChatIds.includes(chatId.toString());
}

function resetUserState(chatId) {
    userScanStatus.delete(chatId);
    userRegisterStatus.delete(chatId);
    userRegisterData.delete(chatId);
}

function sendTemporaryMessage(chatId, text, duration) {
    bot.sendMessage(chatId, text).then((sentMessage) => {
        setTimeout(() => {
            bot.deleteMessage(chatId, sentMessage.message_id).catch(error => {
                console.error("Gagal menghapus pesan:", error);
            });
        }, duration);
    });
}

function isValidTanggal(tanggal) {
    // Cek format dd/mm/yyyy dengan regex
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(tanggal)) {
        return false;
    }
    // Cek apakah tanggal valid dengan dayjs
    const [dd, mm, yyyy] = tanggal.split("/");
    const date = dayjs(`${yyyy}-${mm}-${dd}`, "YYYY-MM-DD", true);
    return date.isValid();
}

function formatTanggal(tanggal) {
    if (!tanggal) return "-";

    let parsedDate;
    if (tanggal instanceof Date) {
        parsedDate = dayjs(tanggal);
    } else {
        parsedDate = dayjs(tanggal, ['YYYY-MM-DD', 'DD/MM/YYYY'], true);
    }

    return parsedDate.isValid() ? parsedDate.format('DD/MM/YYYY') : "-";
}

function formatUsia(usiaBulan) {
    if (typeof usiaBulan !== 'number' || usiaBulan < 0) return "Usia tidak valid";

    const tahun = Math.floor(usiaBulan / 12);
    const bulan = usiaBulan % 12;

    if (tahun === 0) return `${bulan} bulan`;
    if (bulan === 0) return `${tahun} tahun`;
    return `${tahun} tahun ${bulan} bulan`;
}

function resetUserState(chatId) {
    userRegisterStatus.delete(chatId);
    userScanStatus.delete(chatId);
    userSearchStatus.delete(chatId);
    userEditStatus.delete(chatId);
    userEditTemp.delete(chatId);
    userEditField.delete(chatId);
}

function sendAndTrackWithOptionalDelete(chatId, text, options = {}, duration = null) {
    if (!text || text.trim() === "") {
        text = "\u200B"; // zero-width space, supaya gak error
    }
    return bot.sendMessage(chatId, text, options).then(sent => {
        if (!messageHistory.has(chatId)) messageHistory.set(chatId, []);
        messageHistory.get(chatId).push(sent.message_id);

        if (duration) {
            setTimeout(() => {
                bot.deleteMessage(chatId, sent.message_id).catch(error => {
                    console.error("Gagal menghapus pesan:", error);
                });
            }, duration);
        }

        return sent;
    });
}

function hitungUsiaBulan(tanggalLahir) {
    if (!isValidTanggal(tanggalLahir)) return 0;

    const [dd, mm, yyyy] = tanggalLahir.split('/').map(Number);
    const lahir = dayjs(`${yyyy}-${mm}-${dd}`);
    const sekarang = dayjs();

    // Hitung selisih bulan dengan koreksi hari
    let bulan = sekarang.diff(lahir, 'month');
    if (sekarang.date() < lahir.date()) {
        bulan--;
    }

    return Math.max(0, bulan);
}

function isValidDateFormat(text) {
    const parts = text.split("/");
    if (parts.length !== 3) return false;

    const [dd, mm, yyyy] = parts.map(Number);
    const day = parseInt(dd), month = parseInt(mm), year = parseInt(yyyy);

    if (
        isNaN(day) || isNaN(month) || isNaN(year) ||
        day < 1 || day > 31 ||
        month < 1 || month > 12 ||
        year < 2000 || year > new Date().getFullYear()
    ) {
        return false;
    }

    // Cek tanggal valid (contoh 30 Februari = invalid)
    const dateObj = new Date(`${yyyy}-${mm}-${dd}`);
    return dateObj.getDate() === day &&
        dateObj.getMonth() + 1 === month &&
        dateObj.getFullYear() === year;
}

function calculateAgeInYears(monthYearStr) {
    // Add null/undefined check
    if (!monthYearStr) {
        console.error("Error: monthYearStr is null or undefined");
        return 0; // or whatever default value makes sense for your application
    }

    try {
        const [day, month, year] = monthYearStr.split("/").map(Number);

        // Validate the date components
        if (isNaN(day) || isNaN(month) || isNaN(year) ||
            month < 1 || month > 12 ||
            day < 1 || day > 31) {
            console.error("Error: Invalid date components in monthYearStr");
            return 0;
        }

        const birthDate = new Date(year, month - 1, day);
        const today = new Date();

        // Check if the date is valid
        if (isNaN(birthDate.getTime())) {
            console.error("Error: Invalid date created from monthYearStr");
            return 0;
        }

        const yearDiff = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();

        let totalMonths = yearDiff * 12 + monthDiff;

        // Adjust if the birth date hasn't occurred yet this month
        if (dayDiff < 0) {
            totalMonths--;
        }

        const ageInYears = totalMonths / 12;
        return parseFloat(ageInYears.toFixed(2));
    } catch (error) {
        console.error("Error in calculateAgeInYears:", error);
        return 0;
    }
}

// Fungsi untuk tampilkan Main Menu
function showMainMenu(chatId) {
    sendAndTrackWithOptionalDelete(chatId, "⚡️ Pilih tindakan:", {
        reply_markup: {
            keyboard: [
                ["📡 Scan RFID", "🔽 Opsi Tambahan"]
            ],
            resize_keyboard: true
        }
    }, 600000);
}

// SYNC TO SHEETS PROFIL TERNAK 
async function syncToSheet(data, type) {
    // Handled purely by FastAPI Backend now!
    console.log("⏩ syncToSheet di-bypass, dijalankan via FastAPI.");
}

async function deleteRowByRFID(rfid) {
    // Handled purely by FastAPI Backend now!
    console.log("⏩ deleteRowByRFID di-bypass, dijalankan via FastAPI.");
}

async function editRowByRFID(newData) {
    // Handled purely by FastAPI Backend now!
    console.log("⏩ editRowByRFID di-bypass, dijalankan via FastAPI.");
}

// Fungsi cari baris RFID (sama seperti sebelumnya)
async function findRowByRFID(rfid, spreadsheetId, authClient) {
    // Handled purely by FastAPI Backend now!
    return -1;
}

// ===================================== END OF FUNCTIONS ==============================================

// MAIN MENU
bot.onText(/\/database/, (msg) => {
    const chatId = msg.chat.id;
    sendTemporaryMessage(chatId, `📊 Ini link ke database hewan kamu:\n\nhttps://docs.google.com/spreadsheets/d/11qQVDvy1UCch54Ri-4vd826FxnWm4nduLSSfp5EfXc4/edit?usp=sharing`, 20000);
});

bot.onText(/\/rh (.+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    const query = match[1].trim();

    if (!isAllowed(chatId)) {
        sendTemporaryMessage(chatId, 'Maaf, Anda tidak memiliki akses.', 50000);
        return;
    }

    let result;
    if (/^[0-9A-Fa-f]+$/.test(query)) {
        const { data, error } = await db.select('hewan', '*', { id: query.toUpperCase() });
        if (error) {
            sendTemporaryMessage(chatId, `❌ Error: ${error.message}`, 30000);
            return;
        }
        result = { rows: data };
    } else {
        const { data, error } = await db.select('hewan', '*', { nama: { like: `%${query.toLowerCase()}%` } });
        if (error) {
            sendTemporaryMessage(chatId, `❌ Error: ${error.message}`, 30000);
            return;
        }
        result = { rows: data };
    }

    if (result.rows.length === 0) {
        sendTemporaryMessage(chatId, "❌ Hewan tidak ditemukan.", 40000);
        return;
    }

    if (result.rows.length === 1) {
        const hewan = result.rows[0];
        const { data, error } = await db.select('reproduksi_ternak', '*', { rfid: hewan.id });
        if (error) {
            sendTemporaryMessage(chatId, `❌ Error: ${error.message}`, 30000);
            return;
        }
        const riwayat = { rows: data };

        if (riwayat.rows.length === 0) {
            sendTemporaryMessage(chatId, `📭 Tidak ada riwayat reproduksi untuk hewan ini.`, 30000);
            return;
        }

        userDeleteReproStatus.set(chatId, { step: "konfirmasi", rfid: hewan.id });

        sendAndTrackWithOptionalDelete(
            chatId,
            `⚠️ Ditemukan ${riwayat.rows.length} riwayat reproduksi untuk:\n\n` +
            `<pre>` +
            `📌 Nama: ${hewan.nama}\n` +
            `🆔 RFID: ${hewan.id}\n` +
            `</pre>\n` +
            `Apakah kamu yakin ingin <b>menghapus semua riwayat</b> ini?\n` +
            `<i>Data profil tidak akan terhapus.</i>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Ya Deh, Hapus Aja!", callback_data: `rmv_repro_${hewan.id}` }],
                        [{ text: "❌ Gak Dulu", callback_data: "cancel_rmvhistory" }]
                    ]
                }
            },
            150000
        );
    } else {
        const opsi = result.rows.map(h => [{
            text: `${h.nama} - ${h.id}`,
            callback_data: `rmv_repro_${h.id}`
        }]);

        sendAndTrackWithOptionalDelete(chatId,
            `🔍 Ditemukan beberapa hewan dengan nama serupa. Pilih salah satu:`, {
            reply_markup: { inline_keyboard: opsi }
        }, 120000
        );
    }
});

bot.onText(/\/template/, (msg) => {
    const chatId = msg.chat.id;

    sendAndTrackWithOptionalDelete(
        chatId,
        `📝 Copy format input berikut untuk mengedit semua data:

\`\`\`
Nama: 
Jenis: 
Lahir: 
Kesehatan: 
Tanggal IB: 
Pemberi IB: 
Jumlah IB: 
Bunting: 
HPL: 
Sapih: 
Birahi: 
Catatan: 
\`\`\`

ℹ️ *Catatan Penting*:
• Jika *Tanggal Birahi* diisi, maka *Tanggal Bunting* dan *HPL* akan dihitung secara otomatis\\.
• Namun, bisa juga mengisi *Tanggal Bunting* dan *HPL* secara manual jika ingin\\.
• Untuk mengosongkan salah satu data atau tetap dengan data yang sama, cukup gunakan tanda strip: \`-\`

Contoh:
\`\`\`
Bunting: -
HPL: -
\`\`\``,
        { parse_mode: "MarkdownV2" },
        70000
    );
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
🐮 <b>Bot Pencatatan Ternak</b> - <i>v1.3.0</i>

Selamat datang di sistem pencatatan ternak! Berikut daftar perintah yang bisa digunakan:

📋 <b>Manajemen Data</b>
• <code>/mm atau /back</code> — Jika sewaktu-waktu tombol hilang, ketik perintah tersebut untuk kembali ke menu utama
• <code>/database</code> — Link ke Google Sheet database
• <code>/template</code> — Format input lengkap untuk salin/edit
• <code>/rh &lt;nama atau ID&gt;</code> — Hapus semua riwayat reproduksi hewan

💡 <b>Tips:</b>
• /mm (Main Menu) - /rh (Remove History).
• Untuk edit data, salin template, ubah, lalu kirim kembali ke bot atau bisa edit satu-per-satu berdasarkan tombol yang tersedia
• Bot ini hanya bisa digunakan oleh user yang diizinkan.
    `;

    bot.sendMessage(chatId, helpMessage, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📊 Buka Database", url: "https://docs.google.com/spreadsheets/d/11qQVDvy1UCch54Ri-4vd826FxnWm4nduLSSfp5EfXc4/edit?usp=sharing" }
                ],
                [
                    { text: "🛠 Cek Versi", callback_data: "show_version" }
                ]
            ]
        }
    }, 300000);
});

// Handler untuk /mm dan /kembali
bot.onText(/\/(mm|back)/, (msg) => {
    const chatId = msg.chat.id;
    showMainMenu(chatId);
});

// Menampilkan tombol "Start" untuk user baru
bot.on("message", async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (!isAllowed(chatId)) {
        sendTemporaryMessage(chatId, 'Maaf, Anda tidak memiliki akses.', 50000);
        return;
    }

    // ========================= MENU UTAMA =========================
    if (msg.text === "/start") {
        sendAndTrackWithOptionalDelete(chatId, "Selamat datang!👋 Tekan tombol Start untuk melanjutkan.", {
            reply_markup: {
                keyboard: [["▶ Start"]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    } else if (msg.text === "▶ Start") {
        sendAndTrackWithOptionalDelete(chatId, "⚡ Pilih tindakan:", {
            reply_markup: {
                keyboard: [["📡 Scan RFID", "🔽 Opsi Tambahan"]],
                resize_keyboard: true
            }
        }, 600000);

        // ========================= FLOW SCAN RFID =========================
    } else if (msg.text === "📡 Scan RFID") {
        userScanStatus.set(chatId, true); // Set status bahwa user sedang dalam mode scan
        console.log(`[DEBUG] User ${chatId} activated Scan Mode. Map keys: ${JSON.stringify([...userScanStatus.keys()])}`);
        sendAndTrackWithOptionalDelete(chatId, "🔷 Silahkan scan kartu Anda...", {
            reply_markup: {
                keyboard: [["🔙 Kembali"]],
                resize_keyboard: true
            }
        }, 600000);

    } else if (msg.text === "🔙 Kembali") {
        // Jika user sedang dalam mode input data hewan (flow Tambah Hewan)
        if (userRegisterStatus.has(chatId)) {
            resetUserState(chatId); // Reset state registrasi
            userScanStatus.set(chatId, true); // Kembalikan ke mode scan RFID
            sendAndTrackWithOptionalDelete(chatId, "🔷 Silahkan scan kartu Anda...", {
                reply_markup: {
                    keyboard: [["🔙 Kembali"]],
                    resize_keyboard: true
                }
            }, 200000);
        }
        // Jika user sedang dalam mode pendaftaran hewan
        else if (userScanStatus.has(chatId)) {
            resetUserState(chatId); // Reset semua status
            sendAndTrackWithOptionalDelete(chatId, "⚡ Pilih tindakan:", {
                reply_markup: {
                    keyboard: [["📡 Scan RFID", "🔽 Opsi Tambahan"]],
                    resize_keyboard: true
                }
            }, 200000);
        }
        // Jika user tidak dalam mode apa pun, kembali ke menu utama
        else {
            resetUserState(chatId);
            sendAndTrackWithOptionalDelete(chatId, "⚡ Pilih tindakan:", {
                reply_markup: {
                    keyboard: [["📡 Scan RFID", "🔽 Opsi Tambahan"]],
                    resize_keyboard: true
                }
            }, 200000);
        }

        // ========================= FLOW HAPUS RFID =========================
    } else if (text === "🗑 Hapus Data") {
        sendAndTrackWithOptionalDelete(chatId, "⚠️ Masukkan RFID atau Nama hewan yang ingin dihapus:", {}, 200000);
        userDeleteStatus.set(chatId, "waiting_for_input");
    } else if (userDeleteStatus.get(chatId) === "waiting_for_input") {
        const input = text.trim(); // Hapus spasi ekstra
        let result;

        if (/^[0-9A-Fa-f]+$/.test(input)) {
            // Cari hewan berdasar ID
            const { data: hewanData, error: hewanError } = await db.select('hewan', '*', { id: input.toUpperCase() });
            if (hewanError) {
                sendTemporaryMessage(chatId, `❌ Error: ${hewanError.message}`, 30000);
                userDeleteStatus.delete(chatId);
                return;
            }
            result = { rows: hewanData };
        } else {
            // Cari hewan berdasar nama (case insensitive)
            const { data: hewanData, error: hewanError } = await db.select('hewan', '*', { nama: { like: `%${input}%` } });
            if (hewanError) {
                sendTemporaryMessage(chatId, `❌ Error: ${hewanError.message}`, 30000);
                userDeleteStatus.delete(chatId);
                return;
            }
            result = { rows: hewanData };
        }

        if (result.rows.length === 0) {
            sendTemporaryMessage(chatId, "❌ Hewan dengan identitas tersebut tidak ditemukan.", 50000);
            userDeleteStatus.delete(chatId);
            return;
        }

        if (result.rows.length === 1) {
            const hewan = result.rows[0];

            // Query reproduksi_ternak untuk hewan ini, urut tanggal_ib DESC limit 1
            const { data: reproData, error: reproError } = await db.select('reproduksi_ternak', '*', { rfid: hewan.id }, { orderBy: { column: 'tanggal_ib', ascending: false }, limit: 1 });
            if (reproError) {
                sendTemporaryMessage(chatId, `❌ Error: ${reproError.message}`, 30000);
                userDeleteStatus.delete(chatId);
                return;
            }
            const repro = reproData.length > 0 ? reproData[0] : {};

            // Query riwayat_reproduksi untuk hewan ini, ambil 1 data saja
            const { data: riwayatData, error: riwayatError } = await db.select('riwayat_reproduksi', '*', { rfid: hewan.id }, { limit: 1 });
            if (riwayatError) {
                sendTemporaryMessage(chatId, `❌ Error: ${riwayatError.message}`, 30000);
                userDeleteStatus.delete(chatId);
                return;
            }
            const riwayat = riwayatData.length > 0 ? riwayatData[0] : {};

            // Gabungkan data reproduksi dan riwayat ke objek hewan supaya kode kamu bisa tetap pakai hewan.tanggal_ib dll
            const hewanWithRepro = {
                ...hewan,
                tanggal_ib: repro.tanggal_ib,
                pemberi_ib: repro.pemberi_ib,
                jumlah_ib: repro.jumlah_ib,
                bunting: repro.bunting,
                hpl: repro.hpl,
                sapih: repro.sapih,
                birahi: repro.birahi,
                catatan: repro.catatan || riwayat.catatan || null,
            };

            // Hitung ulang usia dalam bulan dari bulan_tahun_lahir untuk formatUsia
            const usiaBulan = hitungUsiaBulan(hewanWithRepro.bulan_tahun_lahir);
            const formatKosong = "Datanya belum ada nih...";

            sendAndTrackWithOptionalDelete(chatId,
                `🔴 Anda yakin ingin menghapus data ini?\n\n` +
                "<pre>" +
                `🐄 <b>Profil Ternak</b>\n\n` +
                `📌 Nama        : ${hewanWithRepro.nama}\n` +
                `🆔 RFID        : ${hewanWithRepro.id}\n` +
                `⚖️ Jenis       : ${hewanWithRepro.jenis}\n` +
                `💡 Lahir       : ${hewanWithRepro.bulan_tahun_lahir}\n` +
                `💉 Usia        : ${formatUsia(usiaBulan)}\n` +
                `🩺 Kesehatan   : ${hewanWithRepro.status_kesehatan || "Tidak ada catatan"}\n\n\n\n` +

                `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                `📆 Tanggal IB  : ${formatTanggal(hewanWithRepro.tanggal_ib) || formatKosong}\n` +
                `👤 Pemberi IB  : ${hewanWithRepro.pemberi_ib || formatKosong}\n` +
                `➕ Jumlah IB   : ${hewanWithRepro.jumlah_ib ? `Inseminasi Buatan ke-${hewanWithRepro.jumlah_ib}` : formatKosong}\n` +
                `🐂 Birahi      : ${formatTanggal(hewanWithRepro.birahi) || formatKosong}\n` +
                `🤰 Bunting     : ${formatTanggal(hewanWithRepro.bunting) || formatKosong}\n` +
                `🗓 HPL         : ${formatTanggal(hewanWithRepro.hpl) || formatKosong}\n` +
                `🐖 Sapih       : ${formatTanggal(hewanWithRepro.sapih) || formatKosong}\n` +
                `📝 Catatan     : ${hewanWithRepro.catatan || formatKosong}\n` +
                "</pre>" +
                `📋 Silakan pilih opsi di bawah ini:`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "✅ Ya, Hapus", callback_data: `delete_${hewanWithRepro.id}` }],
                            [{ text: "❌ Batal", callback_data: "cancel_delete" }]
                        ]
                    }
                }, 200000
            );

            await sendAndTrackWithOptionalDelete(chatId, "💭 Pilih menu dulu, yuk!", {
                reply_markup: {
                    keyboard: [
                        ["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"],
                        ["🔙 Kembali"]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }, 150000);

            userReproData.set(chatId, { id_hewan: hewanWithRepro.id });
            userDeleteStatus.delete(chatId);

        } else {
            // Kalau ketemu lebih dari 1
            let options = result.rows.map(h => [{
                text: `${h.nama} - ${h.id} - ${h.jenis}`,
                callback_data: `delete_${h.id}`
            }]);
            sendAndTrackWithOptionalDelete(chatId, "⚠️ Ditemukan beberapa hewan dengan nama yang sama. Pilih hewan yang ingin dihapus:", {
                reply_markup: { inline_keyboard: options }
            }, 150000);
            userDeleteStatus.delete(chatId);
        }

    } else if (msg.text === "🔽 Opsi Tambahan") {
        sendAndTrackWithOptionalDelete(chatId, "⚙️ Pilih tindakan:", {
            reply_markup: {
                keyboard: [["🔍 Cari Data", "🗑 Hapus Data"], ["🔙 Kembali"]],
                resize_keyboard: true
            }
        }, 200000);


        // ========================= FLOW CARI DATA =========================
    } else if (text === "🔍 Cari Data") {
        sendAndTrackWithOptionalDelete(chatId, "🔎 Masukkan nama atau RFID hewan terkait...", {}, 150000);
        userSearchStatus.set(chatId, "waiting_for_input");
    } else if (userSearchStatus.get(chatId) === "waiting_for_input") {
        const input = text.trim();
        let result;

        if (/^[0-9A-Fa-f]+$/.test(input)) {
            // Cari hewan berdasar ID
            const { data: hewanData, error: hewanError } = await db.select('hewan', '*', { id: input.toUpperCase() });
            if (hewanError) {
                sendTemporaryMessage(chatId, `❌ Error: ${hewanError.message}`, 30000);
                userSearchStatus.delete(chatId);
                return;
            }
            result = { rows: hewanData };
        } else {
            // Cari hewan berdasar nama (case insensitive)
            const { data: hewanData, error: hewanError } = await db.select('hewan', '*', { nama: { like: `%${input}%` } });
            if (hewanError) {
                sendTemporaryMessage(chatId, `❌ Error: ${hewanError.message}`, 30000);
                userSearchStatus.delete(chatId);
                return;
            }
            result = { rows: hewanData };
        }

        if (result.rows.length === 0) {
            sendTemporaryMessage(chatId, "❌ Hewan dengan identitas tersebut tidak ditemukan.", 50000);
            userSearchStatus.delete(chatId);
            return;
        }

        if (result.rows.length === 1) {
            const hewan = result.rows[0];

            // Query reproduksi_ternak untuk hewan ini, urut tanggal_ib DESC limit 1
            const { data: reproData, error: reproError } = await db.select('reproduksi_ternak', '*', { rfid: hewan.id }, { orderBy: { column: 'tanggal_ib', ascending: false }, limit: 1 });
            if (reproError) {
                sendTemporaryMessage(chatId, `❌ Error: ${reproError.message}`, 30000);
                userSearchStatus.delete(chatId);
                return;
            }
            const repro = reproData.length > 0 ? reproData[0] : {};

            // Query riwayat_reproduksi untuk hewan ini, ambil 1 data saja
            const { data: riwayatData, error: riwayatError } = await db.select('riwayat_reproduksi', '*', { rfid: hewan.id }, { limit: 1 });
            if (riwayatError) {
                sendTemporaryMessage(chatId, `❌ Error: ${riwayatError.message}`, 30000);
                userSearchStatus.delete(chatId);
                return;
            }
            const riwayat = riwayatData.length > 0 ? riwayatData[0] : {};

            // Gabungkan data reproduksi dan riwayat ke objek hewan
            const hewanWithRepro = {
                ...hewan,
                tanggal_ib: repro.tanggal_ib,
                pemberi_ib: repro.pemberi_ib,
                jumlah_ib: repro.jumlah_ib,
                bunting: repro.bunting,
                hpl: repro.hpl,
                sapih: repro.sapih,
                birahi: repro.birahi,
                catatan: repro.catatan || riwayat.catatan || null,
            };

            // Hitung ulang usia dalam bulan dari bulan_tahun_lahir untuk formatUsia
            const usiaBulan = hitungUsiaBulan(hewanWithRepro.bulan_tahun_lahir);
            const formatKosong = "Datanya belum ada nih..."; // ✅ Tambahkan ini

            const pesan =
                `✅ <b>DATA DITEMUKAN!</b>\n\n` +
                "<pre>" +
                `🐄 <b>Profil Ternak</b>\n\n` +
                `📌 Nama        : ${hewanWithRepro.nama}\n` +
                `🆔 RFID        : ${hewanWithRepro.id}\n` +
                `⚖️ Jenis       : ${hewanWithRepro.jenis}\n` +
                `💡 Lahir       : ${hewanWithRepro.bulan_tahun_lahir}\n` +
                `💉 Usia        : ${formatUsia(usiaBulan)}\n` +
                `🩺 Kesehatan   : ${hewanWithRepro.status_kesehatan || "Tidak ada catatan"}\n\n\n\n` +

                `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                `📆 Tanggal IB  : ${formatTanggal(hewanWithRepro.tanggal_ib) || formatKosong}\n` +
                `👤 Pemberi IB  : ${hewanWithRepro.pemberi_ib || formatKosong}\n` +
                `➕ Jumlah IB   : ${hewanWithRepro.jumlah_ib ? `Inseminasi Buatan ke-${hewanWithRepro.jumlah_ib}` : formatKosong}\n` +
                `🐂 Birahi      : ${formatTanggal(hewanWithRepro.birahi) || formatKosong}\n` +
                `🤰 Bunting     : ${formatTanggal(hewanWithRepro.bunting) || formatKosong}\n` +
                `🗓 HPL         : ${formatTanggal(hewanWithRepro.hpl) || formatKosong}\n` +
                `🐖 Sapih       : ${formatTanggal(hewanWithRepro.sapih) || formatKosong}\n` +
                `📝 Catatan     : ${hewanWithRepro.catatan || formatKosong}\n` +
                "</pre>\n" +
                `📋 Silakan pilih opsi di bawah ini atau lanjut cari data lainnya?`;

            sendAndTrackWithOptionalDelete(chatId, pesan, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✏ Edit Data", callback_data: `edit_${hewanWithRepro.id}` }],
                        [{ text: "🗑 Hapus Data", callback_data: `delete_${hewanWithRepro.id}` }]
                    ]
                }
            });

            await sendAndTrackWithOptionalDelete(chatId, "💭 Pilih menu dulu, yuk!", {
                reply_markup: {
                    keyboard: [
                        ["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"],
                        ["🔙 Kembali"]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }, 150000);
            userReproData.set(chatId, { id_hewan: hewanWithRepro.id });

        } else {
            let options = result.rows.map(h => [{ text: `${h.nama} - ${h.id}`, callback_data: `select_${h.id}` }]);
            sendAndTrackWithOptionalDelete(chatId, "⚠️ Ditemukan beberapa hewan dengan nama yang sama. Pilih hewan yang ingin diedit atau dihapus:", {
                reply_markup: { inline_keyboard: options }
            }, 150000);
        }

        userSearchStatus.delete(chatId);


        // ========================= FLOW EDIT DATA =========================
    } else if (userEditStatus.has(chatId)) {
        const hewanId = userEditStatus.get(chatId);
        const dataBaru = text.split(",");

        // Inisialisasi data sementara kalau belum ada
        if (!userEditTemp.has(chatId)) {
            let { data: hewanData, error: hewanError } = await db.select('hewan', '*', { id: hewanId }, { limit: 1 });
            if (hewanData && hewanData.length > 0) hewanData = hewanData[0]; else hewanData = null;

            if (hewanError || !hewanData) {
                return sendTemporaryMessage(chatId, "⚠️ Data hewan tidak ditemukan.", 60000);
            }

            let { data: reproData, error: reproError } = await db.select('reproduksi_ternak', '*', { rfid: hewanId }, { orderBy: { column: 'tanggal_ib', ascending: false }, limit: 1 });
            if (reproData && reproData.length > 0) reproData = reproData[0]; else reproData = null;

            const repro = reproData || {}; // Pakai objek kosong kalau gak ada data reproduksi

            const defaultBirthDate = hewanData.bulan_tahun_lahir;

            userEditTemp.set(chatId, {
                nama: hewanData.nama,
                jenis: hewanData.jenis,
                bulan_tahun_lahir: defaultBirthDate,
                usia: hewanData.usia || calculateAgeInYears(defaultBirthDate),
                status_kesehatan: hewanData.status_kesehatan,

                tanggal_ib: repro.tanggal_ib || null,
                pemberi_ib: repro.pemberi_ib || null,
                jumlah_ib: repro.jumlah_ib || null,
                bunting: repro.bunting || null,
                hpl: repro.hpl || null,
                sapih: repro.sapih || null,
                birahi: repro.birahi || null,
                catatan: repro.catatan || null,
            });
        }

        const opsi = ["Nama", "Jenis", "Tanggal Lahir", "Status Kesehatan",
            "Tanggal IB", "Pemberi IB", "Jumlah IB", "Bunting", "HPL", "Sapih", "Birahi", "Catatan"];

        // Kalau user menekan tombol "Edit [field]" dari keyboard
        if (opsi.includes(text)) {
            let field = "";

            switch (text) {
                case "Nama":
                    field = "nama";
                    break;
                case "Jenis":
                    field = "jenis";
                    break;
                case "Tanggal Lahir":
                    field = "bulan_tahun_lahir";
                    break;
                case "Status Kesehatan":
                    field = "status_kesehatan";
                    break;

                case "Tanggal IB":
                    field = "tanggal_ib";
                    break;
                case "Pemberi IB":
                    field = "pemberi_ib";
                    break;
                case "Jumlah IB":
                    field = "jumlah_ib";
                    break;
                case "Bunting":
                    field = "bunting";
                    break;
                case "HPL":
                    field = "hpl";
                    break;
                case "Sapih":
                    field = "sapih";
                    break;
                case "Birahi":
                    field = "birahi";
                    break;
                case "Catatan":
                    field = "catatan";
                    break;
            }

            userEditField.set(chatId, field);

            sendTemporaryMessage(chatId, `📝 Silahkan Masukkan ${text} baru:`, 200000);
            return;
        }

        // Kalau user sudah memilih field dan sedang input nilai barunya
        if (userEditField.has(chatId)) {
            const field = userEditField.get(chatId);
            const hewanId = userEditStatus.get(chatId);
            let newValue = text;

            // Cegah user input sama dengan label tombol
            const forbiddenInputs = ["Nama", "Jenis", "Tanggal Lahir", "Status Kesehatan",
                "Tanggal IB", "Pemberi IB", "Jumlah IB", "Bunting", "HPL", "Sapih", "Birahi", "Catatan"
            ];
            if (forbiddenInputs.includes(newValue)) {
                return sendTemporaryMessage(chatId, "⚠️ Input tidak boleh sama dengan label tombol. Masukkan data barunya ya.", 200000);
            }

            // Validasi khusus untuk field tanggal
            if (["tanggal_ib", "bunting", "hpl", "sapih", "birahi"].includes(field)) {
                if (!isValidTanggal(newValue)) {
                    return sendTemporaryMessage(chatId, "⚠️ Format tanggal salah. Gunakan dd/mm/yyyy", 200000);
                }
                // Konversi ke format yyyy-mm-dd untuk disimpan di DB
                const [dd, mm, yyyy] = newValue.split("/");
                const dateForDB = `${yyyy}-${mm}-${dd}`;

                newValue = dateForDB; // overwrite agar yang disimpan ke tempData sudah dalam format DB
            }

            let tempData = userEditTemp.get(chatId);

            // UNTUK FORMAT BULAN TAHUN LAHIR
            if (field === "bulan_tahun_lahir") {
                if (!/^\d{2}\/\d{2}\/\d{4}$/.test(newValue)) {
                    return sendTemporaryMessage(chatId, "⚠️ Format salah. Gunakan dd/mm/yyyy, misalnya: 15/02/2020", 200000);
                }

                const [dd, mm, yyyy] = newValue.split("/").map(Number);

                // Validasi tanggal lebih spesifik
                if (dd < 1 || dd > 31 || mm < 1 || mm > 12) {
                    return sendTemporaryMessage(chatId, "⚠️ Tanggal atau bulan tidak valid", 200000);
                }

                // Hitung usia
                const now = new Date();
                let usiaBulan = (now.getFullYear() - yyyy) * 12 + (now.getMonth() - (mm - 1));

                // Koreksi jika hari lahir belum lewat di bulan ini
                if (now.getDate() < dd) {
                    usiaBulan--;
                }

                usiaBulan = Math.max(0, usiaBulan);
                tempData.bulan_tahun_lahir = newValue;
                tempData.usia = usiaBulan;

            } else if (field === "birahi") {
                tempData.birahi = newValue;

                const tanggalBirahi = new Date(newValue);
                const tanggalBunting = new Date(tanggalBirahi);
                tanggalBunting.setMonth(tanggalBunting.getMonth() + 3);

                const tanggalHPL = new Date(tanggalBunting);
                tanggalHPL.setMonth(tanggalHPL.getMonth() + 9);
                tanggalHPL.setDate(tanggalHPL.getDate() + 10);

                tempData.bunting = tanggalBunting.toISOString().split('T')[0];
                tempData.hpl = tanggalHPL.toISOString().split('T')[0];
            } else {
                tempData[field] = newValue;
            }

            userEditTemp.set(chatId, tempData);

            try {
                let { data: hewanData, error: hewanError } = await db.select('hewan', '*', { id: hewanId }, { limit: 1 });
                if (hewanData && hewanData.length > 0) hewanData = hewanData[0]; else hewanData = null;

                if (hewanError || !hewanData) {
                    return sendTemporaryMessage(chatId, "⚠️ Data hewan tidak ditemukan.", 60000);
                }

                // Update reproduction data
                const { data: _updated, error: updateError } = await db.update('reproduksi_ternak', {
                    tanggal_ib: tempData.tanggal_ib,
                    pemberi_ib: tempData.pemberi_ib,
                    jumlah_ib: tempData.jumlah_ib,
                    bunting: tempData.bunting,
                    hpl: tempData.hpl,
                    sapih: tempData.sapih,
                    birahi: tempData.birahi,
                    catatan: tempData.catatan
                }, { rfid: hewanId });

                // 🔽 Simpan versi edit ini juga ke tabel feed_ai
                const { data: _inserted, error: feedInsertError } = await db.insert('feed_ai', {
                    rfid: hewanId,
                    tanggal_ib: tempData.tanggal_ib,
                    pemberi_ib: tempData.pemberi_ib,
                    jumlah_ib: tempData.jumlah_ib,
                    birahi: tempData.birahi || null,
                    bunting: tempData.bunting || null,
                    hpl: tempData.hpl || null,
                    sapih: tempData.sapih || null,
                    catatan: tempData.catatan || null,
                    created_at: new Date().toISOString()
                });

                if (feedInsertError) {
                    console.error("❌ Gagal menyimpan ke feed_ai dari edit:", feedInsertError.message);
                }

                if (updateError) throw updateError;

                const formatKosong = "Datanya belum ada nih..."; // ✅ Tambahkan ini
                const usiaBulan = hitungUsiaBulan(tempData.bulan_tahun_lahir);

                sendAndTrackWithOptionalDelete(chatId,
                    `✅ <b>Data sementara diperbarui:</b>\n\n` +
                    '<pre>' +
                    `🐄 <b>Profil Ternak</b>\n\n` +
                    `📌 <b>Nama</b>       : ${tempData.nama}\n` +
                    `🆔 <b>RFID</b>       : ${hewanId}\n` +
                    `⚖️ <b>Jenis</b>      : ${tempData.jenis}\n` +
                    `💡 <b>Lahir</b>      : ${tempData.bulan_tahun_lahir}\n` +
                    `💉 <b>Usia</b>       : ${formatUsia(usiaBulan)}\n` +
                    `🩺 <b>Kesehatan</b>  : ${tempData.status_kesehatan}\n\n\n\n` +

                    `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                    `📆 Tanggal IB  : ${formatTanggal(tempData.tanggal_ib) || formatKosong}\n` +
                    `👤 Pemberi IB  : ${tempData.pemberi_ib || formatKosong}\n` +
                    `➕ Jumlah IB   : ${tempData.jumlah_ib ? `Inseminasi Buatan ke-${tempData.jumlah_ib}` : formatKosong}\n` +
                    `🐂 Birahi      : ${formatTanggal(tempData.birahi) || formatKosong}\n` +
                    `🤰 Bunting     : ${formatTanggal(tempData.bunting) || formatKosong}\n` +
                    `🗓 HPL         : ${formatTanggal(tempData.hpl) || formatKosong}\n` +
                    `🐖 Sapih       : ${formatTanggal(tempData.sapih) || formatKosong}\n` +
                    `📝 Catatan     : ${tempData.catatan || formatKosong}\n` +
                    '</pre>\n\n' +
                    `Yakin gak ada yang mau di edit lagi?`,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "✅ Yakin dong!", callback_data: "konfirmasi" }],
                                [{ text: "❌ Cancel Deh", callback_data: "batal_edit" }]
                            ]
                        }
                    }, 600000
                );

                userEditField.delete(chatId); // Hapus status field yang sedang diedit
                return;

            } catch (error) {
                console.error("❌ Gagal update:", error);
                sendTemporaryMessage(chatId, `❌ Gagal mengupdate ${field}, coba lagi nanti.`, 60000);
                return;
            }
        }

        // FLOW YANG FORMAT INPUT SEKALIGUS SEMUA DATA
        dayjs.extend(utc);
        dayjs.extend(customParseFormat);
        dayjs.extend(timezone);
        dayjs.tz.setDefault("Asia/Makassar");

        if (typeof text === "string" && text.includes(":")) {
            const lines = text.split("\n").filter(Boolean);
            const fields = {};
            const kosongSymbols = ["-", ".", "–"];

            for (let line of lines) {
                const [keyRaw, ...valueParts] = line.split(":");
                if (!keyRaw || valueParts.length === 0) continue;
                const key = keyRaw.trim().toLowerCase().replace(/\s+/g, "_");
                const value = valueParts.join(":").trim();
                fields[key] = value;
            }

            const requiredKeys = [
                "nama", "jenis", "lahir", "kesehatan", "tanggal_ib", "pemberi_ib", "jumlah_ib",
                "bunting", "hpl", "sapih", "birahi", "catatan"
            ];

            if (!requiredKeys.every(k => fields.hasOwnProperty(k))) {
                return sendTemporaryMessage(chatId, "⚠️ Format tidak lengkap. Pastikan semua 12 kolom diisi minimal dengan tanda titik/dash jika kosong.", 100000);
            }

            let {
                nama, jenis, lahir: bulan_tahun_lahir, kesehatan,
                tanggal_ib, pemberi_ib, jumlah_ib, bunting,
                hpl, sapih, birahi, catatan
            } = fields;

            const normalize = (val) => val?.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
            const cleanField = (val) => (!val || kosongSymbols.includes(val.trim())) ? "" : val.trim();

            tanggal_ib = cleanField(normalize(tanggal_ib));
            sapih = cleanField(normalize(sapih));
            birahi = cleanField(normalize(birahi));
            pemberi_ib = cleanField(pemberi_ib);
            jumlah_ib = cleanField(jumlah_ib);
            catatan = cleanField(catatan);
            bunting = "";
            hpl = "";

            const isValidTanggal = (str) => {
                if (!str || kosongSymbols.includes(str)) return true;
                return dayjs(str, "DD/MM/YYYY", true).isValid();
            };

            const parseTanggal = (str) => dayjs.tz(str, "DD/MM/YYYY", "Asia/Makassar");
            const toYYYYMMDD = (d) => d.format("YYYY-MM-DD");

            for (const [label, value] of Object.entries({ tanggal_ib, sapih, birahi })) {
                if (!isValidTanggal(value)) {
                    return sendTemporaryMessage(chatId, `⚠️ Format tanggal salah untuk '${label}'. Gunakan format dd/mm/yyyy.`, 60000);
                }
            }

            if (!isValidTanggal(bulan_tahun_lahir)) {
                return sendTemporaryMessage(chatId, "⚠️ Format tanggal lahir salah. Gunakan dd/mm/yyyy", 60000);
            }

            const lahir = parseTanggal(bulan_tahun_lahir);
            const now = dayjs().tz("Asia/Makassar");
            let usiaBulan = now.diff(lahir, "month");
            usiaBulan = Math.max(0, usiaBulan);

            if (birahi && isValidTanggal(birahi)) {
                const tglBirahi = parseTanggal(birahi);
                const tanggalBunting = tglBirahi.add(3, "month");
                const tanggalHPL = tanggalBunting.add(9, "month").add(10, "day");

                bunting = toYYYYMMDD(tanggalBunting);
                hpl = toYYYYMMDD(tanggalHPL);
            }

            let tempData = userEditTemp.get(chatId);
            if (!tempData) {
                let { data: hewanRows, error: hewanError } = await db.select("hewan", "*", { id: hewanId });
                let hewanData = (hewanRows && hewanRows.length > 0) ? hewanRows[0] : null;

                if (hewanError || !hewanData) {
                    return sendTemporaryMessage(chatId, "⚠️ Data hewan tidak ditemukan.", 100000);
                }

                let { data: reproRows, error: reproError } = await db.select("reproduksi_ternak", "*", { rfid: hewanId }, { orderBy: { column: "tanggal_ib", ascending: false }, limit: 1 });
                let reproData = (reproRows && reproRows.length > 0) ? reproRows[0] : null;

                const hewan = hewanData;
                const repro = reproData || {};

                tempData = {
                    nama: hewan.nama,
                    jenis: hewan.jenis,
                    bulan_tahun_lahir: hewan.bulan_tahun_lahir,
                    usia: hewan.usia,
                    status_kesehatan: hewan.status_kesehatan,
                    tanggal_ib: repro.tanggal_ib,
                    pemberi_ib: repro.pemberi_ib,
                    jumlah_ib: repro.jumlah_ib,
                    bunting: repro.bunting,
                    hpl: repro.hpl,
                    sapih: repro.sapih,
                    birahi: repro.birahi,
                    catatan: repro.catatan,
                };
            }

            Object.assign(tempData, {
                nama,
                jenis,
                bulan_tahun_lahir,
                usia: usiaBulan,
                status_kesehatan: kesehatan,
                tanggal_ib: tanggal_ib ? toYYYYMMDD(parseTanggal(tanggal_ib)) : null,
                pemberi_ib,
                jumlah_ib,
                bunting: bunting || null,
                hpl: hpl || null,
                sapih: sapih ? toYYYYMMDD(parseTanggal(sapih)) : null,
                birahi: birahi ? toYYYYMMDD(parseTanggal(birahi)) : null,
                catatan
            });

            userEditTemp.set(chatId, tempData);

            const formatKosong = "Datanya belum ada nih...";
            const formatTanggal = (val) => val ? dayjs.tz(val, "Asia/Makassar").format("DD/MM/YYYY") : "";

            sendAndTrackWithOptionalDelete(
                chatId,
                `✅ <b>Data sementara diperbarui:</b>\n\n` +
                "<pre>" +
                `🐄 <b>Profil Ternak</b>\n\n` +
                `📌 <b>Nama</b>       : ${tempData.nama}\n` +
                `🆔 <b>RFID</b>       : ${hewanId}\n` +
                `⚖️ <b>Jenis</b>      : ${tempData.jenis}\n` +
                `💡 <b>Lahir</b>      : ${tempData.bulan_tahun_lahir}\n` +
                `💉 <b>Usia</b>       : ${formatUsia(tempData.usia)}\n` +
                `🩺 <b>Kesehatan</b>  : ${tempData.status_kesehatan}\n\n\n\n` +

                `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                `📆 Tanggal IB  : ${formatTanggal(tempData.tanggal_ib) || formatKosong}\n` +
                `👤 Pemberi IB  : ${tempData.pemberi_ib || formatKosong}\n` +
                `➕ Jumlah IB   : ${tempData.jumlah_ib ? `Inseminasi Buatan ke-${tempData.jumlah_ib}` : formatKosong}\n` +
                `🐂 Birahi      : ${formatTanggal(tempData.birahi) || formatKosong}\n` +
                `🤰 Bunting     : ${formatTanggal(tempData.bunting) || formatKosong}\n` +
                `🗓 HPL         : ${formatTanggal(tempData.hpl) || formatKosong}\n` +
                `🐖 Sapih       : ${formatTanggal(tempData.sapih) || formatKosong}\n` +
                `📝 Catatan     : ${tempData.catatan || formatKosong}\n` +
                "</pre>\n" +
                `Yakin gak ada yang mau di edit lagi?`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "✅ Yakin dong!", callback_data: "konfirmasi" }],
                            [{ text: "❌ Cancel Deh", callback_data: "batal_edit" }]
                        ]
                    }
                },
                600000
            );

            userEditField.delete(chatId);
            return;
        }

        // ========================= FLOW TAMBAH HEWAN =========================
    } else if (msg.text === "➕ Tambah Hewan") {
        userEditStatus.delete(chatId); // Pastikan tidak dalam mode edit

        // Pastikan UID sudah tersedia (dari hasil scan sebelumnya)
        if (!userRegisterData.has(chatId)) {
            sendTemporaryMessage(chatId, "⚠️ Mohon scan RFID terlebih dahulu.", 100000);
            return;
        }

        // Atur status dan data pendaftaran
        userRegisterStatus.set(chatId, "nama"); // Set status ke input nama
        userRegisterData.set(chatId, { uid: userRegisterData.get(chatId).uid }); // Simpan UID

        sendAndTrackWithOptionalDelete(chatId, "✏️ Silakan ketik nama hewan yang ingin didaftarkan:", {
            reply_markup: {
                keyboard: [["🔙 Kembali"]],
                resize_keyboard: true
            }
        }, 200000);

    } else if (userRegisterStatus.has(chatId)) {
        let registerStep = userRegisterStatus.get(chatId);
        let registerData = userRegisterData.get(chatId) || {};

        if (registerStep === "nama") {
            registerData.nama = msg.text;

            userRegisterStatus.set(chatId, "jenis"); // Lanjut ke input jenis
            userRegisterData.set(chatId, registerData);
            sendAndTrackWithOptionalDelete(chatId, "✏️ Silakan ketik jenis hewan yang ingin didaftarkan:", {
                reply_markup: {
                    keyboard: [["🔙 Kembali"]],
                    resize_keyboard: true
                }
            }, 200000);

        } else if (registerStep === "jenis") {
            registerData.jenis = msg.text;

            userRegisterStatus.set(chatId, "usia"); // Lanjut ke langkah "usia"
            userRegisterData.set(chatId, registerData);
            sendAndTrackWithOptionalDelete(chatId, "📌 Masukkan tanggal, bulan dan tahun lahir hewan (dd/mm/yyyy):", {
                reply_markup: { keyboard: [["🔙 Kembali"]], resize_keyboard: true }
            }, 200000);

        } else if (registerStep === "usia") {
            // Validasi input mm/yyyy
            const parts = msg.text.split("/");
            if (parts.length !== 3) {
                return sendAndTrackWithOptionalDelete(chatId, "❌ Format salah! Masukkan dalam format dd/mm/yyyy (contoh: 10/05/2025).", {}, 100000)
            }

            const [dd, mm, yyyy] = parts;
            const day = parseInt(dd);
            const month = parseInt(mm);
            const year = parseInt(yyyy);

            if (
                isNaN(day) || isNaN(month) || isNaN(year) ||
                day < 1 || day > 31 ||
                month < 1 || month > 12 ||
                year < 2000 || year > new Date().getFullYear()
            ) {
                return sendAndTrackWithOptionalDelete(chatId, "❌ Input tidak valid. Pastikan:\n- Tanggal 1-31\n- Bulan 1-12\n- Tahun 2000-sekarang", {}, 100000);
            }

            // Hitung Usia Sekarang
            const now = new Date();
            const birthDate = new Date(year, month - 1, day);

            let years = now.getFullYear() - birthDate.getFullYear();
            let months = now.getMonth() - birthDate.getMonth();
            let days = now.getDate() - birthDate.getDate();

            if (days < 0) {
                months--;
                days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
            }

            if (months < 0) {
                years -= 1;
                months += 12;
            }

            if (years < 0) {
                return sendAndTrackWithOptionalDelete(chatId, "❌ Tahun lahir tidak boleh terlalu jauh!", {}, 100000)
            }

            registerData.bulan_tahun_lahir = msg.text;
            registerData.usia_tahun = years;
            registerData.usia_bulan = months;
            registerData.usia_hari = days;
            registerData.usia_total_bulan = years * 12 + months;

            userRegisterStatus.set(chatId, "kesehatan"); // Lanjut ke langkah "kesehatan"
            userRegisterData.set(chatId, registerData);
            sendAndTrackWithOptionalDelete(chatId, "📌 Pilih status kesehatan:", {
                reply_markup: { keyboard: [["✅ Sehat", "⚠️ Sakit"], ["🏥 Butuh Perawatan", "Hamil"]], resize_keyboard: true }
            }, 200000);

        } else if (registerStep === "kesehatan") {
            registerData.status_kesehatan = msg.text;
            const uid = registerData.uid;

            try {
                // Cek apakah UID sudah ada
                let { data: existingUID, error: checkError } = await db.select("hewan", "id", { id: uid });
                if (existingUID && existingUID.length > 0) existingUID = existingUID[0]; else existingUID = null;

                if (checkError) throw checkError;
                if (existingUID) {
                    return sendTemporaryMessage(chatId, "⚠️ UID ini sudah digunakan untuk hewan lain. Gunakan UID yang berbeda.", 200000)
                }

                // Simpan data via API (melingkupi penyisipan DB dan sinkronisasi GSheets di Backend)
                try {
                    await axios.post("http://backend:5000/api/scanner/profil", {
                        id: uid,
                        nama: registerData.nama,
                        jenis: registerData.jenis,
                        bulan_tahun_lahir: registerData.bulan_tahun_lahir,
                        status_kesehatan: registerData.status_kesehatan
                    });
                } catch (err) {
                    console.error("❌ API Error:", err.response?.data?.detail || err.message);
                    throw new Error(err.response?.data?.detail || "Gagal menyimpan ke database API");
                }

                let insertedData = {
                    id: uid,
                    nama: registerData.nama,
                    jenis: registerData.jenis,
                    bulan_tahun_lahir: registerData.bulan_tahun_lahir,
                    status_kesehatan: registerData.status_kesehatan
                };

                const usiaBulan = hitungUsiaBulan(insertedData.bulan_tahun_lahir);

                await sendAndTrackWithOptionalDelete(chatId,
                    `✅ Hewan berhasil didaftarkan!\n\n` +
                    "<pre>" +
                    `📌 Nama        : ${insertedData.nama}\n` +
                    `🆔 RFID        : ${insertedData.id}\n` +
                    `⚖️ Jenis       : ${insertedData.jenis}\n` +
                    `💉 Lahir       : ${insertedData.bulan_tahun_lahir}\n` +
                    `💉 Usia        : ${formatUsia(usiaBulan)}\n` +
                    `🩺 Kesehatan   : ${insertedData.status_kesehatan || "Tidak ada catatan"}` +
                    "</pre>",
                    { parse_mode: "HTML" }
                );

                const { data: collars } = await db.query(`
                    SELECT DISTINCT collar_id FROM public.sensor_data 
                    WHERE collar_id NOT IN (SELECT collar_id FROM public.hewan WHERE collar_id IS NOT NULL)
                `);

                if (collars && collars.length > 0) {
                    // Jika ada kalung nganggur, kita tawarkan pairing
                    let collarButtons = collars.map(c => [`Pair: ${c.collar_id}`]);
                    collarButtons.push(["❌ Nggak, Ah!"]);

                    userRegisterStatus.set(chatId, "pairing"); 
                    userRegisterData.set(chatId, { uid: uid, nama: registerData.nama }); // Simpan info minimal

                    await bot.sendMessage(chatId, "🐮 Mau sekalian pasang kalung sensornya? Pilih ID kalung di bawah ini:", {
                        reply_markup: {
                            keyboard: collarButtons,
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    });
                } else {
                    await bot.sendMessage(chatId, "✅ Data disimpan! Mau tambah data reproduksi sekarang?", {
                        reply_markup: { keyboard: [["➕ Tambah Reproduksi", "❌ Nggak, Ah!"]], resize_keyboard: true, one_time_keyboard: true }
                    });
                    
                    userReproData.set(chatId, { id_hewan: uid });
                    userRegisterStatus.delete(chatId); // DELETE HANYA DI SINI JIKA TIDAK ADA PAIRING
                    userRegisterData.delete(chatId);
                }
            } catch (err) {
                console.error(err);
                return sendTemporaryMessage(chatId, `❌ Gagal menyimpan data: ${err.message}`, 100000)
            }
        }

        else if (registerStep === "pairing") {
            const input = msg.text;
            const uid = registerData.uid;

            if (input.startsWith("Pair: ")) {
                const selectedCollar = input.replace("Pair: ", "");
                try {
                    await db.update("hewan", { collar_id: selectedCollar }, { id: uid });
                    await bot.sendMessage(chatId, `🎉 Sapi <b>${registerData.nama}</b> sekarang terhubung dengan kalung <b>${selectedCollar}</b>.`, { parse_mode: "HTML" });
                } catch (err) {
                    await bot.sendMessage(chatId, "❌ Gagal mendaftarkan kalung.");
                }
            } else {
                await bot.sendMessage(chatId, "👍 Sapi didaftarkan tanpa kalung sensor.");
            }

            // Selesai Pairing, tawarkan flow Reproduksi (agar tetap sinkron dengan kodingan lamamu)
            await bot.sendMessage(chatId, "Mau sekalian tambah data reproduksinya?", {
                reply_markup: {
                    keyboard: [["➕ Tambah Reproduksi", "❌ Nggak, Ah!"]],
                    resize_keyboard: true, one_time_keyboard: true
                }
            });

            userReproData.set(chatId, { id_hewan: uid });
            userRegisterStatus.delete(chatId); // BERSIHKAN STATUS
            userRegisterData.delete(chatId);
        }
    }

    // ========================= FLOW TAMBAH REPRODUKSI =========================
    else if (msg.text === "📂 Lihat Riwayat Reproduksi") {
        const data = userReproData.get(chatId);
        if (!data || !data.id_hewan) {
            return sendTemporaryMessage(chatId, "⚠️ Belum ada hewan terdeteksi. Silahkan scan kartunya terlebih dahulu.", 120000);
        }

        // ✅ Tambahan pengecekan ke database
        const { data: checkExist, error: checkError } = await db.select('hewan', 'id', { id: data.id_hewan }, { limit: 1 });

        if (checkError || !checkExist || checkExist.length === 0) {
            userReproData.delete(chatId);
            return sendTemporaryMessage(chatId, "📭 Data hewan tidak ditemukan. Silakan scan ulang kartu hewan yang valid.", 120000);
        }

        const { data: result, error: queryError } = await db.select('riwayat_reproduksi', '*', { rfid: data.id_hewan }, { orderBy: { column: 'tanggal_ib', ascending: false }, limit: 3 });

        // ✅ Tangani error atau data kosong
        if (queryError) {
            console.error("Supabase error:", queryError);
            return sendTemporaryMessage(chatId, "⚠️ Gagal mengambil data riwayat reproduksi.", 120000);
        }

        if (!result || result.length === 0) {
            return sendTemporaryMessage(chatId, "📭 Belum ada riwayat reproduksi untuk hewan ini.", 120000);
        }

        let historyText = "📋 <b>Riwayat Reproduksi:</b>\n\n\n";
        result.forEach((row, index) => {
            historyText += `<b>🧾 Riwayat ${index + 1}</b>\n` +
                `<pre>` +
                `🗓️ Tanggal IB : ${formatTanggal(row.tanggal_ib)}\n` +
                `👤 Pemberi IB : ${row.pemberi_ib || "-"}\n` +
                `🔁 Jumlah IB  : ${row.jumlah_ib ? `Inseminasi Buatan ke-${row.jumlah_ib}` : "-"}\n` +
                `♻️ Birahi     : ${formatTanggal(row.birahi) || "-"}\n` +
                `🐄 Bunting    : ${formatTanggal(row.bunting) || "-"}\n` +
                `📅 HPL        : ${formatTanggal(row.hpl) || "-"}\n` +
                `🍼 Sapih      : ${formatTanggal(row.sapih) || "-"}\n` +
                `📝 Catatan    : ${row.catatan || "-"}\n\n` +
                `</pre>\n\n`;
        }
        )
        await sendAndTrackWithOptionalDelete(chatId, historyText,
            {
                parse_mode: "HTML",
                reply_markup: {
                    keyboard: [["🔙 Kembali"]],
                    resize_keyboard: true
                }
            });

        userScanStatus.set(chatId, true);
    }

    else if (msg.text === "➕ Tambah Reproduksi") {
        const data = userReproData.get(chatId);
        if (!data || !data.id_hewan) {
            return sendTemporaryMessage(chatId, "⚠️ Belum ada hewan terdeteksi. Silahkan scan kartunya terlebih dahulu.", 120000);
        }

        // ✅ Tambahan pengecekan ke database
        const { data: checkExist, error: checkError } = await db.select('hewan', 'id', { id: data.id_hewan }, { limit: 1 });

        if (checkError || !checkExist || checkExist.length === 0) {
            userReproData.delete(chatId);
            return sendTemporaryMessage(chatId, "📭 Data hewan tidak ditemukan. Silakan scan ulang kartu hewan yang valid.", 120000);
        }

        userReproStatus.set(chatId, "tanggal_ib");
        return sendAndTrackWithOptionalDelete(chatId, "📆 Masukkan tanggal IB (dd/mm/yyyy):", {
            reply_markup: { keyboard: [["🔙 Kembali"]], resize_keyboard: true }
        }, 150000);

    } else if (msg.text === "❌ Nggak, Ah!") {
        // Hapus semua status user
        userReproStatus.delete(chatId);
        userReproData.delete(chatId);

        // Kirim pesan kembali ke mode scan
        await sendAndTrackWithOptionalDelete(chatId, "🔄 Oke boss! Silakan tempelkan kartu RFID lagi.", {
            reply_markup: {
                keyboard: [["🔙 Kembali"]],
                resize_keyboard: true
            }
        }, 150000);

    } else if (userReproStatus.has(chatId)) {
        let step = userReproStatus.get(chatId);
        let data = userReproData.get(chatId);

        if (step === "tanggal_ib") {
            if (!isValidDateFormat(text)) {
                return bot.sendMessage(chatId, "❌ Format salah! Masukkan tanggal dengan format dd/mm/yyyy yang valid.");
            }
            const [dd, mm, yyyy] = text.split("/");
            data.tanggal_ib = `${yyyy}-${mm}-${dd}`;

            userReproStatus.set(chatId, "pemberi_ib");
            userReproData.set(chatId, data);
            return sendTemporaryMessage(chatId, "👤 Siapa yang memberi IB?", 200000);
        }

        if (step === "pemberi_ib") {
            data.pemberi_ib = text;
            userReproStatus.set(chatId, "jumlah_ib");
            userReproData.set(chatId, data);
            return sendTemporaryMessage(chatId, "🔢 Berapa kali IB dilakukan?", 200000);
        }

        if (step === "jumlah_ib") {
            data.jumlah_ib = parseInt(text);
            if (isNaN(data.jumlah_ib)) return bot.sendMessage(chatId, "❌ Masukkan angka yang valid.");

            userReproStatus.set(chatId, "birahi"); // pindah ke birahi dulu
            userReproData.set(chatId, data);
            return sendTemporaryMessage(chatId, "📆 Masukkan tanggal birahi ulang (dd/mm/yyyy), atau ketik - jika belum tahu:", 200000);
        }

        if (step === "birahi") {
            if (text !== "-") {
                if (!isValidDateFormat(text)) {
                    return sendTemporaryMessage(chatId, "❌ Format salah! Masukkan tanggal dengan format dd/mm/yyyy yang valid.", 200000);
                }
                const [dd, mm, yyyy] = text.split("/");
                data.birahi = `${yyyy}-${mm}-${dd}`;

                // Hitung otomatis sesuai siklus peternakan
                const tanggalBirahi = new Date(data.birahi);

                // Bunting = 3 bulan setelah birahi
                const tanggalBunting = new Date(tanggalBirahi);
                tanggalBunting.setMonth(tanggalBunting.getMonth() + 3);

                // HPL = 9 bulan 10 hari setelah bunting
                const tanggalHPL = new Date(tanggalBunting);
                tanggalHPL.setMonth(tanggalHPL.getMonth() + 9);
                tanggalHPL.setDate(tanggalHPL.getDate() + 10);

                // Simpan sementara
                data._calculated_bunting = tanggalBunting.toISOString().split('T')[0];
                data._calculated_hpl = tanggalHPL.toISOString().split('T')[0];

                userReproStatus.set(chatId, "konfirmasi_bunting_hpl");
                userReproData.set(chatId, data);

                return sendAndTrackWithOptionalDelete(chatId,
                    `📊 Hasil perhitungan berdasarkan siklus peternakan:\n\n` +
                    `<pre>` +
                    `🐂 Tanggal Birahi                       : ${formatTanggal(data.birahi)}\n` +
                    `🤰 Bunting (3 bulan setelah birahi)     : ${formatTanggal(data._calculated_bunting)}\n` +
                    `🗓 HPL (9 bulan 10 hari setelah bunting): ${formatTanggal(data._calculated_hpl)}\n` +
                    `</pre>\n` +
                    `Apakah perhitungan ini sesuai?`,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: [["✅ Ya, Gunakan", "❌ Koreksi Manual"]],
                            resize_keyboard: true
                        }
                    }, 200000
                );
            } else {
                userReproStatus.set(chatId, "bunting");
                userReproData.set(chatId, data);
                return sendTemporaryMessage(chatId, "📆 Masukkan tanggal bunting (dd/mm/yyyy), atau ketik - jika belum tahu:", 200000);
            }
        }

        // Handle konfirmasi
        if (step === "konfirmasi_bunting_hpl") {
            if (text === "✅ Ya, Gunakan") {
                data.bunting = data._calculated_bunting;
                data.hpl = data._calculated_hpl;
                delete data._calculated_bunting;
                delete data._calculated_hpl;

                userReproStatus.set(chatId, "sapih");
                userReproData.set(chatId, data);
                return sendTemporaryMessage(chatId, "📆 Masukkan tanggal sapih (dd/mm/yyyy), atau ketik - jika belum tahu:", 200000);
            } else if (text === "❌ Koreksi Manual") {
                userReproStatus.set(chatId, "bunting");
                return sendTemporaryMessage(chatId, "📆 Masukkan tanggal bunting (dd/mm/yyyy):", 200000);
            }

            userReproStatus.set(chatId, "sapih");
            userReproData.set(chatId, data);
            return sendTemporaryMessage(chatId, "📆 Masukkan tanggal sapih (dd/mm/yyyy), atau ketik - jika belum tahu:", 200000);
        }

        if (step === "sapih") {
            if (text !== "-") {
                if (!isValidDateFormat(text)) {
                    return sendTemporaryMessage(chatId, "❌ Format salah! Masukkan tanggal dengan format dd/mm/yyyy yang valid.", 200000);
                }
                const [dd, mm, yyyy] = text.split("/");
                data.sapih = `${yyyy}-${mm}-${dd}`;
            }

            userReproStatus.set(chatId, "catatan");
            userReproData.set(chatId, data);
            return sendTemporaryMessage(chatId, "📝 Catatan tambahan, atau ketik - jika belum tahu:", 200000);
        }

        if (step === "catatan") {
            if (text !== "-") data.catatan = text;

                const payload = {
                    rfid: data.id_hewan,
                    tanggal_ib: data.tanggal_ib,
                    pemberi_ib: data.pemberi_ib,
                    jumlah_ib: data.jumlah_ib,
                    bunting: data.bunting,
                    hpl: data.hpl || null,
                    sapih: data.sapih || null,
                    birahi: data.birahi || null,
                    catatan: data.catatan || null
                };

                try {
                    await axios.post("http://backend:5000/api/scanner/reproduksi", payload);
                } catch (apiErr) {
                    console.error("❌ Gagal simpan reproduksi via API:", apiErr.message);
                    return bot.sendMessage(chatId, `❌ Gagal menyimpan: ${apiErr.message}`);
                }

                // Send success message
                const formatKosong = "Datanya belum ada nih...";
                await sendAndTrackWithOptionalDelete(chatId,
                    `✅ Data reproduksi berhasil disimpan!\n\n` +
                    `<pre>` +
                    `📆 Tanggal IB  : ${formatTanggal(data.tanggal_ib) || formatKosong}\n` +
                    `👤 Pemberi IB  : ${data.pemberi_ib || formatKosong}\n` +
                    `➕ Jumlah IB   : ${data.jumlah_ib ? `Inseminasi Buatan ke-${data.jumlah_ib}` : formatKosong}\n` +
                    `🐂 Birahi      : ${formatTanggal(data.birahi) || formatKosong}\n` +
                    `🤰 Bunting     : ${formatTanggal(data.bunting) || formatKosong}\n` +
                    `🗓 HPL         : ${formatTanggal(data.hpl) || formatKosong}\n` +
                    `🐖 Sapih       : ${formatTanggal(data.sapih) || formatKosong}\n` +
                    `📝 Catatan     : ${data.catatan || formatKosong}\n` +
                    `</pre>\n\n` +
                    `🔷 Silakan lanjutkan dengan scan kartu berikutnya atau kembali ke menu.`,
                    {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: [["🔙 Kembali"]],
                            resize_keyboard: true
                        }
                    }, 350000
                );
            userReproStatus.delete(chatId);
            userReproData.delete(chatId);
        }

    }
});

// =================== HANDLER UNTUK CALLBACK BUTTON ===========
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id.toString();
    const data = callbackQuery.data;

    // ============= PROSES CALLBACK UNTUK REMOVE_ALL_HISTORY ==============
    if (data.startsWith("rmv_repro_")) {
        const rfid = data.split("_")[2];

        try {
            await axios.delete(`http://backend:5000/api/scanner/reproduksi/${rfid}`);
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(chatId, "✅ Semua riwayat reproduksi untuk hewan ini telah dihapus.");
            userDeleteReproStatus.delete(chatId);
        } catch (error) {
            console.error("❌ Error saat menghapus data:", error.message);
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(chatId, "⚠️ Gagal menghapus data via API. Coba lagi nanti.");
        }
    }

    if (data === "cancel_rmvhistory") {
        // cek apakah user sebelumnya sedang delete riwayat & rfid-nya masih ada
        const status = userDeleteReproStatus.get(chatId);

        if (status && status.rfid) {
            const { data: cekRiwayat, error } = await db.select("reproduksi_ternak", "*", { rfid: status.rfid }, { limit: 1 });

            if (error) {
                console.error("❌ Error saat cek riwayat:", error);
                await bot.answerCallbackQuery(callbackQuery.id);
                await bot.sendMessage(chatId, "⚠️ Terjadi kesalahan saat memeriksa data.");
                return;
            }

            if (!cekRiwayat || cekRiwayat.length === 0) {
                await bot.answerCallbackQuery(callbackQuery.id);
                await bot.sendMessage(chatId, "📭 Riwayat reproduksi sudah kosong atau tidak ditemukan.");
            } else {
                await bot.answerCallbackQuery(callbackQuery.id);
                await bot.sendMessage(chatId, "❎ Penghapusan riwayat dibatalkan.");
            }
        } else {
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(chatId, "📭 Tidak ada proses penghapusan yang sedang berlangsung.");
        }

        userDeleteReproStatus.delete(chatId);
    }

    // ===================== PROSES CARI DATA ======================

    // Jika pengguna memilih salah satu hewan dari daftar hasil pencarian
    if (data.startsWith("select_")) {
        const hewanId = data.split("_")[1];

        // Ambil data dari Supabase berdasarkan ID yang dipilih
        const { data: hewanData, error: errorHewan } = await db.select("hewan", "*", { id: hewanId });
        if (data && data.length > 0) data = data[0]; else data = null;

        const { data: resultRepro, error: errorRepro } = await db.select("reproduksi_ternak", "*", { rfid: hewanId }, { orderBy: { column: "tanggal_ib", ascending: false }, limit: 1 });

        const repro = resultRepro?.[0] || {};

        if (errorHewan || !hewanData) {
            console.error("❌ Error saat ambil data hewan:", errorHewan);
            sendTemporaryMessage(chatId, "❌ Hewan tidak ditemukan.", 100000);
            return;
        }

        const hewan = hewanData;

        const usiaBulan = hitungUsiaBulan(hewan.bulan_tahun_lahir);
        const formatKosong = "Datanya belum ada nih...";

        sendAndTrackWithOptionalDelete(chatId,
            `✅ <b>DATA TERPILIH!</b>\n\n` +
            "<pre>" +
            `🐄 <b>Profil Ternak</b>\n\n` +
            `📌 Nama        : ${hewan.nama}\n` +
            `🆔 RFID        : ${hewan.id}\n` +
            `⚖️ Jenis       : ${hewan.jenis}\n` +
            `💡 Lahir       : ${hewan.bulan_tahun_lahir}\n` +
            `💉 Usia        : ${formatUsia(usiaBulan)}\n` +
            `🩺 Kesehatan   : ${hewan.status_kesehatan || "Tidak ada catatan"}\n\n\n\n` +

            `📊 <b>Data Reproduksi Ternak</b>\n\n` +
            `📆 Tanggal IB  : ${formatTanggal(repro.tanggal_ib) || formatKosong}\n` +
            `👤 Pemberi IB  : ${repro.pemberi_ib || formatKosong}\n` +
            `➕ Jumlah IB   : ${repro.jumlah_ib ? `Inseminasi Buatan ke-${repro.jumlah_ib}` : formatKosong}\n` +
            `🐂 Birahi      : ${formatTanggal(repro.birahi) || formatKosong}\n` +
            `🤰 Bunting     : ${formatTanggal(repro.bunting) || formatKosong}\n` +
            `🗓 HPL         : ${formatTanggal(repro.hpl) || formatKosong}\n` +
            `🐖 Sapih       : ${formatTanggal(repro.sapih) || formatKosong}\n` +
            `📝 Catatan     : ${repro.catatan || formatKosong}\n` +
            "</pre>",
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✏ Edit Data", callback_data: `edit_${hewan.id}` }],
                        [{ text: "🗑 Hapus Data", callback_data: `delete_${hewan.id}` }]
                    ]
                }
            }, 300000
        );
        await sendAndTrackWithOptionalDelete(chatId, "💭 Pilih menu dulu, yuk!", {
            reply_markup: {
                keyboard: [
                    ["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"],
                    ["🔙 Kembali"]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }, 150000);
        userReproData.set(chatId, { id_hewan: hewanId });
    }

    console.log("Callback data diterima:", data);

    // Jawab callback secepatnya agar tidak timeout
    bot.answerCallbackQuery(callbackQuery.id)
        .catch(err => console.error("Gagal mengirim answerCallbackQuery:", err));


    // ===================== PROSES EDIT DATA ======================
    console.log("Callback data diterima:", data);

    if (data.startsWith("edit_")) {
        const hewanId = data.split("_")[1];

        try {
            // Ambil data dari tabel 'hewan'
            let { data: hewanRows, error: hewanError } = await db.select("hewan", "*", { id: hewanId });
            let hewan = (hewanRows && hewanRows.length > 0) ? hewanRows[0] : null;

            // Ambil data reproduksi terbaru dari tabel 'reproduksi_ternak'
            const { data: reproRows, error: reproError } = await db.select("reproduksi_ternak", "*", { rfid: hewanId }, { orderBy: { column: "tanggal_ib", ascending: false }, limit: 1 });

            if (hewanError || !hewan) {
                console.error("❌ Gagal ambil data hewan:", hewanError);
                sendTemporaryMessage(chatId, "❌ Data tidak ditemukan.", 100000);
                return;
            }

            const repro = reproRows && reproRows.length > 0 ? reproRows[0] : {}; // Kalau tidak ada, pakai objek kosong

            const usiaBulan = hitungUsiaBulan(hewan.bulan_tahun_lahir);
            const formatKosong = "Datanya belum ada nih...";

            sendAndTrackWithOptionalDelete(chatId,
                `✏ Anda sedang mengedit data untuk:\n\n` +
                '<pre>' +
                `🐄 <b>Profil Ternak</b>\n\n` +
                `📌 Nama        : ${hewan.nama || "Tidak tersedia"}\n` +
                `🆔 RFID        : ${hewan.id || "Tidak tersedia"}\n` +
                `⚖️ Jenis       : ${hewan.jenis || "Tidak tersedia"}\n` +
                `💡 Lahir       : ${hewan.bulan_tahun_lahir || "Tidak tersedia"}\n` +
                `💉 Usia        : ${formatUsia(usiaBulan) ? formatUsia(usiaBulan) : "Tidak tersedia"}\n` +
                `🩺 Kesehatan   : ${hewan.status_kesehatan || "Tidak ada catatan"}\n\n\n\n` +

                `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                `📆 Tanggal IB  : ${formatTanggal(repro.tanggal_ib) || formatKosong}\n` +
                `👤 Pemberi IB  : ${repro.pemberi_ib || formatKosong}\n` +
                `➕ Jumlah IB   : ${repro.jumlah_ib ? `Inseminasi Buatan ke-${repro.jumlah_ib}` : formatKosong}\n` +
                `🐂 Birahi      : ${formatTanggal(repro.birahi) || formatKosong}\n` +
                `🤰 Bunting     : ${formatTanggal(repro.bunting) || formatKosong}\n` +
                `🗓 HPL         : ${formatTanggal(repro.hpl) || formatKosong}\n` +
                `🐖 Sapih       : ${formatTanggal(repro.sapih) || formatKosong}\n` +
                `📝 Catatan     : ${repro.catatan || formatKosong}\n` +
                '</pre>\n\n' +
                `Silahkan kirim data baru dengan format:\n\n<b>Nama, Jenis, Tanggal Lahir (format: dd/mm/yyyy), Kesehatan, Tanggal IB, Pemberi IB, Jumlah IB, Bunting, HPL, Sapih, Birahi, Catatan</b>`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "✅ Konfirmasi", callback_data: "konfirmasi_edit" }],
                            [{ text: "❌ Batal edit deh!", callback_data: "batal_edit" }]
                        ],
                        keyboard: [
                            ["Nama", "Jenis", "Tanggal Lahir", "Status Kesehatan"],
                            ["Tanggal IB", "Pemberi IB", "Jumlah IB", "Bunting"],
                            ["HPL", "Sapih", "Birahi", "Catatan"],
                            ["🔙 Kembali"]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                }, 600000
            );

            // Set hewanId setelah data berhasil ditemukan
            userEditStatus.set(chatId, hewanId);

        } catch (error) {
            console.error("❌ Error saat mengambil data untuk edit:", error);
            sendTemporaryMessage(chatId, "❌ Terjadi kesalahan, coba lagi nanti.", 100000);
        }
    }

    // ===================== PROSES KONFIRMASI ======================
    if (callbackQuery.data === "konfirmasi") {
        const hewanId = userEditStatus.get(chatId);
        const tempData = userEditTemp.get(chatId);

        // 🎯 Hitung ulang usia berdasarkan bulan_tahun_lahir
        const usia = calculateAgeInYears(tempData.bulan_tahun_lahir);

        try {
            const payload = {
                rfid: hewanId,
                nama: tempData.nama,
                jenis: tempData.jenis,
                bulan_tahun_lahir: tempData.bulan_tahun_lahir,
                kesehatan: tempData.status_kesehatan,
                tanggal_ib: tempData.tanggal_ib || '',
                pemberi_ib: tempData.pemberi_ib || '',
                jumlah_ib: tempData.jumlah_ib || null,
                birahi: tempData.birahi || '',
                bunting: tempData.bunting || '',
                hpl: tempData.hpl || '',
                sapih: tempData.sapih || '',
                catatan: tempData.catatan || ''
            };

            await axios.put(`http://backend:5000/api/scanner/hewan/${hewanId}/edit-full`, payload);

            sendAndTrackWithOptionalDelete(chatId, "✅ Data berhasil disimpan!",
                {
                    reply_markup: {
                        keyboard: [["📡 Scan RFID", "🔽 Opsi Tambahan"]],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                }, 300000);

        } catch (err) {
            console.error(err);
            sendTemporaryMessage(chatId, "❌ Gagal menyimpan data via API.", 100000);
        }

        // Bersihkan semua status
        userEditStatus.delete(chatId);
        userEditField.delete(chatId);
        userEditTemp.delete(chatId);
    }

    // ===================== PROSES BATAL EDIT ======================
    if (data === "batal_edit") {
        const hewanId = userEditStatus.get(chatId);

        // Bersihkan semua state edit
        userEditStatus.delete(chatId);
        userEditTemp.delete(chatId);
        userEditField.delete(chatId);

        try {
            // Ambil data asli dari Supabase
            let { data: hewanArr, error: hewanError } = await db.select("hewan", "*", { id: hewanId });
            let hewan = (hewanArr && hewanArr.length > 0) ? hewanArr[0] : null;

            if (hewanError || !hewan) {
                return bot.sendMessage(chatId, "⚠️ Data hewan tidak ditemukan.");
            }

            const { data: reproArr, error: reproError } = await db.select("reproduksi_ternak", "*", { rfid: hewanId }, { orderBy: { column: "tanggal_ib", ascending: false }, limit: 1 });

            const repro = reproArr?.[0] || {};

            // Hitung ulang usia dalam bulan dari bulan_tahun_lahir untuk formatUsia
            const usiaBulan = hitungUsiaBulan(hewan.bulan_tahun_lahir);
            const formatKosong = "Datanya belum ada nih...";

            // Kirim ulang data aslinya
            sendAndTrackWithOptionalDelete(
                chatId,
                `❌ Edit dibatalkan. Berikut data asli:\n\n` +
                '<pre>' +
                `🐄 <b>Profil Ternak</b>\n\n` +
                `📌 Nama        : ${hewan.nama}\n` +
                `🆔 RFID        : ${hewan.id}\n` +
                `⚖️ Jenis       : ${hewan.jenis}\n` +
                `💡 Lahir       : ${hewan.bulan_tahun_lahir}\n` +
                `💉 Usia        : ${formatUsia(usiaBulan)}\n` +
                `🩺 Kesehatan   : ${hewan.status_kesehatan || "Tidak ada catatan"}\n\n\n\n` +

                `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                `📆 Tanggal IB  : ${formatTanggal(repro.tanggal_ib) || formatKosong}\n` +
                `👤 Pemberi IB  : ${repro.pemberi_ib || formatKosong}\n` +
                `➕ Jumlah IB   : ${repro.jumlah_ib ? `Inseminasi Buatan ke-${repro.jumlah_ib}` : formatKosong}\n` +
                `🐂 Birahi      : ${formatTanggal(repro.birahi) || formatKosong}\n` +
                `🤰 Bunting     : ${formatTanggal(repro.bunting) || formatKosong}\n` +
                `🗓 HPL         : ${formatTanggal(repro.hpl) || formatKosong}\n` +
                `🐖 Sapih       : ${formatTanggal(repro.sapih) || formatKosong}\n` +
                `📝 Catatan     : ${repro.catatan || formatKosong}\n` +
                '</pre>',
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: [
                            ["📡 Scan RFID", "🔽 Opsi Tambahan"]
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: false
                    }
                }, 200000);

        } catch (error) {
            console.error("❌ Gagal ambil data asli:", error);
            sendTemporaryMessage(chatId, "❌ Gagal mengambil data asli dari database.", 100000);
        }

        return;
    }

    // ===================== PROSES HAPUS DATA =====================
    if (data.startsWith("delete_")) {
        const rfid = data.split("_")[1];
        try {
            // Hapus via API (melingkupi DB dan Sheets)
            await axios.delete(`http://backend:5000/api/scanner/hewan/${rfid}`);
            sendTemporaryMessage(chatId, `✅ Data hewan dengan RFID ${rfid} telah dihapus.`, 100000);
        } catch (error) {
            console.error("❌ Gagal hapus dari database:", error.message);
            sendTemporaryMessage(chatId, `❌ Gagal menghapus data via API: ${error.message}`, 100000);
        }

    } else if (data === "cancel_delete") {
        sendTemporaryMessage(chatId, "🚫 Penghapusan data dibatalkan.", 100000);
    }

    // CEK VERSI DI bot.ontext
    if (data === "show_version") {
        const versi = "v1.3.0";
        const lastUpdated = "22 Mei 2025";

        bot.sendMessage(chatId,
            `🛠 <b>Versi Bot</b>: ${versi} (last updated: ${lastUpdated})\n\n` +
            "📝 <b>Changelog</b>\n\n" +
            "<pre>" +
            "• 📥 Sinkronisasi data ke Google Sheets\n" +
            "• 🐞 Tombol Scan hanya aktif saat ditekan\n" +
            "• 🔒 Validasi UID diperketat\n" +
            "• ⚡️ Kecepatan query ke database ditingkatkan" +
            "</pre>",
            { parse_mode: "HTML" }
        );
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// API untuk menerima RFID dari ESP8266
app.post("/api/scan-rfid", async (req, res) => {
    let { uid, chatId } = req.body;
    chatId = chatId.toString();

    if (!uid || !chatId || !userScanStatus.has(chatId)) {
        return res.status(400).json({ error: "❌ Scan tidak valid atau belum mengaktifkan mode scan." });
    }

    let hewanData = null;
    try {
        let { data: results, error: errHewan } = await db.select("hewan", "*", { id: uid });
        hewanData = (results && results.length > 0) ? results[0] : null;

        if (errHewan) throw errHewan;

        if (hewanData) {
            let { data: reproData, error: errRepro } = await db.select("reproduksi_ternak", "*", { rfid: uid }, { orderBy: { column: "tanggal_ib", ascending: false }, limit: 1 });
            let repro = (reproData && reproData.length > 0) ? reproData[0] : null;

            if (errRepro && errRepro.code !== 'PGRST116') throw errRepro;

            const usiaBulan = hitungUsiaBulan(hewanData.bulan_tahun_lahir);
            const formatKosong = "Datanya belum ada nih...";

            await sendAndTrackWithOptionalDelete(chatId,
                `🧩 <b>Data ditemukan!</b>\n\n` +
                '<pre>' +
                `🐄 <b>Profil Ternak</b>\n\n` +
                `📌 Nama        : ${hewanData.nama}\n` +
                `🆔 RFID        : ${hewanData.id}\n` +
                `⚖️ Jenis       : ${hewanData.jenis}\n` +
                `💡 Lahir       : ${hewanData.bulan_tahun_lahir}\n` +
                `💉 Usia        : ${formatUsia(usiaBulan)}\n` +
                `🩺 Kesehatan   : ${hewanData.status_kesehatan || "Tidak ada catatan"}\n\n\n\n` +

                `📊 <b>Data Reproduksi Ternak</b>\n\n` +
                `📆 Tanggal IB  : ${repro?.tanggal_ib ? formatTanggal(repro.tanggal_ib) : formatKosong}\n` +
                `👤 Pemberi IB  : ${repro?.pemberi_ib || formatKosong}\n` +
                `➕ Jumlah IB   : ${repro?.jumlah_ib ? `Inseminasi Buatan ke-${repro.jumlah_ib}` : formatKosong}\n` +
                `🐂 Birahi      : ${repro?.birahi ? formatTanggal(repro.birahi) : formatKosong}\n` +
                `🤰 Bunting     : ${repro?.bunting ? formatTanggal(repro.bunting) : formatKosong}\n` +
                `🗓 HPL         : ${repro?.hpl ? formatTanggal(repro.hpl) : formatKosong}\n` +
                `🐖 Sapih       : ${repro?.sapih ? formatTanggal(repro.sapih) : formatKosong}\n` +
                `📝 Catatan     : ${repro?.catatan || formatKosong}\n` +
                '</pre>\n' +
                `📋 Silakan pilih opsi di bawah ini atau lanjut scan kartu berikutnya aja!`,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "✏️ Edit", callback_data: `edit_${hewanData.id}` }],
                            [{ text: "🗑 Hapus", callback_data: `delete_${hewanData.id}` }]
                        ]
                    }
                }
            );

            await sendAndTrackWithOptionalDelete(chatId, "💭 Pilih menu dulu, yuk!", {
                reply_markup: {
                    keyboard: [
                        ["➕ Tambah Reproduksi", "📂 Lihat Riwayat Reproduksi"],
                        ["🔙 Kembali"]
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            }, 150000);
            userReproData.set(chatId, { id_hewan: uid });

        } else {
            userRegisterData.set(chatId, { uid });

            sendAndTrackWithOptionalDelete(chatId, `⚠️ Tidak ditemukan data untuk UID: ${uid}\nMau mendaftarkan hewan baru?`, {
                reply_markup: { keyboard: [["➕ Tambah Hewan", "🔙 Kembali"]], resize_keyboard: true }
            }, 150000);
        }

        return res.status(200).json({ 
            success: true, 
            nama: hewanData ? hewanData.nama : "Anonim", 
            jenis: hewanData ? hewanData.jenis : uid 
        });

    } catch (error) {
        sendTemporaryMessage(chatId, `❌ Terjadi kesalahan: ${error.message}`, 100000);
        return res.status(500).json({ error: error.message });
    }
});

// Endpoint DELETE untuk menghapus hewan berdasarkan RFID atau Nama
app.delete("/api/delete-animal", async (req, res) => {
    try {
        const { rfid, nama } = req.body;

        if (!rfid && !nama) {
            return res.status(400).json({ error: "❌ Harap masukkan *RFID* atau *Nama* Hewan untuk menghapus." });
        }

        let result;
        if (rfid) {
            // Hapus berdasarkan RFID
            const { data, error } = await db.delete("hewan", { id: rfid });
            if (data && data.length > 0) data = data[0]; else data = null;

            if (error) throw error;
            result = { rows: [data], rowCount: data ? 1 : 0 };

        } else if (nama) {
            // Hapus berdasarkan Nama Hewan
            // Hapus berdasarkan Nama Hewan (ILIKE)
            const { rows, error } = await db.query(
                "DELETE FROM hewan WHERE nama ILIKE $1 RETURNING *",
                [`%${nama}%`]
            );
            
            // Map db.query result to expected 'data' format
            const data = rows;
            if (data && data.length > 0) data = data[0]; else data = null;

            if (error) throw error;
            result = { rows: [data], rowCount: data ? 1 : 0 };
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "⚠️ Data hewan tidak ditemukan." });
        }

        res.json({ message: "✅ Data hewan berhasil dihapus.", deletedData: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "❌ Terjadi kesalahan saat menghapus data." });
    }
});

app.get("/ping-ping-ping", (req, res) => {
    res.status(200).send("👋 Hello from IOT Server — I'm awake!");
});

app.listen(port, () => {
    console.log(`🚀 Server berjalan di http://localhost:${port}`);
});