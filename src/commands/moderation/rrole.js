const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

module.exports = {
    name: "rrole",
    aliases: ["removerole"],
    description: "Remove a role from a user",
    category: "moderation",
    cooldown: 3,
    run: async (client, message, args, prefix) => {
        const owners = client.config.owner;
        const hasPermission = message.member.permissions.has(PermissionFlagsBits.Administrator) || owners.includes(message.author.id);

        const reply = (content, color = 0x26272F) => message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!hasPermission) {
            return reply(`${client.emoji.cross} You need ADMINISTRATOR permission to use this command.`);
        }

        if (args.length < 2) {
            return reply(`${client.emoji.cross} Command Usage: \`${prefix}rrole <user> <role>\``);
        }

        let role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        let user = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

        if (!role) return reply(`${client.emoji.cross} Please provide a valid role.`);
        if (!user) return reply(`${client.emoji.cross} Please provide a valid user.`);

        if (
            message.member.roles.highest.position <= user.roles.highest.position &&
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id)
        ) {
            return reply(`${client.emoji.cross} You can't change roles for users with roles higher or equal to yours.`);
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
            return reply(`${client.emoji.cross} I can't remove a role higher or equal to my highest role.`);
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return reply(`${client.emoji.cross} I don't have permission to manage roles.`);
        }

        const reason = `${message.author.tag} removed role ${role.name} from ${user.user.tag}`;

        try {
            await user.roles.remove(role, reason);
            return reply(`${client.emoji.tick} Successfully removed the role **${role.name}** from **${user.user.tag}**.`, 0x57F287);
        } catch (err) {
            console.error("Error removing role:", err);
            return reply(`${client.emoji.cross} I can't remove that role. Please check my role position and permissions.`);
        }
    },
};
