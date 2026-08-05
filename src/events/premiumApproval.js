const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");

const {
    getPlan,
    getRequest,
    clearRequest,
    savePendingKey,
    getPendingKey,
    clearPendingKey,
    activatePremium,
    generateKey,
    startPremiumTicker,
} = require("../utils/premiumSystem");

const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = (client) => {
    client.once("clientReady", () => {
        startPremiumTicker(client);
    });

    // ─── Bot owner DM: Approve / Reject ────────────────────────────
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("premium_approve_") && !interaction.customId.startsWith("premium_reject_")) return;

        const owners = client.config?.owner || [];
        if (!owners.includes(interaction.user.id)) {
            return interaction.reply({ content: "Only a bot owner can use this.", flags: 64 });
        }

        const isApprove = interaction.customId.startsWith("premium_approve_");
        const guildId = interaction.customId.replace(isApprove ? "premium_approve_" : "premium_reject_", "");

        const request = getRequest(client, guildId);
        if (!request) {
            return interaction.update({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} This request no longer exists (already handled or expired).`)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const plan = getPlan(request.plan);
        clearRequest(client, guildId);

        if (!isApprove) {
            await interaction.update({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xED4245)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} Request **rejected** for guild \`${guildId}\`.`)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            return client.users.fetch(request.guildOwnerId).then(u => u.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xED4245)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.cross} Your Beast Mode premium request (${plan?.label ?? request.plan}) was declined.`)),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {})).catch(() => {});
        }

        const key = generateKey();
        savePendingKey(client, guildId, { key, plan: request.plan, generatedAt: Date.now() });

        await interaction.update({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${client.emoji.enabled2} Approved. Key sent to the server owner.`)),
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        client.users.fetch(request.guildOwnerId).then(u => u.send({
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Beast Mode Premium Approved"))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**Plan:** ${plan?.label ?? request.plan}\n\n` +
                            `**Your key:**\n\`\`\`${key}\`\`\`\n` +
                            `Go to your server and run \`premiumkey\`, then enter this key when asked.`
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => {})).catch(() => {});
    });

    // ─── Capture the key typed after `premiumkey` ──────────────────
    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;
        if (!client._premiumKeyPending) return;

        const key = `${message.guild.id}_${message.author.id}`;
        const state = client._premiumKeyPending.get(key);
        if (!state) return;
        if (message.channel.id !== state.channelId) return;

        client._premiumKeyPending.delete(key);

        const reply = (content, accent = ACCENT) =>
            message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(accent)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});

        if (Date.now() > state.expires) {
            return reply(`${client.emoji.cross} That took too long — run \`premiumkey\` again.`);
        }

        const guildId = message.guild.id;
        const pending = getPendingKey(client, guildId);
        if (!pending) {
            return reply(`${client.emoji.cross} No pending key found for this server anymore.`);
        }

        const entered = message.content.trim().toUpperCase();
        if (entered !== pending.key) {
            return reply(`${client.emoji.cross} That key doesn't match. Run \`premiumkey\` again to retry.`);
        }

        const status = activatePremium(client, guildId, pending.plan);
        clearPendingKey(client, guildId);

        const plan = getPlan(pending.plan);
        return reply(
            `${client.emoji.enabled2} **Beast Mode Premium activated!**\n\n` +
            `**Plan:** ${plan?.label ?? pending.plan}\n` +
            `**Expires:** <t:${Math.floor(status.expiresAt / 1000)}:F>\n\n` +
            `-# Run \`heatsetup\` to configure Beast Mode.`,
            0x57F287
        );
    });
};
