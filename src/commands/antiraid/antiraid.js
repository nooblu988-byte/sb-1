const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const ANTIRAID_MODULES = [
    { key: "massJoin",   name: "Anti Mass Join"     },
    { key: "accountAge", name: "Account Age Filter"  },
    { key: "botFilter",  name: "Bot Filter"          },
];

const DEFAULT_MODULES = {
    massJoin:   { enabled: true  },
    accountAge: { enabled: false },
    botFilter:  { enabled: true  },
};

module.exports = {
    name: "antiraid",
    aliases: ["ar"],
    description: "Enable or disable server anti-raid protection",
    category: "antiraid",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const ENABLED_EMOJI  = client.emoji.enabled2;
        const DISABLED_EMOJI = client.emoji.disabled2;

        const owners      = client.config?.owner || [];
        const extra1      = client.lmdbGet(`ownerPermit1_${message.guild.id}`);
        const extra2      = client.lmdbGet(`ownerPermit2_${message.guild.id}`);
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
        const key       = `antiraid_${guildId}`;
        const isEnabled = client.lmdbGet(key) === "enabled";

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## AntiRaid System")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}antiraid enable\` — Enable protection\n` +
                                `\`${prefix}antiraid disable\` — Disable protection\n` +
                                `\`${prefix}antiraid status\` — View current status\n` +
                                `\`${prefix}arsetup\` — Full module setup`
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
            const loadCfg = () => {
                const c = client.lmdbGet(`antiraid_cfg_${guildId}`) || {};
                return {
                    action:      c.action       || "kick",
                    alertChannel: c.alertChannel || null,
                    modules: {
                        massJoin:   c.modules?.massJoin   || DEFAULT_MODULES.massJoin,
                        accountAge: c.modules?.accountAge || DEFAULT_MODULES.accountAge,
                        botFilter:  c.modules?.botFilter  || DEFAULT_MODULES.botFilter,
                    },
                };
            };

            let currentPage = "status";

            const buildStatus = () => {
                const cfg = loadCfg();
                return new ContainerBuilder()
                    .setAccentColor(isEnabled ? 0x57F287 : 0xFF0000)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ${message.guild.name} — AntiRaid Status`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Protection** : ${isEnabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                            `**Action** : \`${cfg.action === "ban" ? "Ban" : "Kick"}\`\n` +
                            `**Alert Channel** : ${cfg.alertChannel ? `<#${cfg.alertChannel}>` : "`Not set`"}`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            isEnabled
                                ? `${ENABLED_EMOJI} Anti-raid is actively monitoring joins.`
                                : `${DISABLED_EMOJI} Anti-raid is currently disabled.`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("ar_modules")
                                .setLabel("View Modules")
                                .setStyle(ButtonStyle.Secondary)
                        )
                    );
            };

            const buildModules = () => {
                const cfg = loadCfg();
                const lines = ANTIRAID_MODULES.map(m => {
                    const modCfg  = cfg.modules[m.key];
                    const on      = modCfg?.enabled && isEnabled;
                    let detail    = "";
                    if (m.key === "massJoin" && modCfg?.enabled)
                        detail = ` — \`${cfg.modules.massJoin.threshold ?? 10} joins / ${cfg.modules.massJoin.window ?? 5}s\``;
                    if (m.key === "accountAge" && modCfg?.enabled)
                        detail = ` — \`< ${cfg.modules.accountAge.days ?? 7} days old\``;
                    return `${on ? ENABLED_EMOJI : DISABLED_EMOJI} **${m.name}**${detail}`;
                }).join("\n");

                return new ContainerBuilder()
                    .setAccentColor(isEnabled ? 0x57F287 : 0xFF0000)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## AntiRaid Modules")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(lines)
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            isEnabled
                                ? `-# Active modules are monitoring member joins`
                                : `-# Enable anti-raid to activate protection`
                        )
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("ar_back")
                                .setLabel("Back")
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji(client.emoji.back)
                        )
                    );
            };

            const buildExpiredStatus = () => {
                const cfg = loadCfg();
                return new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ${message.guild.name} — AntiRaid Status`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Protection** : ${isEnabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                            `**Action** : \`${cfg.action === "ban" ? "Ban" : "Kick"}\`\n` +
                            `**Alert Channel** : ${cfg.alertChannel ? `<#${cfg.alertChannel}>` : "`Not set`"}`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            isEnabled
                                ? `${ENABLED_EMOJI} Anti-raid is actively monitoring joins.`
                                : `${DISABLED_EMOJI} Anti-raid is currently disabled.`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("ar_modules_expired")
                                .setLabel("View Modules")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        )
                    );
            };

            const buildExpiredModules = () => {
                const cfg = loadCfg();
                const lines = ANTIRAID_MODULES.map(m => {
                    const modCfg  = cfg.modules[m.key];
                    const on      = modCfg?.enabled && isEnabled;
                    let detail    = "";
                    if (m.key === "massJoin" && modCfg?.enabled)
                        detail = ` — \`${cfg.modules.massJoin.threshold ?? 10} joins / ${cfg.modules.massJoin.window ?? 5}s\``;
                    if (m.key === "accountAge" && modCfg?.enabled)
                        detail = ` — \`< ${cfg.modules.accountAge.days ?? 7} days old\``;
                    return `${on ? ENABLED_EMOJI : DISABLED_EMOJI} **${m.name}**${detail}`;
                }).join("\n");

                return new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("## AntiRaid Modules")
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(lines)
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            isEnabled
                                ? `-# Active modules are monitoring member joins`
                                : `-# Enable anti-raid to activate protection`
                        )
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId("ar_back_expired")
                                .setLabel("Back")
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji(client.emoji.back)
                                .setDisabled(true)
                        )
                    );
            };

            const sent = await message.reply({
                components: [buildStatus()],
                flags: MessageFlags.IsComponentsV2,
            });

            const collector = sent.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 120000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "ar_modules") {
                    currentPage = "modules";
                    return i.update({ components: [buildModules()], flags: MessageFlags.IsComponentsV2 });
                }
                if (i.customId === "ar_back") {
                    currentPage = "status";
                    return i.update({ components: [buildStatus()], flags: MessageFlags.IsComponentsV2 });
                }
            });

            collector.on("end", async () => {
                const expired = currentPage === "modules" ? buildExpiredModules() : buildExpiredStatus();
                await sent.edit({ components: [expired], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
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
                                    `${ENABLED_EMOJI} AntiRaid is already **enabled** for this server.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbSet(key, "enabled");

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x57F287)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${ENABLED_EMOJI} AntiRaid has been **enabled** successfully.\n-# The server is now protected against join raids.`
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
                                    `${DISABLED_EMOJI} AntiRaid is already **disabled** for this server.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            client.lmdbDel(key);

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${DISABLED_EMOJI} AntiRaid has been **disabled** successfully.\n-# Join raid protection is no longer active.`
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
                            `${client.emoji.cross} Invalid option. Use \`${prefix}antiraid <enable|disable|status>\``
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
