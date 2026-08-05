const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

const { getProfile, getNamedUpi, getLogChannel, buildUpiURL, generateQR } = require("../../utils/qrSystem");

const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const UPI_REGEX = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

function parseAmount(text) {
    if (!text) return null;
    const match = text.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    if (!match) return null;
    const value = parseFloat(match[1]);
    return value > 0 ? value : null;
}

module.exports = {
    name: "qr",
    aliases: ["makeqr", "paymentqr"],
    description: "Generate a UPI payment QR code — for yourself, a saved nickname, or a one-time UPI ID",
    category: "utility",
    cooldown: 3,

    run: async (client, message, args) => {
        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        const amount = parseAmount(args[0]);
        if (!amount) {
            return reply(`${client.emoji.cross} Usage: \`qr <amount>\`, \`qr <amount> <nickname>\`, or \`qr <amount> <upi-id> [name]\``);
        }

        const second = args[1];
        let upiId, payeeName;

        if (second && UPI_REGEX.test(second)) {
            // One-time raw UPI ID override
            upiId = second;
            payeeName = args.slice(2).join(" ").trim() || message.author.username;
        } else if (second) {
            // Treat as a saved nickname
            const named = getNamedUpi(client, message.author.id, second);
            if (!named) {
                return reply(`${client.emoji.cross} No saved UPI found under **${second}**. Use \`qrsetup save ${second} <upi-id> [name]\` first.`);
            }
            upiId = named.upiId;
            payeeName = named.payeeName;
        } else {
            // No second argument — use your own default UPI
            const profile = getProfile(client, message.author.id);
            if (!profile.default) {
                return reply(`${client.emoji.cross} You haven't set a UPI ID yet. Run \`qrsetup <upi-id> [name]\` first, or use \`qr <amount> <upi-id>\`.`);
            }
            upiId = profile.default.upiId;
            payeeName = profile.default.payeeName;
        }

        const upiURL = buildUpiURL({ upiId, payeeName, amount: amount.toFixed(2) });

        let buffer;
        try {
            buffer = await generateQR(upiURL);
        } catch {
            return reply(`${client.emoji.cross} Failed to generate the QR code. Check the UPI ID and try again.`);
        }

        const file = new AttachmentBuilder(buffer, { name: "payment-qr.png" });

        // ─── Log to the configured QR-logs channel, with a .txt transcript ─
        const logChannelId = getLogChannel(client, message.guild.id);
        if (logChannelId) {
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (!logChannel) {
                console.error(`[QR Log] Configured log channel ${logChannelId} not found in cache for guild ${message.guild.id}`);
            } else {
                const now = new Date();
                const transcript =
                    `QR Code Generation Log\n` +
                    `${"=".repeat(40)}\n\n` +
                    `Generated At   : ${now.toISOString()} (${now.toUTCString()})\n` +
                    `Server         : ${message.guild.name} (${message.guild.id})\n` +
                    `Channel        : #${message.channel.name} (${message.channel.id})\n\n` +
                    `Requested By   : ${message.author.tag} (${message.author.id})\n\n` +
                    `Amount         : Rs ${amount.toFixed(2)}\n` +
                    `Payee Name     : ${payeeName}\n` +
                    `UPI ID         : ${upiId}\n` +
                    `UPI Link       : ${upiURL}\n\n` +
                    `${"=".repeat(40)}\n` +
                    `Note: This confirms a QR code was generated with these details.\n` +
                    `It does NOT confirm the payment was actually completed — this bot\n` +
                    `has no payment-gateway integration to verify that.\n`;

                const transcriptFile = new AttachmentBuilder(Buffer.from(transcript, "utf-8"), {
                    name: `qr-log-${message.author.id}-${now.getTime()}.txt`,
                });

                try {
                    await logChannel.send({
                        files: [transcriptFile],
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(ACCENT)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${client.emoji.arrow} QR generated by ${message.author} for **Rs ${amount.toFixed(2)}** to \`${upiId}\` (${payeeName}) in ${message.channel}.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                } catch (err) {
                    console.error("[QR Log] Failed to send log message:", err?.message || err);
                }
            }
        }

        return message.reply({
            files: [file],
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Pay Rs ${amount.toFixed(2)}`))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**To:** ${payeeName}\n\nScan with any UPI app (GPay, PhonePe, Paytm, etc.)`)
                    )
                    .addSeparatorComponents(sep())
                    .addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL("attachment://payment-qr.png"))
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
