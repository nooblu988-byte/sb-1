const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require("discord.js");

const { setDefaultUpi, setNamedUpi, removeNamedUpi, listNamedUpis } = require("../../utils/qrSystem");

const ACCENT = 0x26272F;
const UPI_REGEX = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

module.exports = {
    name: "qrsetup",
    aliases: ["setupi"],
    description: "Save your own UPI ID, or save a friend's UPI ID under a nickname",
    category: "utility",
    cooldown: 3,

    run: async (client, message, args) => {
        // Public channel reply — never includes any UPI ID, only a status message.
        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        // Anything containing an actual UPI ID goes to DM only, never the channel.
        const dm = async (content) => {
            try {
                await message.author.send({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(ACCENT)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
                return true;
            } catch {
                return false;
            }
        };

        const sub = args[0]?.toLowerCase();

        // qrsetup list
        if (sub === "list") {
            const named = listNamedUpis(client, message.author.id);
            const entries = Object.entries(named);
            if (!entries.length) return reply(`${client.emoji.arrow} You haven't saved any named UPI IDs yet. Use \`qrsetup save <nickname> <upi-id> [name]\`.`);

            const lines = entries.map(([nick, v]) => `**${nick}** — \`${v.upiId}\` (${v.payeeName})`).join("\n");
            const sent = await dm(`${client.emoji.arrow} **Your saved UPI IDs:**\n${lines}`);
            return reply(sent ? `${client.emoji.enabled2} Sent your saved UPI IDs to your DMs.` : `${client.emoji.cross} Couldn't DM you — enable DMs from server members and try again.`);
        }

        // qrsetup remove <nickname>
        if (sub === "remove") {
            const nickname = args[1];
            if (!nickname) return reply(`${client.emoji.cross} Usage: \`qrsetup remove <nickname>\``);
            removeNamedUpi(client, message.author.id, nickname);
            return reply(`${client.emoji.enabled2} Removed saved UPI ID **${nickname}**.`);
        }

        // qrsetup save <nickname> <upi-id> [name]
        if (sub === "save") {
            const nickname = args[1];
            const upiId = args[2];
            const payeeName = args.slice(3).join(" ").trim() || nickname;

            if (!nickname || !upiId || !UPI_REGEX.test(upiId)) {
                return reply(`${client.emoji.cross} Usage: \`qrsetup save <nickname> <upi-id> [name]\` — check your DMs are open, this info is never shown in the channel.`);
            }

            setNamedUpi(client, message.author.id, nickname, upiId, payeeName);
            const sent = await dm(`${client.emoji.enabled2} Saved **${nickname}** → \`${upiId}\` (${payeeName}).\nUse \`qr <amount> ${nickname}\` to generate a QR for them.`);
            return reply(sent ? `${client.emoji.enabled2} Saved **${nickname}** — check your DMs for confirmation.` : `${client.emoji.cross} Saved, but couldn't DM you confirmation — enable DMs from server members.`);
        }

        // qrsetup <upi-id> [name]  → sets your own default UPI
        const upiId = args[0];
        const payeeName = args.slice(1).join(" ").trim() || message.author.username;

        if (!upiId || !UPI_REGEX.test(upiId)) {
            return reply(
                `${client.emoji.cross} Usage:\n` +
                `\`qrsetup <upi-id> [your name]\` — set your own default UPI\n` +
                `\`qrsetup save <nickname> <upi-id> [name]\` — save someone else's UPI under a nickname\n` +
                `\`qrsetup list\` — view saved nicknames (sent by DM)\n` +
                `\`qrsetup remove <nickname>\` — remove a saved nickname\n` +
                `-# UPI IDs are never shown in the channel — only sent to your DMs.`
            );
        }

        setDefaultUpi(client, message.author.id, upiId, payeeName);
        const sent = await dm(`${client.emoji.enabled2} Your default UPI ID saved: **${upiId}** (${payeeName}).\nUse \`qr <amount>\` to generate a payment QR code.`);
        return reply(sent ? `${client.emoji.enabled2} Default UPI saved — check your DMs for confirmation.` : `${client.emoji.cross} Saved, but couldn't DM you confirmation — enable DMs from server members.`);
    },
};
