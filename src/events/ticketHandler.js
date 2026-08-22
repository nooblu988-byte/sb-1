const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder,
    ChannelType,
    SeparatorSpacingSize,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const {
    getConfig,
    saveConfig,
    nextTicketNumber,
    getOpenTicket,
    saveOpenTicket,
    clearOpenTicket,
} = require("../utils/ticketSystem");

function getTicketOwner(client, channelId) {
    return client.lmdbGet(`ticket_owner_${channelId}`) || null;
}
function saveTicketOwner(client, channelId, userId) {
    return client.lmdbSet(`ticket_owner_${channelId}`, userId);
}

const ACCENT = 0x26272F;
const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const STEP_WAIT_MS = 2 * 60 * 1000;

function buildPanelPayload(cfg, guild) {
    const iconURL = guild?.iconURL?.({ size: 256 });

    const c = new ContainerBuilder().setAccentColor(ACCENT);

    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${cfg.title}`))
        .addSeparatorComponents(sep());

    if (iconURL) {
        c.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(cfg.description))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconURL))
        );
    } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(cfg.description));
    }

    if (cfg.bannerURL) {
        c.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(cfg.bannerURL))
        );
    }

    c.addSeparatorComponents(sep())
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder().setCustomId("ticket_open").setLabel("Ticket").setStyle(ButtonStyle.Primary)
            )
        );

    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

module.exports = (client) => {
    if (!client._ticketSetupPending) client._ticketSetupPending = new Map();
    const pending = client._ticketSetupPending;

    const panel = (message, content) =>
        message.reply({
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent("## Ticket Panel Setup"))
                    .addSeparatorComponents(sep())
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(content)),
            ],
            flags: MessageFlags.IsComponentsV2,
        }).catch(() => {});

    // ─── Setup wizard Q&A ───────────────────────────────────────────
    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        const key = `${message.guild.id}_${message.author.id}`;
        const state = pending.get(key);
        if (!state || message.channel.id !== state.channelId) return;

        if (Date.now() > state.expires) {
            pending.delete(key);
            return panel(message, "That took too long — run `ticketsetup` again to restart.");
        }

        if (state.step === "title") {
            const title = message.content.trim().slice(0, 100);
            if (!title) return panel(message, "Please enter a valid title.");

            pending.set(key, { ...state, step: "description", title, expires: Date.now() + STEP_WAIT_MS });
            return panel(message, "What should the panel description say?");
        }

        if (state.step === "description") {
            const description = message.content.trim().slice(0, 1000);
            if (!description) return panel(message, "Please enter a valid description.");

            pending.set(key, { ...state, step: "banner", description, expires: Date.now() + STEP_WAIT_MS });
            return panel(message, "Attach a banner image, or type `skip`.");
        }

        if (state.step === "banner") {
            const attachment = message.attachments.find(a => (a.contentType || "").startsWith("image/"));
            const skipped = message.content.trim().toLowerCase() === "skip";

            if (!attachment && !skipped) {
                return panel(message, "Please attach an image, or type `skip` to continue without a banner.");
            }

            pending.set(key, {
                ...state,
                step: "role",
                bannerAttachmentURL: attachment?.url || null,
                bannerFilename: attachment?.name || "banner.png",
                expires: Date.now() + STEP_WAIT_MS,
            });
            return panel(message, "Mention the role that should be able to see and manage tickets.");
        }

        if (state.step === "role") {
            const role = message.mentions.roles.first();
            if (!role) return panel(message, "Please mention a valid role.");

            pending.delete(key);

            const channel = message.guild.channels.cache.get(state.channelId);
            if (!channel) return;

            const cfgBase = {
                title: state.title,
                description: state.description,
                supportRoleId: role.id,
                bannerURL: null,
            };

            let sent;
            if (state.bannerAttachmentURL) {
                try {
                    const response = await fetch(state.bannerAttachmentURL);
                    const buffer = Buffer.from(await response.arrayBuffer());
                    const file = new AttachmentBuilder(buffer, { name: state.bannerFilename });

                    cfgBase.bannerURL = `attachment://${state.bannerFilename}`;
                    const payload = buildPanelPayload(cfgBase, message.guild);
                    sent = await channel.send({ files: [file], ...payload });

                    const durableURL = sent.attachments.first()?.url;
                    if (durableURL) cfgBase.bannerURL = durableURL;
                } catch {
                    cfgBase.bannerURL = null;
                    sent = await channel.send(buildPanelPayload(cfgBase, message.guild));
                }
            } else {
                sent = await channel.send(buildPanelPayload(cfgBase, message.guild));
            }

            saveConfig(client, message.guild.id, { ...cfgBase, panelChannelId: channel.id, panelMessageId: sent.id });

            return panel(message, `Ticket panel posted in ${channel}!`);
        }
    });

    // ─── Ticket / Close buttons ─────────────────────────────────────
    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isButton()) return;

        const guild = interaction.guild;
        if (!guild) return;

        if (interaction.customId === "ticket_open") {
            const cfg = getConfig(client, guild.id);
            if (!cfg) {
                return interaction.reply({ content: "Ticket system isn't configured.", flags: 64 });
            }

            const existing = getOpenTicket(client, guild.id, interaction.user.id);
            if (existing && guild.channels.cache.has(existing)) {
                return interaction.reply({ content: `You already have an open ticket: <#${existing}>`, flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });

            const number = nextTicketNumber(client, guild.id);
            const ticketChannel = await guild.channels.create({
                name: `ticket-${number}`,
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: cfg.supportRoleId,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: guild.members.me.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
                    },
                ],
                reason: `Ticket opened by ${interaction.user.tag}`,
            }).catch(() => null);

            if (!ticketChannel) {
                return interaction.editReply({ content: "Couldn't create a ticket channel — check my Manage Channels permission." });
            }

            saveOpenTicket(client, guild.id, interaction.user.id, ticketChannel.id);
            saveTicketOwner(client, ticketChannel.id, interaction.user.id);

            await ticketChannel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(ACCENT)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Ticket #${number}`))
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${interaction.user} opened this ticket. <@&${cfg.supportRoleId}> will be with you shortly.`)
                        )
                        .addSeparatorComponents(sep())
                        .addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder().setCustomId("ticket_close").setLabel("Close Ticket").setStyle(ButtonStyle.Danger)
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => {});

            return interaction.editReply({ content: `Ticket created: ${ticketChannel}` });
        }

        if (interaction.customId === "ticket_close") {
            const cfg = getConfig(client, guild.id);
            const canClose =
                interaction.user.id === guild.ownerId ||
                interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
                interaction.member.roles.cache.has(cfg?.supportRoleId);

            if (!canClose) {
                return interaction.reply({ content: "You don't have permission to close this ticket.", flags: 64 });
            }

            const ownerId = getTicketOwner(client, interaction.channel.id);

            await interaction.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xED4245)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Ticket closed by ${interaction.user}. Only staff can see this channel now.`)),
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            if (ownerId) {
                clearOpenTicket(client, guild.id, ownerId);
                await interaction.channel.permissionOverwrites.edit(ownerId, { ViewChannel: false }).catch(() => {});
            }

            if (!interaction.channel.name.startsWith("closed-")) {
                await interaction.channel.setName(`closed-${interaction.channel.name}`.slice(0, 100)).catch(() => {});
            }
        }
    });
};
