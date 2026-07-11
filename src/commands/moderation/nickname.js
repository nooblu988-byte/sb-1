const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

module.exports = {
    name: "nickname",
    aliases: ["nick"],
    description: "Change or reset a user's nickname",
    category: "moderation",
    cooldown: 3,
    run: async (client, message, args, prefix) => {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const reply = (content, color = 0x26272F) => message.channel.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(color)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return reply(`${client.emoji.cross} You need the \`MANAGE_NICKNAMES\` permission to use this command.`);
        }

        if (!args[0]) {
            return reply(`${client.emoji.cross} Usage: \`${prefix}nick @user <nickname>\``);
        }

        const actualMentions = message.mentions.users.filter(user => {
            if (message.reference && message.reference.messageId) {
                return !message.mentions.repliedUser || user.id !== message.mentions.repliedUser.id;
            }
            return true;
        });

        let target = actualMentions.first();
        if (!target) target = await client.users.fetch(args[0]).catch(() => null);

        if (!target) return reply(`${client.emoji.cross} Couldn't find any user from mention or ID.`);

        if (target.id === client.user.id) {
            return reply(`${client.emoji.cross} I can't change my own nickname.`);
        }

        const member = await message.guild.members.fetch(target.id).catch(() => null);

        if (!member) return reply(`${client.emoji.cross} This user is not in the server.`);

        if (!member.manageable) {
            return reply(`${client.emoji.cross} I can't change this user's nickname. Their role may be higher or I'm missing permissions.`);
        }

        // Server owner can change ANYONE's nickname (including themselves)
        if (message.author.id === message.guild.ownerId) {
            // No restrictions for owner, proceed directly
        } else if (message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            // Admin can change anyone EXCEPT the server owner
            if (target.id === message.guild.ownerId) {
                return reply(`${client.emoji.cross} You can't change the **server owner**'s nickname.`);
            }
        } else {
            // Normal staff (ManageNicknames only) can change anyone EXCEPT owner and admins
            if (target.id === message.guild.ownerId) {
                return reply(`${client.emoji.cross} You can't change the **server owner**'s nickname.`);
            }
            if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                return reply(`${client.emoji.cross} You can't change **${target.username}**'s nickname. Only **administrators** or the **server owner** can nickname administrators.`);
            }
        }

        const newNick = args.slice(1).join(" ");

        if (!newNick) {
            await member.setNickname(null).catch(() => {});
            return reply(`${client.emoji.tick} Nickname for **[${target.username}](https://discord.com/users/${target.id})** has been reset.`, 0x57F287);
        }

        if (newNick.length > 32) {
            return reply(`${client.emoji.cross} Nickname cannot be longer than 32 characters.`);
        }

        await member.setNickname(newNick).catch(() => {});

        return reply(`${client.emoji.tick} **[${target.username}](https://discord.com/users/${target.id})** nickname has been changed to **${newNick}**.`, 0x57F287);
    },
};
