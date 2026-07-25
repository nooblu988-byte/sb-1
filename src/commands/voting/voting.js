const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
    ChannelType,
    PermissionFlagsBits
} = require("discord.js");

const {
    getTrophyEmoji,
    getVoteEmoji,
    getArrowEmoji,
    getTickEmoji,
    getCrossEmoji,
    setupVoting,
    disableVoting
} = require("../../utils/votingHelper");

module.exports = {
    name: "voting",
    aliases: ["vote", "vpfp"],
    description: "Manage voting and registration for PFP events",
    category: "voting",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        // Permissions Check (Server Owner / Admins / Bot Owners)
        const owners = client.config?.owner || [];
        const extra1 = client.lmdbGet(`ownerPermit1_${message.guild.id}`);
        const extra2 = client.lmdbGet(`ownerPermit2_${message.guild.id}`);
        const extraOwners = [extra1, extra2].filter(Boolean);

        const tickEmoji = getTickEmoji(client, message.guild.id);
        const crossEmoji = getCrossEmoji(client, message.guild.id);
        const arrowEmoji = getArrowEmoji(client, message.guild.id);
        const trophyEmoji = getTrophyEmoji(client, message.guild.id);

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id) &&
            !extraOwners.includes(message.author.id) &&
            !client.isWhitelisted(message.guild.id, message.author.id) &&
            !message.member.permissions.has(PermissionFlagsBits.Administrator)
        ) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${crossEmoji} Only the **Server Owner**, **Administrators**, or **bot owners** can run this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const sub = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!sub) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## 🗳️ Voting & PFP Event System`)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}voting setup\` (or \`enable\`) — Setup channels & registration panel\n` +
                                `\`${prefix}voting disable\` — Disable registration panel\n` +
                                `\`${prefix}voting hide\` — Hide voting and registration channels\n` +
                                `\`${prefix}voting unhide\` — Unhide voting and registration channels\n` +
                                `\`${prefix}voting status\` — View configurations & control panel\n` +
                                `\`${prefix}voting removebot\` — Clean up underage votes (< 25 days old) live\n\n` +
                                `### ⚙️ Emoji Configurations\n` +
                                `\`${prefix}voting setemoji <emoji>\` — Configure voting reaction emoji\n` +
                                `\`${prefix}voting settrophy <emoji>\` — Configure trophy/title emoji\n` +
                                `\`${prefix}voting setarrow <emoji>\` — Configure arrow emoji\n` +
                                `\`${prefix}voting settick <emoji>\` — Configure success checkmark emoji\n` +
                                `\`${prefix}voting setcross <emoji>\` — Configure failure cross emoji`
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

        if (sub === "setup" || sub === "enable") {
            const statusMsg = await message.reply({ content: "⏳ **Setting up PFP Event channels, please wait...**" });

            try {
                await setupVoting(client, message.guild, message.author);
                await statusMsg.edit({
                    content: `${tickEmoji} **PFP Event System Setup Completed Successfully!**\nCategory and channels have been created under **${trophyEmoji} PFP Event** category.`
                });
            } catch (err) {
                console.error("Setup failed:", err);
                await statusMsg.edit({ content: `${crossEmoji} **Setup Failed:** ${err.message}` });
            }
            return;
        }

        if (sub === "disable") {
            await disableVoting(client, message.guild, message.author);
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${tickEmoji} **The voting system registration is now disabled.**`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "setemoji") {
            const emojiStr = args[1];
            if (!emojiStr) {
                return message.reply({ content: `${crossEmoji} **Please specify the emoji to use.** (e.g. \`${prefix}voting setemoji 💖\`)` });
            }

            let finalEmojiStr = emojiStr;
            const customMatch = emojiStr.match(/<?(a?):([^:\s]+):(\d+)>?/);
            if (customMatch) {
                const isAnimated = !!customMatch[1];
                const emojiName = customMatch[2];
                const emojiId = customMatch[3];

                const exists = message.guild.emojis.cache.get(emojiId);
                if (!exists) {
                    const statusMsg = await message.reply({ content: "⏳ **Downloading and importing custom emoji into server...**" });
                    try {
                        const extension = isAnimated ? "gif" : "png";
                        const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`;
                        
                        const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
                        const res = await fetch(emojiUrl);
                        if (!res.ok) throw new Error("Failed to download emoji image");
                        const emojiBuffer = await res.buffer();

                        const newEmoji = await message.guild.emojis.create({
                            attachment: emojiBuffer,
                            name: emojiName
                        });

                        finalEmojiStr = newEmoji.toString();
                        await statusMsg.edit({
                            content: `${tickEmoji} **Successfully imported and set voting emoji:** ${finalEmojiStr}`
                        });
                    } catch (err) {
                        console.error("Failed to import/steal emoji:", err);
                        await statusMsg.edit({
                            content: `⚠️ **Could not import custom emoji to server.** Using original: ${emojiStr} (Make sure the bot has "Manage Emojis" permissions)`
                        });
                    }
                }
            }

            client.lmdbSet(`voting_emoji_${guildId}`, finalEmojiStr);

            const logsId = client.lmdbGet(`voting_logs_channel_${guildId}`);
            const logsChan = client.channels.cache.get(logsId) || 
                             await client.channels.fetch(logsId).catch(() => null);
            if (logsChan) {
                await logsChan.send({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`⚙️ **Voting Emoji Updated** | New emoji: ${finalEmojiStr} (updated by ${message.author})`)
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${tickEmoji} **Voting emoji has been set to:** ${finalEmojiStr}`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "status") {
            const isEnabled = client.lmdbGet(`voting_system_${guildId}`) === "enabled";
            const logs = client.lmdbGet(`voting_logs_channel_${guildId}`) || "Not Set";
            const regLogs = client.lmdbGet(`registration_logs_channel_${guildId}`) || "Not Set";
            const leaderboard = client.lmdbGet(`voting_leaderboard_channel_${guildId}`) || "Not Set";
            const area = client.lmdbGet(`registration_area_channel_${guildId}`) || "Not Set";
            const votingArea = client.lmdbGet(`voting_area_channel_${guildId}`) || "Not Set";
            const participants = client.lmdbGet(`participants_${guildId}`) || [];

            const isEnabled2 = client.emoji.enabled2 || "🟢";
            const isDisabled2 = client.emoji.disabled2 || "🔴";

            const container = new ContainerBuilder()
                .setAccentColor(isEnabled ? 0x57F287 : 0xFF0000)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## 🗳️ ${message.guild.name} — Voting Status`)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**System Status:** ${isEnabled ? `${isEnabled2} Enabled` : `${isDisabled2} Disabled`}\n` +
                        `**Total Participants:** \`${participants.length} users\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### 📍 Channel Configuration\n` +
                        `**Voting Logs:** ${logs !== "Not Set" ? `<#${logs}>` : "\`Not Set\`"}\n` +
                        `**Registration Logs:** ${regLogs !== "Not Set" ? `<#${regLogs}>` : "\`Not Set\`"}\n` +
                        `**Voting Leaderboard:** ${leaderboard !== "Not Set" ? `<#${leaderboard}>` : "\`Not Set\`"}\n` +
                        `**Registration Area:** ${area !== "Not Set" ? `<#${area}>` : "\`Not Set\`"}\n` +
                        `**Voting Area:** ${votingArea !== "Not Set" ? `<#${votingArea}>` : "\`Not Set\`"}`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### 🎨 Emoji Configuration\n` +
                        `**Trophy Emoji:** ${trophyEmoji}\n` +
                        `**Voting Emoji:** ${getVoteEmoji(client, guildId)}\n` +
                        `**Arrow Emoji:** ${arrowEmoji}\n` +
                        `**Success Emoji:** ${tickEmoji}\n` +
                        `**Failure Emoji:** ${crossEmoji}`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
                )
                .addActionRowComponents((row) =>
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId("voting_control_setup")
                            .setLabel("Setup / Enable")
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId("voting_control_disable")
                            .setLabel("Disable System")
                            .setStyle(ButtonStyle.Danger)
                    )
                );

            return message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "hide") {
            const leaderboardChanId = client.lmdbGet(`voting_leaderboard_channel_${guildId}`);
            const regAreaChanId = client.lmdbGet(`registration_area_channel_${guildId}`);
            const votingAreaChanId = client.lmdbGet(`voting_area_channel_${guildId}`);

            if (!leaderboardChanId && !regAreaChanId && !votingAreaChanId) {
                return message.reply({ content: `${crossEmoji} **Voting channels are not configured yet. Run setup first.**` });
            }

            const everyoneRole = message.guild.roles.everyone;
            let hiddenChannels = [];

            if (leaderboardChanId) {
                const channel = message.guild.channels.cache.get(leaderboardChanId) || 
                                await message.guild.channels.fetch(leaderboardChanId).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: false
                    }).catch(console.error);
                    hiddenChannels.push(channel.toString());
                }
            }

            if (regAreaChanId) {
                const channel = message.guild.channels.cache.get(regAreaChanId) || 
                                await message.guild.channels.fetch(regAreaChanId).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: false
                    }).catch(console.error);
                    hiddenChannels.push(channel.toString());
                }
            }

            if (votingAreaChanId) {
                const channel = message.guild.channels.cache.get(votingAreaChanId) || 
                                await message.guild.channels.fetch(votingAreaChanId).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: false
                    }).catch(console.error);
                    hiddenChannels.push(channel.toString());
                }
            }

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${tickEmoji} **Successfully hid the following channels from users:**\n${hiddenChannels.join("\n")}`
                            )
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "unhide") {
            const leaderboardChanId = client.lmdbGet(`voting_leaderboard_channel_${guildId}`);
            const regAreaChanId = client.lmdbGet(`registration_area_channel_${guildId}`);
            const votingAreaChanId = client.lmdbGet(`voting_area_channel_${guildId}`);

            if (!leaderboardChanId && !regAreaChanId && !votingAreaChanId) {
                return message.reply({ content: `${crossEmoji} **Voting channels are not configured yet. Run setup first.**` });
            }

            const everyoneRole = message.guild.roles.everyone;
            let unhiddenChannels = [];

            if (leaderboardChanId) {
                const channel = message.guild.channels.cache.get(leaderboardChanId) || 
                                await message.guild.channels.fetch(leaderboardChanId).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: true,
                        SendMessages: false,
                        AddReactions: false
                    }).catch(console.error);
                    unhiddenChannels.push(channel.toString());
                }
            }

            if (regAreaChanId) {
                const channel = message.guild.channels.cache.get(regAreaChanId) || 
                                await message.guild.channels.fetch(regAreaChanId).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: true,
                        SendMessages: false
                    }).catch(console.error);
                    unhiddenChannels.push(channel.toString());
                }
            }

            if (votingAreaChanId) {
                const channel = message.guild.channels.cache.get(votingAreaChanId) || 
                                await message.guild.channels.fetch(votingAreaChanId).catch(() => null);
                if (channel) {
                    await channel.permissionOverwrites.edit(everyoneRole, {
                        ViewChannel: true,
                        SendMessages: false,
                        AddReactions: false
                    }).catch(console.error);
                    unhiddenChannels.push(channel.toString());
                }
            }

            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x00FF00)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${tickEmoji} **Successfully unhid the following channels for users:**\n${unhiddenChannels.join("\n")}`
                            )
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "settitleemoji" || sub === "settrophy") {
            const emojiStr = args[1];
            if (!emojiStr) {
                return message.reply({ content: `${crossEmoji} **Please specify the title/trophy emoji.** (e.g. \`${prefix}voting settrophy 👑\`)` });
            }
            client.lmdbSet(`voting_trophy_emoji_${guildId}`, emojiStr);
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${tickEmoji} **Trophy/Title emoji has been set to:** ${emojiStr}`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "setarrow") {
            const emojiStr = args[1];
            if (!emojiStr) {
                return message.reply({ content: `${crossEmoji} **Please specify the arrow emoji.** (e.g. \`${prefix}voting setarrow ➡️\`)` });
            }
            client.lmdbSet(`voting_arrow_emoji_${guildId}`, emojiStr);
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${tickEmoji} **Arrow emoji has been set to:** ${emojiStr}`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "settick") {
            const emojiStr = args[1];
            if (!emojiStr) {
                return message.reply({ content: `${crossEmoji} **Please specify the success checkmark emoji.** (e.g. \`${prefix}voting settick ✅\`)` });
            }
            client.lmdbSet(`voting_tick_emoji_${guildId}`, emojiStr);
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${tickEmoji} **Success/Tick emoji has been set to:** ${emojiStr}`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "setcross") {
            const emojiStr = args[1];
            if (!emojiStr) {
                return message.reply({ content: `${crossEmoji} **Please specify the failure cross emoji.** (e.g. \`${prefix}voting setcross ❌\`)` });
            }
            client.lmdbSet(`voting_cross_emoji_${guildId}`, emojiStr);
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`${tickEmoji} **Failure/Cross emoji has been set to:** ${emojiStr}`)
                        )
                ],
                flags: MessageFlags.IsComponentsV2
            });
        }

        if (sub === "removebot" || sub === "remove-bot" || sub === "remove") {
            const statusMsg = await message.reply({ content: "⏳ **Scanning votes for underage accounts (< 25 days old)...**" });

            try {
                await message.guild.members.fetch().catch(() => {});

                const cards = (await client.db.get(`voting_cards_${guildId}`)) || [];
                if (cards.length === 0) {
                    return statusMsg.edit({ content: `${crossEmoji} **No active voting cards found.**` });
                }

                let totalRemoved = 0;
                const removedSummary = [];

                for (const card of cards) {
                    // Real-time status update for visual progression
                    await statusMsg.edit({
                        content: `⏳ **Processing Team:** **${card.teamName}**... (Filtering underage votes)`
                    }).catch(() => {});

                    const voteKey = `votes_${guildId}_${card.messageId}`;
                    const voters = (await client.db.get(voteKey)) || [];
                    if (voters.length === 0) {
                        removedSummary.push({ teamName: card.teamName, original: 0, removed: 0, final: 0 });
                        continue;
                    }

                    const filteredVoters = [];
                    let underageCount = 0;

                    for (const voterId of voters) {
                        let voterUser = client.users.cache.get(voterId);
                        if (!voterUser) {
                            voterUser = await client.users.fetch(voterId).catch(() => null);
                        }

                        if (!voterUser) {
                            filteredVoters.push(voterId);
                            continue;
                        }

                        const ageInDays = (Date.now() - voterUser.createdTimestamp) / (1000 * 60 * 60 * 24);
                        if (ageInDays < 25) {
                            underageCount++;
                        } else {
                            filteredVoters.push(voterId);
                        }
                    }

                    if (underageCount > 0) {
                        await client.db.set(voteKey, filteredVoters);
                        client.lmdb.put(voteKey, filteredVoters);
                        totalRemoved += underageCount;

                        // Real-time leaderboard ticking updates!
                        const { updateLeaderboard } = require("../../events/messageReactionRemove");
                        await updateLeaderboard(client, message.guild).catch(() => {});
                    }

                    removedSummary.push({
                        teamName: card.teamName,
                        original: voters.length,
                        removed: underageCount,
                        final: filteredVoters.length
                    });

                    // Add delay to make the ticking countdown effect visible
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }

                // Final full sync of the leaderboard
                const { updateLeaderboard } = require("../../events/messageReactionRemove");
                await updateLeaderboard(client, message.guild).catch(() => {});

                let summaryContent = `## 🧹 Underage Vote Cleanup Completed\n` +
                                     `All votes from accounts less than **25 days old** have been filtered out of the database and leaderboard.\n\n` +
                                     `### 📊 Cleanup Breakdown:\n`;

                removedSummary.forEach(item => {
                    summaryContent += `> **${item.teamName}**: \`${item.original}\` votes ➡️ **${item.final}** votes (Removed: \`${item.removed}\`)\n`;
                });

                summaryContent += `\n**Total Underage Votes Removed:** \`${totalRemoved}\`\n` +
                                  `-# Note: Reactions on Discord messages were not deleted. Only leaderboard and DB scores have been updated.`;

                const container = new ContainerBuilder()
                    .setAccentColor(0x26272F)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(summaryContent)
                    );

                await statusMsg.edit({
                    content: null,
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });

            } catch (err) {
                console.error("Cleanup failed:", err);
                await statusMsg.edit({ content: `${crossEmoji} **Cleanup Failed:** ${err.message}` });
            }
            return;
        }
    }
};
