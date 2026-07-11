const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} = require("discord.js");

module.exports = {
    name: "role",
    aliases: ["giverole", "addrole"],
    description: "Assign a role to a user",
    category: "moderation",
    cooldown: 3,
    slashCommand: new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage user roles")
        .addSubcommand(sub =>
            sub.setName("add")
                .setDescription("Add a role to a user")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("The user to add the role to").setRequired(true))
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("The role to add").setRequired(true)))
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a role from a user")
                .addUserOption(opt =>
                    opt.setName("user").setDescription("The user to remove the role from").setRequired(true))
                .addRoleOption(opt =>
                    opt.setName("role").setDescription("The role to remove").setRequired(true))),

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

        if (!hasPermission) return reply(`${client.emoji.cross} You need ADMINISTRATOR permission to use this command.`);
        if (args.length < 2) return reply(`${client.emoji.cross} Command Usage: \`${prefix}role <user> <role>\``);

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
            return reply(`${client.emoji.cross} I can't assign a role higher or equal to my highest role.`);
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return reply(`${client.emoji.cross} I don't have permission to manage roles.`);
        }

        try {
            await user.roles.add(role, `${message.author.tag} assigned role ${role.name} to ${user.user.tag}`);
            return reply(`${client.emoji.tick} Successfully assigned the role **${role.name}** to **${user.user.tag}**.`, 0x57F287);
        } catch (err) {
            console.error("Error assigning role:", err);
            return reply(`${client.emoji.cross} I can't assign that role. Please check my role position and permissions.`);
        }
    },

    runSlash: async (client, interaction) => {
        const owners = client.config.owner;
        const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || owners.includes(interaction.user.id);

        const reply = (content, color = 0x26272F, ephemeral = false) => interaction.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: ephemeral ? MessageFlags.IsComponentsV2 | 64 : MessageFlags.IsComponentsV2,
        });

        if (!hasPermission) return reply(`${client.emoji.cross} You need ADMINISTRATOR permission to use this command.`, 0x26272F, true);

        const subcommand = interaction.options.getSubcommand();
        const user = interaction.options.getMember("user");
        const role = interaction.options.getRole("role");

        if (!user) return reply(`${client.emoji.cross} User not found in this server.`, 0x26272F, true);

        if (
            interaction.member.roles.highest.position <= user.roles.highest.position &&
            interaction.user.id !== interaction.guild.ownerId &&
            !owners.includes(interaction.user.id)
        ) {
            return reply(`${client.emoji.cross} You can't change roles for users with roles higher or equal to yours.`, 0x26272F, true);
        }

        if (role.position >= interaction.guild.members.me.roles.highest.position) {
            return reply(`${client.emoji.cross} I can't manage a role higher or equal to my highest role.`, 0x26272F, true);
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return reply(`${client.emoji.cross} I don't have permission to manage roles.`, 0x26272F, true);
        }

        try {
            if (subcommand === "add") {
                await user.roles.add(role, `${interaction.user.tag} assigned role ${role.name} to ${user.user.tag}`);
                return reply(`${client.emoji.tick} Successfully assigned **${role.name}** to **${user.user.tag}**.`, 0x57F287);
            } else if (subcommand === "remove") {
                await user.roles.remove(role, `${interaction.user.tag} removed role ${role.name} from ${user.user.tag}`);
                return reply(`${client.emoji.tick} Successfully removed **${role.name}** from **${user.user.tag}**.`, 0x57F287);
            }
        } catch (err) {
            console.error("Error managing role:", err);
            return reply(`${client.emoji.cross} I can't manage that role. Please check my role position and permissions.`, 0x26272F, true);
        }
    },
};
