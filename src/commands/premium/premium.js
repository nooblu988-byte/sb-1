const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");

const {
    PLANS,
    getPlan,
    getStatus,
    isPremiumActive,
    getRequest,
    saveRequest,
} = require("../../utils/premiumSystem");

const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = {
    name: "premium",
    aliases: ["bmpremium"],
    description: "View and request a Beast Mode premium plan",
    category: "premium",
    cooldown: 5,

    run: async (client, message, args, prefix) => {
        if (message.author.id !== message.guild.ownerId) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${client.emoji.cross} Only the **server owner** can use this command.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const guildId = message.guild.id;
        const status = getStatus(client, guildId);
        const existingRequest = getRequest(client, guildId);

        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

        if (isPremiumActive(client, guildId)) {
            const plan = getPlan(status.plan);
            return reply(
                `${client.emoji.enabled2} **Beast Mode Premium is active** for this server.\n\n` +
                `**Plan:** ${plan?.label ?? status.plan}\n` +
                `**Expires:** <t:${Math.floor(status.expiresAt / 1000)}:F> (<t:${Math.floor(status.expiresAt / 1000)}:R>)`
            );
        }

        if (existingRequest) {
            return reply(
                `${client.emoji.arrow} You already have a pending request for **${getPlan(existingRequest.plan)?.label ?? existingRequest.plan}**.\n` +
                `-# Waiting on approval — check your DMs.`
            );
        }

        const container = new ContainerBuilder()
            .setAccentColor(ACCENT)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Beast Mode Premium"))
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    "Beast Mode requires an active premium plan. Pick one below:\n\n" +
                    PLANS.map(p => `**${p.label}** — ₹${p.price}`).join("\n")
                )
            )
            .addSeparatorComponents(sep())
            .addActionRowComponents(row =>
                row.addComponents(
                    ...PLANS.map(p =>
                        new ButtonBuilder()
                            .setCustomId(`premium_pick_${p.id}`)
                            .setLabel(`${p.label} — ₹${p.price}`)
                            .setStyle(ButtonStyle.Secondary)
                    )
                )
            );

        const sent = await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });

        const collector = sent.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 120000,
            max: 1,
        });

        collector.on("collect", async (i) => {
            const planId = i.customId.replace("premium_pick_", "");
            const plan = getPlan(planId);
            if (!plan) return;

            const confirmContainer = new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Confirm Your Plan"))
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Plan:** ${plan.label}\n**Price:** ₹${plan.price}\n\n` +
                        "Confirming will send this request to the bot owner for approval. You'll receive a redemption key by DM once approved."
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents(row =>
                    row.addComponents(
                        new ButtonBuilder().setCustomId("premium_confirm").setLabel("Confirm Request").setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId("premium_cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger),
                    )
                );

            await i.update({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });

            const confirmCollector = sent.createMessageComponentCollector({
                filter: (ci) => ci.user.id === message.author.id,
                time: 60000,
                max: 1,
            });

            confirmCollector.on("collect", async (ci) => {
                if (ci.customId === "premium_cancel") {
                    return ci.update({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(ACCENT)
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} Request cancelled.`)),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                await ci.update({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(ACCENT)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.loading} Sending your request...`)),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });

                saveRequest(client, guildId, {
                    plan: plan.id,
                    guildOwnerId: message.author.id,
                    requestedAt: Date.now(),
                });

                const owners = client.config?.owner || [];

                const dmContainer = [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## New Beast Mode Premium Request"))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `**Server:** ${message.guild.name} (\`${guildId}\`)\n` +
                                `**Server Owner:** <@${message.author.id}> (\`${message.author.id}\`)\n` +
                                `**Plan:** ${plan.label} — ₹${plan.price}`
                            )
                        )
                        .addSeparatorComponents(sep())
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder().setCustomId(`premium_approve_${guildId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
                                new ButtonBuilder().setCustomId(`premium_reject_${guildId}`).setLabel("Reject").setStyle(ButtonStyle.Danger),
                            )
                        ),
                ];

                const dmResults = await Promise.allSettled(
                    owners.map(ownerId =>
                        client.users.fetch(ownerId).then(u => u.send({ components: dmContainer, flags: MessageFlags.IsComponentsV2 }))
                    )
                );
                const sentToAny = dmResults.some(r => r.status === "fulfilled");

                if (!sentToAny) {
                    return sent.edit({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0xED4245)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`${client.emoji.cross} Couldn't reach the bot owner by DM. Please try again later or contact support.`)
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    });
                }

                await sent.edit({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(ACCENT)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${client.emoji.enabled2} Request sent for **${plan.label}**.\n-# You'll get a DM with your redemption key once approved.`
                                )
                            ),
                    ],
                    flags: MessageFlags.IsComponentsV2,
                });
            });
        });

        return;
    },
};
