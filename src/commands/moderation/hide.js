const { ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");

const c = (text) => ({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 });

module.exports = {
    name: "hide",
    aliases: [],
    description: "Hide a channel from @everyone",
    category: "moderation",
    cooldown: 3,
    run: async (client, message) => {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.channel.send(c(`${client.emoji.cross} | You need \`Manage Channels\` permission to use this command.`));
        }
        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.channel.send(c(`${client.emoji.cross} | I need \`Manage Channels\` permission to hide channels.`));
        }

        const channel = message.mentions.channels.first() || message.channel;

        try {
            await channel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
            return message.channel.send(c(`${client.emoji.tick} | Successfully hidden ${channel}.`));
        } catch {
            return message.channel.send(c(`${client.emoji.cross} | Failed to hide the channel.`));
        }
    }
};
