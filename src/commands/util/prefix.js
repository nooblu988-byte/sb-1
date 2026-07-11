const { ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

const c = (text) => ({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 });

module.exports = {
    name: 'prefix',
    aliases: ['setprefix', 'set-prefix'],
    description: "View or change the server prefix",
    category: 'util',
    cooldown: 3,
    run: async (client, message, args, prefix) => {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.channel.send(c(`${client.emoji.cross} | You require \`MANAGE_GUILD\` permissions to change guild prefix.`));
        }

        if (!args[0]) {
            return message.channel.send(c(`My prefix for this server is: \`${prefix}\``));
        }

        if (args[0].length > 3) {
            return message.channel.send(c(`${client.emoji.cross} | Prefix cannot be longer than 3 characters.`));
        }

        if (args[1]) {
            return message.channel.send(c(`${client.emoji.cross} | Prefix cannot contain spaces.`));
        }

        if (args[0] === client.config.prefix) {
            await client.db.delete(`prefix_${message.guild.id}`);
            return message.channel.send(c(`${client.emoji.tick} | Successfully reset the guild prefix to \`${client.config.prefix}\`.`));
        }

        await client.db.set(`prefix_${message.guild.id}`, args[0]);
        return message.channel.send(c(`${client.emoji.tick} | Guild prefix has been set to \`${args[0]}\`.`));
    }
};
