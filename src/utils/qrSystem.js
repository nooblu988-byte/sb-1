const QRCode = require("qrcode");

// Each user's profile: { default: {upiId, payeeName} | null, named: { <nickname>: {upiId, payeeName} } }
function getProfile(client, userId) {
    return client.lmdbGet(`qr_upi_${userId}`) || { default: null, named: {} };
}
function saveProfile(client, userId, profile) {
    return client.lmdbSet(`qr_upi_${userId}`, profile);
}

function setDefaultUpi(client, userId, upiId, payeeName) {
    const profile = getProfile(client, userId);
    profile.default = { upiId, payeeName };
    saveProfile(client, userId, profile);
}

function setNamedUpi(client, userId, nickname, upiId, payeeName) {
    const profile = getProfile(client, userId);
    if (!profile.named) profile.named = {};
    profile.named[nickname.toLowerCase()] = { upiId, payeeName };
    saveProfile(client, userId, profile);
}

function getNamedUpi(client, userId, nickname) {
    const profile = getProfile(client, userId);
    return profile.named?.[nickname.toLowerCase()] || null;
}

function removeNamedUpi(client, userId, nickname) {
    const profile = getProfile(client, userId);
    if (profile.named) delete profile.named[nickname.toLowerCase()];
    saveProfile(client, userId, profile);
}

function listNamedUpis(client, userId) {
    return getProfile(client, userId).named || {};
}

function getLogChannel(client, guildId) {
    return client.lmdbGet(`qr_logchannel_${guildId}`) || null;
}
function setLogChannel(client, guildId, channelId) {
    return client.lmdbSet(`qr_logchannel_${guildId}`, channelId);
}

// Builds the standard UPI deep-link string that any UPI app (GPay, PhonePe,
// Paytm, etc.) understands when scanned as a QR code.
function buildUpiURL({ upiId, payeeName, amount, note }) {
    const params = new URLSearchParams({
        pa: upiId,
        pn: payeeName || "Payment",
        am: amount,
        cu: "INR",
    });
    if (note) params.set("tn", note);
    return `upi://pay?${params.toString()}`;
}

async function generateQR(upiURL) {
    return QRCode.toBuffer(upiURL, { width: 512, margin: 2 });
}

module.exports = {
    getProfile,
    saveProfile,
    setDefaultUpi,
    setNamedUpi,
    getNamedUpi,
    removeNamedUpi,
    listNamedUpis,
    getLogChannel,
    setLogChannel,
    buildUpiURL,
    generateQR,
};
