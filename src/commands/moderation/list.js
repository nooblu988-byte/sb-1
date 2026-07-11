const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

module.exports = {
    name: "list",
    description: "List admins, bots, bans, roles, and more",
    category: "moderation",
    cooldown: 3,
    run: async (client, message, args) => {
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        let currentPage = 0;
        const pageSize = 10;
        const listType = args[0]?.toLowerCase();

        const memberTypes = ["admin", "admins", "administration", "bot", "bots", "inrole", "inroles", "boosters", "norole", "invc", "muted"];
        if (memberTypes.includes(listType)) {
            await message.guild.members.fetch().catch(() => {});
        }

        const getListData = async () => {
            switch (listType) {
                case "admin":
                case "admins":
                case "administration": {
                    const administrators = message.guild.members.cache.filter(
                        m => m.permissions.has(PermissionFlagsBits.Administrator) && !m.user.bot
                    );
                    return {
                        title: `Admins in ${message.guild.name}`,
                        members: Array.from(administrators.values()),
                        format: (member, i) =>
                            `\`[${i + 1}]\` | [${member.user.tag}](https://discord.com/users/${member.user.id}) | \`${member.user.id}\``,
                    };
                }

                case "bots":
                case "bot": {
                    const bots = message.guild.members.cache.filter(m => m.user.bot);
                    return {
                        title: `Bots in ${message.guild.name}`,
                        members: Array.from(bots.values()),
                        format: (m, i) =>
                            `\`[${i + 1}]\` | [${m.user.tag}](https://discord.com/users/${m.user.id}) | \`${m.user.id}\``,
                    };
                }

                case "bans":
                case "ban": {
                    const bans = await message.guild.bans.fetch();
                    const valid = bans.filter(b => b.user).map(b => b.user);
                    return {
                        title: `Banned Members in ${message.guild.name}`,
                        members: valid,
                        format: (u, i) =>
                            `\`[${i + 1}]\` | [${u.tag}](https://discord.com/users/${u.id}) | \`${u.id}\``,
                    };
                }

                case "inrole":
                case "inroles": {
                    const roleId = args[1]?.replace(/\D/g, "") || message.mentions.roles.first()?.id;
                    const role = message.guild.roles.cache.get(roleId);
                    if (!role) return null;
                    return {
                        title: `Members with ${role.name} in ${message.guild.name}`,
                        members: Array.from(role.members.values()),
                        format: (m, i) =>
                            `\`[${i + 1}]\` | [${m.user.tag}](https://discord.com/users/${m.user.id}) | \`${m.user.id}\``,
                    };
                }

                case "boosters": {
                    const boosters = message.guild.members.cache.filter(m => m.premiumSinceTimestamp);
                    const now = Date.now();
                    return {
                        title: `Boosters in ${message.guild.name}`,
                        members: Array.from(boosters.values()),
                        format: (m, i) => {
                            const days = Math.floor((now - m.premiumSinceTimestamp) / (1000 * 60 * 60 * 24));
                            return `\`[${i + 1}]\` | [${m.user.tag}](https://discord.com/users/${m.user.id}) | \`${m.user.id}\` | Boosted \`${days}\` day(s) ago`;
                        },
                    };
                }

                case "emoji":
                case "emojis": {
                    const emojis = Array.from(message.guild.emojis.cache.values());
                    return {
                        title: `Emojis in ${message.guild.name}`,
                        members: emojis,
                        format: (emoji, i) =>
                            `\`[${i + 1}]\` | ${emoji} | \`${emoji.id}\` | Name: \`${emoji.name}\``,
                    };
                }

                case "role":
                case "roles": {
                    const roles = message.guild.roles.cache
                        .filter(r => r.name !== "@everyone")
                        .sort((a, b) => b.position - a.position);
                    return {
                        title: `Roles in ${message.guild.name}`,
                        members: Array.from(roles.values()),
                        format: (r, i) =>
                            `\`[${i + 1}]\` | <@&${r.id}> | \`${r.id}\` | Members: \`${r.members.size}\``,
                    };
                }

                case "invc": {
                    const vcMembers = message.guild.members.cache.filter(m => m.voice.channel);
                    return {
                        title: `Members in Voice Channels in ${message.guild.name}`,
                        members: Array.from(vcMembers.values()),
                        format: (m, i) =>
                            `\`[${i + 1}]\` | [${m.user.tag}](https://discord.com/users/${m.user.id}) | \`${m.user.id}\``,
                    };
                }

                case "norole": {
                    const noRole = message.guild.members.cache.filter(m => m.roles.cache.size === 1);
                    return {
                        title: `Members without Roles in ${message.guild.name}`,
                        members: Array.from(noRole.values()),
                        format: (m, i) =>
                            `\`[${i + 1}]\` | [${m.user.tag}](https://discord.com/users/${m.user.id}) | \`${m.user.id}\``,
                    };
                }

                case "muted": {
                    const muted = message.guild.members.cache.filter(m => m.communicationDisabledUntilTimestamp);
                    return {
                        title: `Muted Members in ${message.guild.name}`,
                        members: Array.from(muted.values()),
                        format: (m, i) => {
                            const mins = Math.floor((m.communicationDisabledUntilTimestamp - Date.now()) / (1000 * 60));
                            return `\`[${i + 1}]\` | [${m.user.tag}](https://discord.com/users/${m.user.id}) | \`${m.user.id}\` | Muted \`${mins}\` min(s)`;
                        },
                    };
                }

                default:
                    return null;
            }
        };

        const listData = await getListData();

        if (!listData) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Invalid List Type"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                "**Available Types:**\n" +
                                "`list admin` `list bot` `list ban` `list inrole @role`\n" +
                                "`list role` `list boosters` `list emojis`\n" +
                                "`list norole` `list invc` `list muted`"
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const totalPages = Math.max(1, Math.ceil(listData.members.length / pageSize));

        const buildContainer = (disabled = false) => {
            const start = currentPage * pageSize;
            const members = listData.members.slice(start, start + pageSize);
            const suffix = disabled ? "_d" : "";

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${listData.title}`))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        members.length
                            ? members.map((m, i) => listData.format(m, start + i)).join("\n")
                            : "No data found."
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# Page ${currentPage + 1} of ${totalPages} | Total: ${listData.members.length}`)
                )
                .addActionRowComponents(row =>
                    row.addComponents(
                        new ButtonBuilder().setCustomId("first" + suffix).setLabel("≪").setStyle(ButtonStyle.Primary).setDisabled(disabled || currentPage === 0),
                        new ButtonBuilder().setCustomId("previous" + suffix).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(disabled || currentPage === 0),
                        new ButtonBuilder().setCustomId("close" + suffix).setLabel("Delete").setStyle(ButtonStyle.Danger).setDisabled(disabled),
                        new ButtonBuilder().setCustomId("next" + suffix).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(disabled || currentPage === totalPages - 1),
                        new ButtonBuilder().setCustomId("last" + suffix).setLabel("≫").setStyle(ButtonStyle.Primary).setDisabled(disabled || currentPage === totalPages - 1)
                    )
                );
        };

        const sentMessage = await message.reply({
            components: [buildContainer()],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = sentMessage.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.message.id === sentMessage.id,
            time: 300000,
        });

        collector.on("collect", async i => {
            switch (i.customId) {
                case "first":   currentPage = 0; break;
                case "previous": currentPage = Math.max(currentPage - 1, 0); break;
                case "next":    currentPage = Math.min(currentPage + 1, totalPages - 1); break;
                case "last":    currentPage = totalPages - 1; break;
                case "close":
                    await i.message.delete().catch(() => {});
                    return collector.stop();
            }
            await i.update({ components: [buildContainer()], flags: MessageFlags.IsComponentsV2 });
        });

        collector.on("end", async () => {
            await sentMessage.edit({
                components: [buildContainer(true)],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};
