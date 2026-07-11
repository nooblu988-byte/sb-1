const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

module.exports = {
    name: "arsetup",
    aliases: ["ars"],
    description: "Run the anti-raid setup",
    category: "antiraid",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
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

        const guildId  = message.guild.id;
        const cfgKey   = `antiraid_cfg_${guildId}`;
        const existing = client.lmdbGet(cfgKey) || {};

        const state = {
            step:   1,
            action: existing.action || "kick",
            modules: {
                massJoin: {
                    enabled:   existing.modules?.massJoin?.enabled   ?? true,
                    threshold: existing.modules?.massJoin?.threshold ?? 10,
                    window:    existing.modules?.massJoin?.window    ?? 5,
                },
                accountAge: {
                    enabled: existing.modules?.accountAge?.enabled ?? false,
                    days:    existing.modules?.accountAge?.days    ?? 7,
                },
                botFilter: {
                    enabled: existing.modules?.botFilter?.enabled ?? true,
                },
            },
            alertChannel: existing.alertChannel || null,
        };

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        const TOTAL_STEPS = 6;
        const header = (n, title) => `## AntiRaid Setup\n-# Step ${n} of ${TOTAL_STEPS} — ${title}`;

        const backBtn = (disabled = false) =>
            new ButtonBuilder()
                .setCustomId("ar_setup_back")
                .setLabel("← Back")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled);

        const nextBtn = (id) =>
            new ButtonBuilder()
                .setCustomId(id)
                .setLabel("Next →")
                .setStyle(ButtonStyle.Primary);

        
        const buildStep1 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(1, "Punishment Action"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Choose what happens when a violation is detected.\n" +
                        `-# Current: **${state.action === "ban" ? "Ban User" : "Kick User"}** — select any option below to confirm or change.`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_action")
                            .setPlaceholder("Select punishment action...")
                            .addOptions([
                                {
                                    label:       "Kick User",
                                    value:       "kick",
                                    description: "Remove the violating user from the server",
                                    default:     state.action === "kick",
                                },
                                {
                                    label:       "Ban User",
                                    value:       "ban",
                                    description: "Permanently ban the violating user",
                                    default:     state.action === "ban",
                                },
                            ])
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(true), nextBtn("ar_setup_next1"))
                );

        
        const buildStep2 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(2, "Anti Mass Join"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Detect and act when too many users join within a short time window.\n" +
                        `-# Threshold: **${state.modules.massJoin.threshold}** joins in **${state.modules.massJoin.window}s** — ${state.modules.massJoin.enabled ? "Enabled" : "Disabled"}`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_mj_toggle")
                            .setPlaceholder("Anti Mass Join: toggle...")
                            .addOptions([
                                { label: "Enabled",  value: "on",  description: "Monitor and act on mass joins", default:  state.modules.massJoin.enabled },
                                { label: "Disabled", value: "off", description: "Skip mass join detection",      default: !state.modules.massJoin.enabled },
                            ])
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_mj_threshold")
                            .setPlaceholder(`Threshold: ${state.modules.massJoin.threshold} joins`)
                            .addOptions(
                                [5, 7, 10, 12, 15, 20].map(n => ({
                                    label:       `${n} joins`,
                                    value:       String(n),
                                    description: `Trigger after ${n} joins in the window`,
                                    default:     state.modules.massJoin.threshold === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_mj_window")
                            .setPlaceholder(`Window: ${state.modules.massJoin.window}s`)
                            .addOptions(
                                [3, 5, 10, 15, 30].map(n => ({
                                    label:       `${n} seconds`,
                                    value:       String(n),
                                    description: `Count joins within a ${n} second window`,
                                    default:     state.modules.massJoin.window === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(), nextBtn("ar_setup_next2"))
                );

        
        const buildStep3 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(3, "Account Age Filter"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Block accounts that are too new from joining the server.\n" +
                        `-# Minimum age: **${state.modules.accountAge.days} days** — ${state.modules.accountAge.enabled ? "Enabled" : "Disabled"}`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_aa_toggle")
                            .setPlaceholder("Account Age Filter: toggle...")
                            .addOptions([
                                { label: "Enabled",  value: "on",  description: "Kick/ban accounts below the minimum age", default:  state.modules.accountAge.enabled },
                                { label: "Disabled", value: "off", description: "Allow any account age to join",            default: !state.modules.accountAge.enabled },
                            ])
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_aa_days")
                            .setPlaceholder(`Minimum age: ${state.modules.accountAge.days} days`)
                            .addOptions(
                                [1, 3, 7, 14, 30].map(n => ({
                                    label:       `${n} day${n !== 1 ? "s" : ""}`,
                                    value:       String(n),
                                    description: `Account must be at least ${n} day${n !== 1 ? "s" : ""} old`,
                                    default:     state.modules.accountAge.days === n,
                                }))
                            )
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(), nextBtn("ar_setup_next3"))
                );

        
        const buildStep4 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(4, "Bot Filter"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Automatically kick or ban any bot that joins the server without being whitelisted.\n" +
                        `-# Uses the same whitelist as AntiNuke. Currently **${state.modules.botFilter.enabled ? "Enabled" : "Disabled"}**.`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("ar_setup_bf_toggle")
                            .setPlaceholder("Bot Filter: toggle...")
                            .addOptions([
                                { label: "Enabled",  value: "on",  description: "Auto-kick/ban unwhitelisted bots", default:  state.modules.botFilter.enabled },
                                { label: "Disabled", value: "off", description: "Allow any bot to join freely",     default: !state.modules.botFilter.enabled },
                            ])
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(backBtn(), nextBtn("ar_setup_next4"))
                );

        
        const buildStep5 = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(5, "Alert Channel"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        "Set a channel to receive raid detection alerts.\n" +
                        `**Current:** ${state.alertChannel ? `<#${state.alertChannel}>` : "Not configured"}`
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new ChannelSelectMenuBuilder()
                            .setCustomId("ar_setup_alert_ch")
                            .setPlaceholder("Select alert channel...")
                            .addChannelTypes(ChannelType.GuildText)
                    )
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        backBtn(),
                        new ButtonBuilder()
                            .setCustomId("ar_setup_clear_ch")
                            .setLabel("Disable Alerts")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(!state.alertChannel),
                        new ButtonBuilder()
                            .setCustomId("ar_setup_skip_ch")
                            .setLabel(state.alertChannel ? "Keep & Continue" : "Skip")
                            .setStyle(ButtonStyle.Secondary),
                    )
                );

        
        const buildStep6 = () => {
            const mjCfg = state.modules.massJoin;
            const aaCfg = state.modules.accountAge;
            const bfCfg = state.modules.botFilter;

            const E = client.emoji.enabled2;
            const D = client.emoji.disabled2;

            const moduleLines =
                `${mjCfg.enabled ? E : D} **Anti Mass Join**${mjCfg.enabled ? ` — \`${mjCfg.threshold} joins / ${mjCfg.window}s\`` : ""}\n` +
                `${aaCfg.enabled ? E : D} **Account Age Filter**${aaCfg.enabled ? ` — \`< ${aaCfg.days} days old\`` : ""}\n` +
                `${bfCfg.enabled ? E : D} **Bot Filter**`;

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(header(6, "Confirm & Save"))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Modules**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(moduleLines)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Action:** \`${state.action === "ban" ? "Ban User" : "Kick User"}\`\n` +
                        `**Alert Channel:** ${state.alertChannel ? `<#${state.alertChannel}>` : "\`Not set\`"}`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(
                        backBtn(),
                        new ButtonBuilder()
                            .setCustomId("ar_setup_confirm")
                            .setLabel("Confirm & Save")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("ar_setup_cancel")
                            .setLabel("Cancel")
                            .setStyle(ButtonStyle.Danger),
                    )
                );
        };

        const getStepBuilder = () => {
            switch (state.step) {
                case 1: return buildStep1();
                case 2: return buildStep2();
                case 3: return buildStep3();
                case 4: return buildStep4();
                case 5: return buildStep5();
                case 6: return buildStep6();
                default: return buildStep6();
            }
        };

        const sent = await message.reply({
            components: [buildStep1()],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = sent.createMessageComponentCollector({
            filter: (i) => {
                if (i.user.id !== message.author.id) {
                    i.reply({ content: "Only the command author can use this menu.", ephemeral: true });
                    return false;
                }
                return true;
            },
            time: 180000,
        });

        collector.on("collect", async (i) => {
            
            if (i.customId === "ar_setup_action") {
                state.action = i.values[0];
                state.step   = 2;
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_mj_toggle") {
                state.modules.massJoin.enabled = i.values[0] === "on";
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_mj_threshold") {
                state.modules.massJoin.threshold = parseInt(i.values[0]);
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_mj_window") {
                state.modules.massJoin.window = parseInt(i.values[0]);
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_aa_toggle") {
                state.modules.accountAge.enabled = i.values[0] === "on";
                return i.update({ components: [buildStep3()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_aa_days") {
                state.modules.accountAge.days = parseInt(i.values[0]);
                return i.update({ components: [buildStep3()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_bf_toggle") {
                state.modules.botFilter.enabled = i.values[0] === "on";
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_alert_ch") {
                state.alertChannel = i.values[0];
                return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_clear_ch") {
                state.alertChannel = null;
                return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_skip_ch") {
                state.step = 6;
                return i.update({ components: [buildStep6()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_next1") {
                state.step = 2;
                return i.update({ components: [buildStep2()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_next2") {
                state.step = 3;
                return i.update({ components: [buildStep3()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_next3") {
                state.step = 4;
                return i.update({ components: [buildStep4()], flags: MessageFlags.IsComponentsV2 });
            }
            if (i.customId === "ar_setup_next4") {
                state.step = 5;
                return i.update({ components: [buildStep5()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_back") {
                state.step = Math.max(1, state.step - 1);
                return i.update({ components: [getStepBuilder()], flags: MessageFlags.IsComponentsV2 });
            }

            
            if (i.customId === "ar_setup_confirm") {
                const cfg = {
                    action:  state.action,
                    modules: {
                        massJoin: {
                            enabled:   state.modules.massJoin.enabled,
                            threshold: state.modules.massJoin.threshold,
                            window:    state.modules.massJoin.window,
                        },
                        accountAge: {
                            enabled: state.modules.accountAge.enabled,
                            days:    state.modules.accountAge.days,
                        },
                        botFilter: {
                            enabled: state.modules.botFilter.enabled,
                        },
                    },
                    alertChannel: state.alertChannel,
                };

                client.lmdbSet(cfgKey, cfg);
                client.lmdbSet(`antiraid_${guildId}`, "enabled");

                collector.stop("done");

                const E = client.emoji.enabled2;
                const D = client.emoji.disabled2;
                const mj = state.modules.massJoin;
                const aa = state.modules.accountAge;
                const bf = state.modules.botFilter;

                return i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## ${E} AntiRaid Configured & Enabled`
                                )
                            )
                            .addSeparatorComponents(
                                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${mj.enabled ? E : D} Anti Mass Join${mj.enabled ? ` — \`${mj.threshold} joins / ${mj.window}s\`` : ""}\n` +
                                    `${aa.enabled ? E : D} Account Age Filter${aa.enabled ? ` — \`< ${aa.days} days old\`` : ""}\n` +
                                    `${bf.enabled ? E : D} Bot Filter\n` +
                                    `**Action:** \`${state.action === "ban" ? "Ban" : "Kick"}\`\n` +
                                    `**Alert Channel:** ${state.alertChannel ? `<#${state.alertChannel}>` : "\`None\`"}`
                                )
                            )
                            .addSeparatorComponents(
                                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                            )
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `-# Server is now protected. Use \`${prefix}antiraid status\` to view details.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }

            
            if (i.customId === "ar_setup_cancel") {
                collector.stop("cancelled");
                return i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.cross} Setup cancelled. No changes were saved.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        });

        collector.on("end", async (collected, reason) => {
            if (reason === "done" || reason === "cancelled") return;
            await sent.edit({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## AntiRaid Setup\n-# Timed out — run \`${prefix}arsetup\` again to continue.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};
