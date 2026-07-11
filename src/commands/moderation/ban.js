const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");

module.exports = {
    name: "ban",
    aliases: [],
    description: "Ban a member from the server",
    category: "moderation",
    cooldown: 3,
    run: async (client, message, args, prefix) => {

        const errorContainer = (text) => {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return { components: [container], flags: MessageFlags.IsComponentsV2 };
        };

        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.channel.send(errorContainer(`${client.emoji.error} | You do not have the required **\`BAN_MEMBERS\`** permission to execute this command.`));
        }

        const input = args[0]?.replace(/[<@!>]/g, "");
        const reason = args.slice(1).join(" ") || "No reason provided.";

        if (!input) {
            return message.channel.send(errorContainer(`${client.emoji.error} | **Invalid Usage** — \`${prefix}ban @user/username/ID [reason]\``));
        }

        let member = message.guild.members.cache.get(input)
            || message.guild.members.cache.find(m =>
                m.user.username.toLowerCase() === input.toLowerCase() ||
                m.user.tag?.toLowerCase() === input.toLowerCase() ||
                m.displayName.toLowerCase() === input.toLowerCase()
            );

        let user = member?.user || await client.users.fetch(input).catch(() => null);

        if (!user) {
            return message.channel.send(errorContainer(`${client.emoji.error} | No user was found with that input. Try using their ID, username, or mention.`));
        }

        if (user.id === message.author.id) {
            return message.channel.send(errorContainer(`${client.emoji.error} | You cannot ban yourself.`));
        }

        if (user.id === client.user.id) {
            return message.channel.send(errorContainer(`${client.emoji.error} | I cannot be banned.`));
        }

        if (member) {
            // ─── HIERARCHY CHECK ───
            // Server owner can ban ANYONE (including admins)
            if (message.author.id === message.guild.ownerId) {
                // No restrictions for owner
            } else if (message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                // Admin can ban anyone EXCEPT the server owner
                if (member.id === message.guild.ownerId) {
                    return message.channel.send(errorContainer(`${client.emoji.error} | You cannot ban the **server owner**.`));
                }
            } else {
                // Normal staff (BanMembers only) can ban anyone EXCEPT owner and admins
                if (member.id === message.guild.ownerId) {
                    return message.channel.send(errorContainer(`${client.emoji.error} | You cannot ban the **server owner**.`));
                }
                if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.channel.send(errorContainer(`${client.emoji.error} | You cannot ban **${user.username}**. Only **administrators** or the **server owner** can ban administrators.`));
                }
            }

            if (!member.bannable) {
                return message.channel.send(errorContainer(`${client.emoji.error} | I am unable to ban this member. Their highest role is equal to or above mine.`));
            }

            const dmContainer = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("### 🔨 You Have Been Banned"))
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Server:** ${message.guild.name}\n` +
                        `**Moderator:** [${message.author.username}](http://discord.com/users/${message.author.id})\n` +
                        `**Reason:** ${reason}`
                    )
                );

            try {
                await user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });
            } catch (err) {}
        }

        await message.guild.members.ban(user.id, { reason: `${reason} | Banned by ${message.author.tag}` });

        const successContainer = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${client.emoji.tick2} | **[${user.username}](http://discord.com/users/${user.id})** [\`${user.id}\`] has been banned from the server.\n**Reason:** ${reason}`)
            );

        await message.channel.send({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
    }
};
