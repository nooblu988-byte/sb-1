const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const MODULE_NAMES = {
    promotion:   "Anti Promotion",
    links:       "Anti Links",
    spam:        "Anti Spam",
    massMention: "Anti Mass Mention",
    massImages:  "Anti Mass Images",
    massForward: "Anti Mass Forward",
    abuse:       "Anti Abuse",
    nsfw:        "Anti NSFW",
    nsfwImages:  "Anti NSFW Images",
    caps:        "Anti Caps",
    emojiSpam:   "Anti Emoji Spam",
    customFilter:"Custom Filter",
};

module.exports = {
    name: "amhistory",
    aliases: ["amh"],
    description: "View a user's automod violation history and strike count",
    category: "automod",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
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

        const guildId = message.guild.id;
        const sep     = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin    = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        let targetUser = message.mentions.users.first();
        if (!targetUser && args[0]) {
            targetUser = await client.users.fetch(args[0]).catch(() => null);
        }

        if (!targetUser) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## Automod History")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `Usage: \`${prefix}amhistory <@user | userID>\`\n\n` +
                                `Shows a user's automod violation history and current strike count.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const userId     = targetUser.id;
        const histKey    = `am_history_${guildId}_${userId}`;
        const strikeKey  = `am_strikes_${guildId}_${userId}`;
        const history    = client.lmdbGet(histKey) || [];
        const strikes    = client.lmdbGet(strikeKey) || 0;

        const cfg         = client.lmdbGet(`automod_cfg_${guildId}`) || {};
        const threshold   = cfg.strikes?.threshold || 3;
        const strikesOn   = cfg.strikes?.enabled || false;

        if (history.length === 0 && strikes === 0) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## Automod History — ${targetUser.tag}`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${client.emoji.enabled2} No violations recorded for this user.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const pageSize = 8;
        let page = 0;
        const total = Math.max(1, Math.ceil(history.length / pageSize));

        const buildPage = () => {
            const start = page * pageSize;
            const slice = history.slice(start, start + pageSize);

            const historyLines = slice.length > 0
                ? slice.map((entry, i) => {
                    const ts  = `<t:${Math.floor(entry.timestamp / 1000)}:R>`;
                    const mod = MODULE_NAMES[entry.module] || entry.module;
                    return `\`${start + i + 1}.\` **${mod}** — \`${entry.action}\` — ${ts}`;
                }).join("\n")
                : "No history entries.";

            const strikeBar = strikesOn
                ? `**Strikes:** \`${strikes}/${threshold}\` ${strikes >= threshold ? "🔺 Escalation threshold reached!" : ""}`
                : `**Strikes:** \`${strikes}\` *(strike system disabled)*`;

            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Automod History — ${targetUser.tag}`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(strikeBar)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Violation Log** (${history.length} total)`
                    )
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(historyLines)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# Page ${page + 1}/${total}  |  ID: \`${userId}\``)
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId("amh_prev")
                            .setLabel("Previous")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId("amh_next")
                            .setLabel("Next")
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === total - 1),
                        new ButtonBuilder()
                            .setCustomId("amh_clearstrikes")
                            .setLabel("Clear Strikes")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(strikes === 0),
                        new ButtonBuilder()
                            .setCustomId("amh_clearhistory")
                            .setLabel("Clear History")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(history.length === 0),
                    )
                );
        };

        const sent = await message.reply({
            components: [buildPage()],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = sent.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 120000,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "amh_prev") page = Math.max(0, page - 1);
            if (i.customId === "amh_next") page = Math.min(total - 1, page + 1);

            if (i.customId === "amh_clearstrikes") {
                client.lmdbSet(strikeKey, 0);
                await i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.enabled2} Strikes cleared for **${targetUser.tag}**.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
                return collector.stop("done");
            }

            if (i.customId === "amh_clearhistory") {
                client.lmdbSet(histKey, []);
                await i.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.enabled2} Violation history cleared for **${targetUser.tag}**.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
                return collector.stop("done");
            }

            await i.update({ components: [buildPage()], flags: MessageFlags.IsComponentsV2 });
        });

        collector.on("end", async (_, reason) => {
            if (reason === "done") return;
            const start = page * pageSize;
            const slice = history.slice(start, start + pageSize);
            const historyLines = slice.length > 0
                ? slice.map((entry, i) => {
                    const ts  = `<t:${Math.floor(entry.timestamp / 1000)}:R>`;
                    const mod = MODULE_NAMES[entry.module] || entry.module;
                    return `\`${start + i + 1}.\` **${mod}** — \`${entry.action}\` — ${ts}`;
                }).join("\n")
                : "No history entries.";
            const strikeBar = strikesOn
                ? `**Strikes:** \`${strikes}/${threshold}\``
                : `**Strikes:** \`${strikes}\` *(strike system disabled)*`;
            await sent.edit({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Automod History — ${targetUser.tag}`))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(strikeBar))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Violation Log** (${history.length} total)`))
                        .addSeparatorComponents(thin())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(historyLines))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Page ${page + 1}/${total}  |  ID: \`${userId}\``))
                        .addActionRowComponents((row) =>
                            row.addComponents(
                                new ButtonBuilder().setCustomId("amh_prev").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                new ButtonBuilder().setCustomId("amh_next").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(true),
                                new ButtonBuilder().setCustomId("amh_clearstrikes").setLabel("Clear Strikes").setStyle(ButtonStyle.Danger).setDisabled(true),
                                new ButtonBuilder().setCustomId("amh_clearhistory").setLabel("Clear History").setStyle(ButtonStyle.Danger).setDisabled(true),
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
        });
    },
};
