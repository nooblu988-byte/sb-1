const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require("discord.js");

const {
    getPendingKey,
} = require("../../utils/premiumSystem");

const ACCENT = 0x26272F;
const KEY_WAIT_MS = 5 * 60 * 1000;

module.exports = {
    name: "premiumkey",
    aliases: ["redeemkey", "bmkey"],
    description: "Redeem your Beast Mode premium key",
    category: "premium",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
        if (message.author.id !== message.guild.ownerId) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${client.emoji.cross} Only the **server owner** can use this command.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const guildId = message.guild.id;
        const pending = getPendingKey(client, guildId);

        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        if (!pending) {
            return reply(`${client.emoji.cross} There's no pending key to redeem for this server. Run \`${prefix}premium\` to request a plan first.`);
        }

        await reply(`${client.emoji.arrow} Enter your key — reply in this channel within 5 minutes.`);

        if (!client._premiumKeyPending) client._premiumKeyPending = new Map();
        client._premiumKeyPending.set(`${guildId}_${message.author.id}`, {
            channelId: message.channel.id,
            expires: Date.now() + KEY_WAIT_MS,
        });
    },
};
