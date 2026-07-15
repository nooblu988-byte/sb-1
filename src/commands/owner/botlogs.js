const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    name: "botlogs",
    aliases: ["blog", "botlog"],
    description: "Enable or disable global bot activity logging",
    category: "owner",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        if (!client.config.owner.includes(message.author.id)) return;

        const sub = args[0]?.toLowerCase();
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## 👑 Global Bot Logs")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}botlogs enable\` — Setup and enable logging channels\n` +
                                `\`${prefix}botlogs disable\` — Disable global logging\n` +
                                `\`${prefix}botlogs status\` — View current logging configuration`
                            )
                        )
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (sub === "status") {
            const config = client.lmdbGet("global_botlogs_config");
            if (!config) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent("❌ Global bot logs are currently **disabled**.")
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x57F287)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## 📊 Global Bot Logs Status")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Logging Guild**: \`${config.guildId}\`\n` +
                                `**Server Join/Leave Channel**: <#${config.guildsChannelId}> (\`${config.guildsChannelId}\`)\n` +
                                `**Command Channel**: <#${config.commandsChannelId}> (\`${config.commandsChannelId}\`)\n` +
                                `**Violations Channel**: <#${config.violationsChannelId}> (\`${config.violationsChannelId}\`)`
                            )
                        )
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        if (sub === "enable") {
            const currentConfig = client.lmdbGet("global_botlogs_config");
            if (currentConfig && currentConfig.guildId === message.guild.id) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFFCC00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`⚠️ Global logs are already enabled in this server. Use \`${prefix}botlogs status\` to view.`)
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            try {
                const setupMsg = await message.channel.send({ content: "⏳ Creating logging channels and category..." });

                // Create category
                const category = await message.guild.channels.create({
                    name: "👑 NOOBLU BOT LOGS",
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: message.guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: client.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.ReadMessageHistory,
                            ],
                        },
                        {
                            id: message.author.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.ReadMessageHistory,
                            ],
                        }
                    ]
                });

                // Create channels under category
                const guildsChan = await message.guild.channels.create({
                    name: "bot-guilds",
                    type: ChannelType.GuildText,
                    parent: category.id,
                });

                const commandsChan = await message.guild.channels.create({
                    name: "bot-commands",
                    type: ChannelType.GuildText,
                    parent: category.id,
                });

                const violationsChan = await message.guild.channels.create({
                    name: "bot-violations",
                    type: ChannelType.GuildText,
                    parent: category.id,
                });

                // Save to database
                const logConfig = {
                    guildId: message.guild.id,
                    guildsChannelId: guildsChan.id,
                    commandsChannelId: commandsChan.id,
                    violationsChannelId: violationsChan.id
                };

                client.lmdbSet("global_botlogs_config", logConfig);

                await setupMsg.delete().catch(() => {});

                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x57F287)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent("## ✅ Global Bot Logs Enabled")
                            )
                            .addSeparatorComponents(sep())
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `Successfully created and configured global logging channels:\n` +
                                    `• Category: **${category.name}**\n` +
                                    `• Joins/Leaves: ${guildsChan}\n` +
                                    `• Commands: ${commandsChan}\n` +
                                    `• Violations: ${violationsChan}`
                                )
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            } catch (err) {
                console.error("[BotLogs Enable Error]", err);
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`❌ Failed to setup channels: \`${err.message}\``)
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        }

        if (sub === "disable") {
            const config = client.lmdbGet("global_botlogs_config");
            if (!config) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0xFF0000)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent("❌ Global bot logs are not enabled.")
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbDel("global_botlogs_config");

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x57F287)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("✅ Global bot logs have been **disabled**.")
                        )
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }
    }
};
