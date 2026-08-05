const {
    ContainerBuilder,
    TextDisplayBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const DRAG_WAIT_MS = 2 * 60 * 1000;

module.exports = (client) => {
    if (!client._vcDragPending) client._vcDragPending = new Map();
    const dragPending = client._vcDragPending;

    const canRespond = (guild, member, targetVC) => {
        if (member.id === guild.ownerId) return true;
        if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
        return targetVC.permissionsFor(member)?.has(PermissionFlagsBits.Connect) ?? false;
    };

    client.on("interactionCreate", (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith("vcreq_accept_") && !interaction.customId.startsWith("vcreq_decline_")) return;

        const isAccept = interaction.customId.startsWith("vcreq_accept_");
        const rest = interaction.customId.replace(isAccept ? "vcreq_accept_" : "vcreq_decline_", "");
        const [requesterId, targetVCId] = rest.split("_");

        const guild = interaction.guild;
        const targetVC = guild.channels.cache.get(targetVCId);
        if (!targetVC) {
            interaction.reply({ content: "That voice channel no longer exists.", flags: 64 }).catch(() => {});
            return;
        }

        if (!canRespond(guild, interaction.member, targetVC)) {
            interaction.reply({ content: "You don't have access to that voice channel, so you can't respond to this request.", flags: 64 }).catch(() => {});
            return;
        }

        // Requester lookup from cache first — no API round trip in the common case.
        const requester = guild.members.cache.get(requesterId);

        if (!isAccept) {
            interaction.update({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xED4245)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`Request declined by ${interaction.user}.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});
            return;
        }

        // Already in a voice channel — drag immediately, no waiting.
        if (requester?.voice?.channelId && requester.voice.channelId !== targetVCId) {
            interaction.update({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x57F287)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`Accepted by ${interaction.user}. Moving ${requester} into **${targetVC.name}** now.`)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});

            requester.voice.setChannel(targetVCId, "VC request accepted").catch(() => {});
            return;
        }

        // Not currently in a voice channel — wait up to 2 minutes for them to join one.
        interaction.update({
            components: [
                new ContainerBuilder()
                    .setAccentColor(0x57F287)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `Accepted by ${interaction.user}.${requester ? ` ${requester}, join any voice channel within 2 minutes and you'll be moved into **${targetVC.name}**.` : ""}`
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});

        if (!requester) return;

        targetVC.send({ content: `${requester} join any voice channel within 2 minutes and you'll be moved into **${targetVC.name}**.` }).catch(() => {});

        dragPending.set(requesterId, {
            guildId: guild.id,
            targetChannelId: targetVCId,
            expires: Date.now() + DRAG_WAIT_MS,
        });

        setTimeout(() => {
            const entry = dragPending.get(requesterId);
            if (entry && entry.targetChannelId === targetVCId && Date.now() >= entry.expires) {
                dragPending.delete(requesterId);
            }
        }, DRAG_WAIT_MS + 1000);
    });

    client.on("voiceStateUpdate", (oldState, newState) => {
        const entry = dragPending.get(newState.id);
        if (!entry) return;
        if (entry.guildId !== newState.guild.id) return;

        if (Date.now() > entry.expires) {
            dragPending.delete(newState.id);
            return;
        }

        if (!newState.channelId) return; // they left a VC, not joined one
        dragPending.delete(newState.id);
        if (newState.channelId === entry.targetChannelId) return;

        newState.setChannel(entry.targetChannelId, "VC request accepted").catch(() => {});
    });
};
