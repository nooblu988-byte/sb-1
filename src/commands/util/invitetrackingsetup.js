const {
    ContainerBuilder,
    TextDisplayBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const { getConfig, saveConfig, primeGuildCache } = require("../../utils/inviteTracking");

const ACCENT = 0x26272F;

module.exports = {
    name: "invitetrackingsetup",
    aliases: ["invtrack", "invitetracking"],
    description: "Set the join and leave channels for invite tracking",
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

        const joinChannel = message.mentions.channels.at(0);
        const leaveChannel = message.mentions.channels.at(1);

        if (!joinChannel || !leaveChannel) {
            const current = getConfig(client, message.guild.id);
            return reply(
                current
                    ? `${client.emoji.arrow} Currently — Join log: <#${current.joinChannelId}>, Leave log: <#${current.leaveChannelId}>.\n` +
                      `-# Usage: \`invitetrackingsetup #join-channel #leave-channel\` to change it.`
                    : `${client.emoji.cross} Usage: \`invitetrackingsetup #join-channel #leave-channel\``
            );
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return reply(`${client.emoji.cross} I need **Manage Server** permission to read server invites for this to work.`);
        }

        saveConfig(client, message.guild.id, {
            joinChannelId: joinChannel.id,
            leaveChannelId: leaveChannel.id,
        });

        await primeGuildCache(client, message.guild);

        return reply(`${client.emoji.enabled2} Invite tracking set up — joins go to ${joinChannel}, leaves go to ${leaveChannel}.`);
    },
};
