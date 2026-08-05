const {
    ContainerBuilder,
    TextDisplayBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const { setLogChannel, getLogChannel } = require("../../utils/qrSystem");

const ACCENT = 0x26272F;

module.exports = {
    name: "qrlogssetup",
    aliases: ["qrlogs"],
    description: "Set the channel where QR generation logs (with a transcript file) are sent",
    category: "utility",
    cooldown: 5,

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

        if (
            message.author.id !== message.guild.ownerId &&
            !(client.config?.owner || []).includes(message.author.id) &&
            !message.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
            return reply(`${client.emoji.cross} Only the **server owner** or an **Administrator** can use this command.`);
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            const current = getLogChannel(client, message.guild.id);
            return reply(
                current
                    ? `${client.emoji.arrow} QR logs are currently sent to <#${current}>.\n-# Usage: \`qrlogssetup #channel\` to change it.`
                    : `${client.emoji.cross} Usage: \`qrlogssetup #channel\``
            );
        }

        setLogChannel(client, message.guild.id, channel.id);
        return reply(`${client.emoji.enabled2} QR generation logs will now be sent to ${channel}, with a full transcript file for each one.`);
    },
};
