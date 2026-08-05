const QRCode = require("qrcode");

function getUpi(client, userId) {
    return client.lmdbGet(`qr_upi_${userId}`) || null;
}
function saveUpi(client, userId, data) {
    return client.lmdbSet(`qr_upi_${userId}`, data);
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
    getUpi,
    saveUpi,
    getLogChannel,
    setLogChannel,
    buildUpiURL,
    generateQR,
};
