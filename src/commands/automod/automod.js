const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const ALL_MODULES = [
    { key: "promotion",   name: "Anti Promotion"   },
    { key: "links",       name: "Anti Links"        },
    { key: "spam",        name: "Anti Spam"         },
    { key: "massMention", name: "Anti Mass Mention" },
    { key: "massImages",  name: "Anti Mass Images"  },
    { key: "massForward", name: "Anti Mass Forward" },
    { key: "abuse",       name: "Anti Abuse"        },
    { key: "nsfw",        name: "Anti NSFW"         },
    { key: "nsfwImages",  name: "Anti NSFW Images"  },
    { key: "caps",        name: "Anti Caps"         },
    { key: "emojiSpam",   name: "Anti Emoji Spam"   },
];

const TIMEOUT_LABEL = {
    60000:    "1 Minute",
    300000:   "5 Minutes",
    900000:   "15 Minutes",
    1800000:  "30 Minutes",
    3600000:  "1 Hour",
    21600000: "6 Hours",
    86400000: "24 Hours",
};

module.exports = {
    name: "automod",
    aliases: ["am"],
    description: "Enable or disable server automod protection",
    category: "automod",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const ENABLED_EMOJI  = client.emoji.enabled2;
        const DISABLED_EMOJI = client.emoji.disabled2;

        const owners      = client.config?.owner || [];
        const extra1      = await client.db.get(`ownerPermit1_${message.guild.id}`);
        const extra2      = await client.db.get(`ownerPermit2_${message.guild.id}`);
        const extraOwners = [extra1, extra2].filter(Boolean);

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id) &&
            !extraOwners.includes(message.author.id)
        ) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Only the **Server Owner** can use this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const sub       = args[0]?.toLowerCase();
        const guildId   = message.guild.id;
        const key       = `automod_${guildId}`;
        const cfgKey    = `automod_cfg_${guildId}`;
        const isEnabled = client.lmdbGet(key) === "enabled";
        const cfg       = client.lmdbGet(cfgKey) || {};

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Automod System")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}automod enable\` — Enable with default settings\n` +
                                `\`${prefix}automod disable\` — Disable automod\n` +
                                `\`${prefix}automod status\` — View current configuration\n` +
                                `\`${prefix}amsetup\` — Run the full setup`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`-# Requested by ${message.author.tag}`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        
        if (sub === "status") {
            const userWl    = client.lmdbGet(`amwhitelist_${guildId}`) || [];
            const channelWl = client.lmdbGet(`amcwl_${guildId}`)      || [];
            const roleWl    = client.lmdbGet(`amrwl_${guildId}`)      || [];
            const customF   = client.lmdbGet(`amfilter_${guildId}`)   || [];
            const modules   = cfg.modules || {};
            const limits    = cfg.limits  || {};
            const strikes   = cfg.strikes || {};

            const actionDisplay = {
                delete:  "Delete Only",
                timeout: `Delete + Timeout (${TIMEOUT_LABEL[limits.timeoutDuration] || "5 min"})`,
                kick:    "Delete + Kick",
                ban:     "Delete + Ban",
            };

            let currentPage = "status";

            const buildStatus = () =>
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ${message.guild.name} — Automod Status`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Status:** ${isEnabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                            `**Punishment:** \`${actionDisplay[cfg.action || "delete"] || "Delete Only"}\`\n` +
                            `**Strike System:** \`${strikes.enabled ? `Enabled — escalate at ${strikes.threshold}` : "Disabled"}\`\n` +
                            `**DM Notify:** \`${cfg.dmNotify ? "Enabled" : "Disabled"}\`\n` +
                            `**Log Channel:** ${cfg.logChannel ? `<#${cfg.logChannel}>` : "\`Not set\`"}`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Whitelisted Users:** \`${userWl.length}\`\n` +
                            `**Whitelisted Channels:** \`${channelWl.length}\`\n` +
                            `**Whitelisted Roles:** \`${roleWl.length}\`\n` +
                            `**Custom Filter Words:** \`${customF.length}\``
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("am_modules")
                                .setLabel("View Modules")
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId("am_limits")
                                .setLabel("View Limits")
                                .setStyle(ButtonStyle.Secondary),
                        )
                    );

            const buildModules = () => {
                const modLines = ALL_MODULES.map(m => {
                    const modCfg = modules[m.key];
                    const on     = modCfg?.enabled ?? (isEnabled);
                    return `${on ? ENABLED_EMOJI : DISABLED_EMOJI} ${m.name}`;
                }).join("\n");

                return new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## Automod Modules")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(modLines)
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            isEnabled
                                ? `-# Use \`${prefix}amsetup\` to configure individual modules.`
                                : `-# Enable automod to activate modules.`
                        )
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("am_back")
                                .setLabel("Back")
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji(client.emoji.back)
                        )
                    );
            };

            const buildLimits = () =>
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## Automod Limits")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Spam:** \`${limits.spamCount || 5} messages / ${(limits.spamWindow || 5000) / 1000}s\`\n` +
                            `**Mass Mention:** \`${limits.mentionLimit || 5} mentions\`\n` +
                            `**Mass Images:** \`${limits.imageLimit || 5} attachments\`\n` +
                            `**Caps Threshold:** \`${limits.capsPercent || 70}%\`\n` +
                            `**Emoji Spam:** \`${limits.emojiLimit || 10} emojis\``
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `-# Use \`${prefix}amsetup\` to adjust these values.`
                        )
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("am_back")
                                .setLabel("Back")
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji(client.emoji.back)
                        )
                    );

            const buildExpiredStatus = () =>
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ${message.guild.name} — Automod Status`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Status:** ${isEnabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                            `**Punishment:** \`${actionDisplay[cfg.action || "delete"] || "Delete Only"}\``
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("am_modules_dis")
                                .setLabel("View Modules")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId("am_limits_dis")
                                .setLabel("View Limits")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                        )
                    );

            const sent = await message.reply({
                components: [buildStatus()],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 120000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "am_modules") {
                    currentPage = "modules";
                    return i.update({ components: [buildModules()], flags: MessageFlags.IsComponentsV2 });
                }
                if (i.customId === "am_limits") {
                    currentPage = "limits";
                    return i.update({ components: [buildLimits()], flags: MessageFlags.IsComponentsV2 });
                }
                if (i.customId === "am_back") {
                    currentPage = "status";
                    return i.update({ components: [buildStatus()], flags: MessageFlags.IsComponentsV2 });
                }
            });

            collector.on("end", async () => {
                await sent.edit({ components: [buildExpiredStatus()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            });

            return;
        }

        
        if (sub === "enable") {
            if (isEnabled) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${ENABLED_EMOJI} Automod is already **enabled**.\n-# Use \`${prefix}amsetup\` to change the configuration.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbSet(key, "enabled");
            if (!client._automodCache) client._automodCache = new Map();
            client._automodCache.set(guildId, true);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${ENABLED_EMOJI} Automod has been **enabled** with default settings.\n` +
                                `-# Run \`${prefix}amsetup\` to fully configure modules, actions, limits, and more.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        
        if (sub === "disable") {
            if (!isEnabled) {
                return message.reply({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${DISABLED_EMOJI} Automod is already **disabled**.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbDel(key);
            if (!client._automodCache) client._automodCache = new Map();
            client._automodCache.set(guildId, false);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${DISABLED_EMOJI} Automod has been **disabled**.\n-# Your configuration is saved. Re-enable with \`${prefix}automod enable\`.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        return message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${client.emoji.cross} Invalid option. Use \`${prefix}automod <enable|disable|status>\``
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
