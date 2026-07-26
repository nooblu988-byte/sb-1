const {
    ChannelType,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require("discord.js");

function getTrophyEmoji(client, guildId) {
    return client.lmdbGet(`voting_trophy_emoji_${guildId}`) || "🏆";
}

function getVoteEmoji(client, guildId) {
    return client.lmdbGet(`voting_emoji_${guildId}`) || "❤️";
}

function getArrowEmoji(client, guildId) {
    return client.lmdbGet(`voting_arrow_emoji_${guildId}`) || client.emoji.arrow || "➡️";
}

function getTickEmoji(client, guildId) {
    return client.lmdbGet(`voting_tick_emoji_${guildId}`) || client.emoji.tick || "✅";
}

function getCrossEmoji(client, guildId) {
    return client.lmdbGet(`voting_cross_emoji_${guildId}`) || client.emoji.cross || "❌";
}

async function setupVoting(client, guild, authorMember) {
    const guildId = guild.id;
    const trophyEmoji = getTrophyEmoji(client, guildId);
    const tickEmoji = getTickEmoji(client, guildId);
    const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    // Create Category first
    const category = await guild.channels.create({
        name: `${trophyEmoji} PFP Event`,
        type: ChannelType.GuildCategory
    });

    const everyoneId = guild.roles.everyone.id;

    // Create all 5 event channels concurrently to make the setup fast/instant
    const [votingLogs, regLogs, votingLeaderboard, regArea, votingArea] = await Promise.all([
        guild.channels.create({
            name: "voting-logs",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyoneId,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                }
            ]
        }),
        guild.channels.create({
            name: "registration-logs",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyoneId,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                }
            ]
        }),
        guild.channels.create({
            name: "voting-leaderboard",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyoneId,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                }
            ]
        }),
        guild.channels.create({
            name: "registration-area",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyoneId,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.SendMessages]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
                }
            ]
        }),
        guild.channels.create({
            name: "voting-area",
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: everyoneId,
                    allow: [PermissionFlagsBits.ViewChannel],
                    deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions]
                }
            ]
        })
    ]);

    // Save channel IDs in database
    client.lmdbSet(`voting_system_${guildId}`, "enabled");
    client.lmdbSet(`voting_logs_channel_${guildId}`, votingLogs.id);
    client.lmdbSet(`registration_logs_channel_${guildId}`, regLogs.id);
    client.lmdbSet(`voting_leaderboard_channel_${guildId}`, votingLeaderboard.id);
    client.lmdbSet(`registration_area_channel_${guildId}`, regArea.id);
    client.lmdbSet(`voting_area_channel_${guildId}`, votingArea.id);

    // Initialize default voting emoji if not already set
    if (!client.lmdbGet(`voting_emoji_${guildId}`)) {
        client.lmdbSet(`voting_emoji_${guildId}`, "❤️");
    }

    // Send the Registration panel to registration-area
    const regEmbed = new ContainerBuilder()
        .setAccentColor(0x26272F)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${trophyEmoji} Profile Picture Event Registration`)
        )
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `Welcome to the PFP Event!\n\n` +
                `Click the buttons below to start your registration. The registration wizard will open in a private thread.`
            ),
            new TextDisplayBuilder().setContent(
                `**Single Entry:** Register yourself.\n` +
                `**Duo Entry:** Register yourself and a teammate.`
            )
        )
        .addSeparatorComponents(sep())
        .addActionRowComponents((row) =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId("voting_reg_single")
                    .setLabel("Single Entry")
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId("voting_reg_duo")
                    .setLabel("Duo Entry")
                    .setStyle(ButtonStyle.Secondary)
            )
        );

    await regArea.send({
        components: [regEmbed],
        flags: MessageFlags.IsComponentsV2
    });

    // Post log about enable
    await votingLogs.send({
        components: [
            new ContainerBuilder()
                .setAccentColor(0x00FF00)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${tickEmoji} Voting System Enabled`),
                    new TextDisplayBuilder().setContent(`The PFP voting and registration system has been successfully initialized by ${authorMember}.`)
                )
        ],
        flags: MessageFlags.IsComponentsV2
    }).catch(() => {});

    return category;
}

async function disableVoting(client, guild, authorMember) {
    const guildId = guild.id;
    const fs = require("fs");

    // 1. Delete all local PFP files and clear participant records
    const participants = client.lmdbGet(`participants_${guildId}`) || [];
    for (const userId of participants) {
        const pData = client.lmdbGet(`participant_${guildId}_${userId}`);
        if (pData && pData.pfpLocalPath && fs.existsSync(pData.pfpLocalPath)) {
            try {
                fs.unlinkSync(pData.pfpLocalPath);
            } catch (err) {
                console.error("Failed to delete local pfp file:", err);
            }
        }
        client.lmdbDel(`participant_${guildId}_${userId}`);
    }
    client.lmdbDel(`participants_${guildId}`);

    // 2. Clear all voting cards and votes records
    const cards = client.lmdbGet(`voting_cards_${guildId}`) || [];
    for (const card of cards) {
        const voters = client.lmdbGet(`votes_${guildId}_${card.messageId}`) || [];
        for (const voterId of voters) {
            client.lmdbDel(`voter_record_${guildId}_${voterId}`);
        }
        client.lmdbDel(`voting_card_${guildId}_${card.messageId}`);
        client.lmdbDel(`votes_${guildId}_${card.messageId}`);
    }
    client.lmdbDel(`voting_cards_${guildId}`);
    client.lmdbDel(`voting_leaderboard_msg_${guildId}`);

    // 3. Get channel IDs from database to delete them
    const logsId = client.lmdbGet(`voting_logs_channel_${guildId}`);
    const regLogsId = client.lmdbGet(`registration_logs_channel_${guildId}`);
    const leaderboardId = client.lmdbGet(`voting_leaderboard_channel_${guildId}`);
    const areaId = client.lmdbGet(`registration_area_channel_${guildId}`);
    const votingAreaId = client.lmdbGet(`voting_area_channel_${guildId}`);

    const channelIds = [logsId, regLogsId, leaderboardId, areaId, votingAreaId].filter(Boolean);
    let categoryId = null;

    // Delete channels
    for (const id of channelIds) {
        const channel = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
        if (channel) {
            if (!categoryId && channel.parentId) {
                categoryId = channel.parentId;
            }
            await channel.delete("Voting system disabled, cleaning up channels").catch(() => {});
        }
    }

    // Delete category
    if (categoryId) {
        const category = guild.channels.cache.get(categoryId) || await guild.channels.fetch(categoryId).catch(() => null);
        if (category) {
            await category.delete("Voting system disabled, cleaning up category").catch(() => {});
        }
    }

    // 4. Remove channel keys from database
    client.lmdbDel(`voting_logs_channel_${guildId}`);
    client.lmdbDel(`registration_logs_channel_${guildId}`);
    client.lmdbDel(`voting_leaderboard_channel_${guildId}`);
    client.lmdbDel(`registration_area_channel_${guildId}`);
    client.lmdbDel(`voting_area_channel_${guildId}`);

    // 5. Update system status to disabled/inactive
    client.lmdbDel(`voting_system_${guildId}`);
}

module.exports = {
    getTrophyEmoji,
    getVoteEmoji,
    getArrowEmoji,
    getTickEmoji,
    getCrossEmoji,
    setupVoting,
    disableVoting
};
