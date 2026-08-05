const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const {
    VIOLATION_TYPES,
    DEFAULT_WEIGHTS,
    getConfig,
    saveConfig,
    getState,
    getWhitelist,
    saveWhitelist,
    liftLockdown,
} = require("../../utils/heatSystem");
const { isPremiumActive } = require("../../utils/premiumSystem");

const ACCENT = 0x26272F;

module.exports = {
    name: "heat",
    aliases: ["beastmode", "bm"],
    description: "View and manage Beast Mode — the escalating heat-based auto-lockdown system",
    category: "heat",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        const ENABLED_EMOJI  = client.emoji.enabled2;
        const DISABLED_EMOJI = client.emoji.disabled2;

        const owners = client.config?.owner || [];
        const isAllowed =
            message.author.id === message.guild.ownerId ||
            owners.includes(message.author.id);

        if (!isAllowed) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Only the **server owner** or a **bot owner** can use this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const isBotOwner = owners.includes(message.author.id);
        if (!isBotOwner && !isPremiumActive(client, message.guild.id)) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.cross} Activate premium to use this feature.\n-# Run \`premium\` to see plans.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const sub     = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const cfg     = getConfig(client, guildId);

        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Beast Mode"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}heatsetup\` — Run the full setup\n` +
                                `\`${prefix}heat status\` — View current heat, weights & whitelist\n` +
                                `\`${prefix}heat disable\` — Turn off Beast Mode\n` +
                                `\`${prefix}heat unlock\` — Manually lift an active lockdown\n` +
                                `\`${prefix}heat whitelist add|remove|list @user\` — Exempt a user's actions from heat`
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

        // ── STATUS PANEL ─────────────────────────────────────────────
        if (sub === "status") {
            if (!cfg) return reply(`${DISABLED_EMOJI} Beast Mode is **not configured**.\n-# Run \`${prefix}heatsetup\` to set it up.`);

            const state = getState(client, guildId);
            const whitelist = getWhitelist(client, guildId);

            const buildOverview = () =>
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${message.guild.name} — Beast Mode Status`)
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Status:** ${cfg.enabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                            `**Current Heat:** \`${Math.round(state.points)} / ${cfg.threshold}\`\n` +
                            `**Lockdown:** ${state.lockdown ? `${DISABLED_EMOJI} Active since <t:${Math.floor(state.lockdown.since / 1000)}:R>` : `${ENABLED_EMOJI} Not active`}\n` +
                            `**End Mode:** \`${cfg.lockdownMode}\`\n` +
                            `**Cooldown Rate:** \`${cfg.decayPerMinute} heat / minute\`\n` +
                            `**Log Channel:** <#${cfg.logChannelId}>\n` +
                            `**Live Status:** ${cfg.statusChannelId ? `<#${cfg.statusChannelId}>` : "Not set"}`
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder().setCustomId("heat_view_weights").setLabel("View Weights").setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId("heat_view_whitelist").setLabel("View Whitelist").setStyle(ButtonStyle.Secondary),
                        )
                    );

            const buildWeights = () => {
                const weights = cfg.weights || {};
                const lines = Object.entries(VIOLATION_TYPES).map(([key, label]) => {
                    const value = weights[label] ?? DEFAULT_WEIGHTS[label] ?? 10;
                    return `**${label}** — \`${value}\` (\`${key}\`)`;
                }).join("\n");

                return new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Violation Weights"))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Use \`${prefix}heatsetup\` to change these values.`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(new ButtonBuilder().setCustomId("heat_back").setLabel("Back").setStyle(ButtonStyle.Secondary))
                    );
            };

            const buildWhitelist = () =>
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Beast Mode Whitelist"))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            whitelist.length ? whitelist.map(id => `<@${id}>`).join("\n") : "No users are whitelisted from Beast Mode."
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`-# Use \`${prefix}heat whitelist add @user\` to add someone.`)
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(new ButtonBuilder().setCustomId("heat_back").setLabel("Back").setStyle(ButtonStyle.Secondary))
                    );

            const buildExpired = () =>
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ${message.guild.name} — Beast Mode Status`)
                    )
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Status:** ${cfg.enabled ? `${ENABLED_EMOJI} Active` : `${DISABLED_EMOJI} Inactive`}\n` +
                            `**Current Heat:** \`${Math.round(state.points)} / ${cfg.threshold}\``
                        )
                    )
                    .addSeparatorComponents(sep())
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new ButtonBuilder().setCustomId("heat_view_weights_dis").setLabel("View Weights").setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId("heat_view_whitelist_dis").setLabel("View Whitelist").setStyle(ButtonStyle.Secondary).setDisabled(true),
                        )
                    );

            const sent = await message.reply({ components: [buildOverview()], flags: MessageFlags.IsComponentsV2 });

            const collector = sent.createMessageComponentCollector({
                filter: (i) => i.user.id === message.author.id,
                time: 120000,
            });

            collector.on("collect", async (i) => {
                if (i.customId === "heat_view_weights") return i.update({ components: [buildWeights()], flags: MessageFlags.IsComponentsV2 });
                if (i.customId === "heat_view_whitelist") return i.update({ components: [buildWhitelist()], flags: MessageFlags.IsComponentsV2 });
                if (i.customId === "heat_back") return i.update({ components: [buildOverview()], flags: MessageFlags.IsComponentsV2 });
            });

            collector.on("end", async () => {
                await sent.edit({ components: [buildExpired()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            });

            return;
        }

        // ── DISABLE ──────────────────────────────────────────────────
        if (sub === "disable") {
            if (!cfg) return reply(`${DISABLED_EMOJI} Beast Mode isn't configured.`);
            saveConfig(client, guildId, { ...cfg, enabled: false });
            return reply(`${DISABLED_EMOJI} Beast Mode **disabled**. (Config kept — run \`${prefix}heatsetup\` to re-enable.)`);
        }

        // ── UNLOCK ───────────────────────────────────────────────────
        if (sub === "unlock") {
            if (!cfg) return reply(`${DISABLED_EMOJI} Beast Mode isn't configured.`);

            const state = getState(client, guildId);
            if (!state.lockdown) return reply(`${ENABLED_EMOJI} There's no active lockdown right now.`);

            await liftLockdown(client, message.guild, cfg, state, `manually by ${message.author.tag}`);
            return reply(`${ENABLED_EMOJI} Lockdown **manually lifted**. Permissions restored.`);
        }

        // ── WHITELIST ────────────────────────────────────────────────
        if (sub === "whitelist") {
            if (!cfg) return reply(`${DISABLED_EMOJI} Run \`${prefix}heatsetup\` first.`);

            const action = args[1]?.toLowerCase();
            const target = message.mentions.users.first();

            if (action === "list") {
                const list = getWhitelist(client, guildId);
                if (!list.length) return reply(`${client.emoji.arrow} No users are whitelisted from Beast Mode.`);
                return reply(`${client.emoji.arrow} **Beast Mode whitelist:**\n${list.map(id => `<@${id}>`).join("\n")}`);
            }

            if (!target || !["add", "remove"].includes(action)) {
                return reply(`${client.emoji.cross} Usage: \`${prefix}heat whitelist <add|remove|list> @user\``);
            }

            let list = getWhitelist(client, guildId);
            if (action === "add") {
                if (list.includes(target.id)) return reply(`${client.emoji.cross} ${target} is already whitelisted.`);
                list = [...list, target.id];
                saveWhitelist(client, guildId, list);
                return reply(`${ENABLED_EMOJI} ${target}'s actions will no longer count toward Beast Mode heat.`);
            }

            if (!list.includes(target.id)) return reply(`${client.emoji.cross} ${target} isn't whitelisted.`);
            list = list.filter(id => id !== target.id);
            saveWhitelist(client, guildId, list);
            return reply(`${DISABLED_EMOJI} ${target} removed from the Beast Mode whitelist.`);
        }

        if (sub === "setup") return reply(`${client.emoji.arrow} Use \`${prefix}heatsetup\` to run the full interactive setup.`);

        return reply(`${client.emoji.cross} Invalid option. Use \`${prefix}heat\` to see all subcommands.`);
    },
};
