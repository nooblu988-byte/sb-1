const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const {
    getTrophyEmoji,
    getVoteEmoji,
    getArrowEmoji,
    getTickEmoji,
    getCrossEmoji
} = require("../../utils/votingHelper");

module.exports = {
    name: "pfp",
    description: "Upload or drop profile pictures for the voting event",
    category: "voting",
    cooldown: 3,

    run: async (client, message, args, prefix) => {
        // Permissions Check (Server Owner / Whitelisted / Admins)
        const owners = client.config?.owner || [];
        const extra1 = client.lmdbGet(`ownerPermit1_${message.guild.id}`);
        const extra2 = client.lmdbGet(`ownerPermit2_${message.guild.id}`);
        const extraOwners = [extra1, extra2].filter(Boolean);

        const guildId = message.guild.id;
        const tickEmoji = getTickEmoji(client, guildId);
        const crossEmoji = getCrossEmoji(client, guildId);
        const arrowEmoji = getArrowEmoji(client, guildId);
        const trophyEmoji = getTrophyEmoji(client, guildId);
        const votingEmoji = getVoteEmoji(client, guildId);

        if (
            message.author.id !== message.guild.ownerId &&
            !owners.includes(message.author.id) &&
            !extraOwners.includes(message.author.id) &&
            !client.isWhitelisted(message.guild.id, message.author.id)
        ) {
            return message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0xFF0000)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${crossEmoji} Only the **Server Owner** or **whitelisted owners** can run this command.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const sub = args[0]?.toLowerCase();
        const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        if (!sub || (sub !== "drop" && sub !== "upload")) {
            return message.reply({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("## 🖼️ PFP Command Options")
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `\`${prefix}pfp upload <@user> <TeamName>\` — Manually upload and style a participant's PFP\n` +
                                `\`${prefix}pfp drop <@user>\` — Post a participant's styled PFP for voting (pure image)\n` +
                                `\`${prefix}pfp drop all\` — Post PFPs for all registered teams for voting`
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

        // ═══════════════════════════════════════════════════════════════
        // 📤 PFP UPLOAD COMMAND
        // ═══════════════════════════════════════════════════════════════
        if (sub === "upload") {
            const targetUser = message.mentions.users.first() || 
                               (args[1] ? await client.users.fetch(args[1]).catch(() => null) : null);

            if (!targetUser) {
                return message.reply({ content: `${crossEmoji} **Please specify the user.** (e.g. \`${prefix}pfp upload @User TeamName\`)` });
            }

            const teamName = args.slice(2).join(" ").trim();
            if (!teamName) {
                return message.reply({ content: `${crossEmoji} **Please specify a Team Name.** (e.g. \`${prefix}pfp upload @User TeamName\`)` });
            }

            // Look for image attachments or direct image links
            let pfpUrls = [];
            let attachments = [...message.attachments.values()];
            if (attachments.length > 0) {
                pfpUrls = attachments.map(att => att.url);
            } else {
                let linkArgs = args.slice(2).filter(arg => arg.startsWith("http"));
                if (linkArgs.length > 0) pfpUrls = linkArgs;
            }

            if (pfpUrls.length === 0 && message.reference) {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                let refAttachments = [...(refMsg?.attachments.values() || [])];
                pfpUrls = refAttachments.map(att => att.url);
            }

            if (pfpUrls.length === 0) {
                return message.reply({ content: `${crossEmoji} **Please attach image file(s) or provide direct image link(s).**` });
            }

            // We join up to 2 URLs for the duo processing, or 1 for single
            const isDuoUpload = pfpUrls.length >= 2;
            const pfpUrl = pfpUrls.slice(0, 2).join(",");

            const statusMsg = await message.reply({ content: "⏳ **Downloading and processing image(s) with canvas effects...**" });

            try {
                const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
                const urls = pfpUrl.split(",");
                const buffers = [];

                for (const url of urls) {
                    const res = await fetch(url, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        }
                    });
                    if (!res.ok) throw new Error("PFP download failed");
                    const buf = await res.buffer();
                    buffers.push(buf);
                }

                let processedBuffer;
                try {
                    const { applyPfpEffects } = require("../../utils/imageEffects");
                    processedBuffer = await applyPfpEffects(buffers);
                } catch (err) {
                    console.error("Failed to apply image effects on manual upload, using original PFP:", err);
                    processedBuffer = buffers[0];
                }

                const pfpsDir = path.join(__dirname, "..", "..", "database", "pfps");
                if (!fs.existsSync(pfpsDir)) {
                    fs.mkdirSync(pfpsDir, { recursive: true });
                }
                const filename = `${guildId}_${targetUser.id}_${Date.now()}.png`;
                const localPath = path.join(pfpsDir, filename);
                fs.writeFileSync(localPath, processedBuffer);

                const logsId = client.lmdbGet(`registration_logs_channel_${guildId}`);
                const logsChan = client.channels.cache.get(logsId) || 
                                 await client.channels.fetch(logsId).catch(() => null);

                let finalPfpUrl = pfpUrl;
                if (logsChan) {
                    const logMsg = await logsChan.send({
                        content: `📁 **PFP Backup (Manual Upload)** for Team \`${teamName}\``,
                        files: [{ attachment: processedBuffer, name: "pfp_event.png" }]
                    }).catch(() => null);
                    if (logMsg) {
                        finalPfpUrl = logMsg.attachments.first()?.url;
                    }
                }

                const participantData = {
                    userId: targetUser.id,
                    username: targetUser.tag,
                    isDuo: isDuoUpload,
                    teammateId: null,
                    teammateTag: null,
                    teamName: teamName,
                    pfpUrl: finalPfpUrl,
                    pfpLocalPath: localPath,
                    registeredAt: Date.now()
                };

                client.lmdbSet(`participant_${guildId}_${targetUser.id}`, participantData);
                const participants = client.lmdbGet(`participants_${guildId}`) || [];
                if (!participants.includes(targetUser.id)) {
                    participants.push(targetUser.id);
                    client.lmdbSet(`participants_${guildId}`, participants);
                }

                await statusMsg.edit({
                    content: `🎉 **Successfully uploaded and processed PFP for ${targetUser}!**\nTeam Name: \`${teamName}\``
                });

                if (logsChan) {
                    const { SectionBuilder, ThumbnailBuilder } = require("discord.js");
                    logsChan.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addSectionComponents(
                                    new SectionBuilder()
                                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📝 Registration Successful (Manual Upload)`))
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(targetUser.displayAvatarURL({ size: 256 })))
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `> **Team Name:** **${teamName}**\n` +
                                        `> **Registrant:** ${targetUser} (\`${targetUser.tag}\` / \`${targetUser.id}\`)\n` +
                                        `> **Type:** \`${isDuoUpload ? "Duo" : "Single"} (Manual Upload)\`\n` +
                                        `> **Uploaded By:** ${message.author} (\`${message.author.tag}\`)\n` +
                                        `> **Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                                    )
                                )
                        ],
                        files: [{ attachment: processedBuffer, name: "registered_pfp.png" }],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            } catch (err) {
                console.error("Error in manual upload:", err);
                await statusMsg.edit({ content: `${crossEmoji} **Failed to upload PFP:** ${err.message}` });
            }
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // 🗳️ PFP DROP COMMAND
        // ═══════════════════════════════════════════════════════════════
        if (sub === "drop") {
            const isAll = args[1]?.toLowerCase() === "all";

            if (isAll) {
                const participants = client.lmdbGet(`participants_${guildId}`) || [];
                if (participants.length === 0) {
                    return message.reply({ content: `${crossEmoji} **No participants are registered yet.**` });
                }

                const statusMsg = await message.reply({ content: `⏳ **Starting to drop PFPs for all registered teams...**` });

                const droppedTeams = new Set();
                let successCount = 0;
                let teamCounter = 0;

                for (const userId of participants) {
                    const participant = client.lmdbGet(`participant_${guildId}_${userId}`);
                    if (!participant) continue;

                    const uniqueKey = participant.userId;
                    if (droppedTeams.has(uniqueKey)) continue;
                    droppedTeams.add(uniqueKey);

                    const targetUser = await client.users.fetch(participant.userId).catch(() => null);
                    if (!targetUser) continue;

                    const pfpPath = participant.pfpLocalPath;
                    let fileAttachment;

                    if (fs.existsSync(pfpPath)) {
                        fileAttachment = { attachment: pfpPath, name: `${participant.teamName}_pfp.png` };
                    } else {
                        fileAttachment = { attachment: participant.pfpUrl, name: `${participant.teamName}_pfp.png` };
                    }

                    teamCounter++;
                    let dropContent = `## **TEAM ${teamCounter}:- ${participant.teamName}**\n`;
                    if (participant.isDuo && participant.teammateId) {
                        dropContent += `## **NAME:-** <@${participant.userId}> & <@${participant.teammateId}>`;
                    } else {
                        dropContent += `## **NAME:-** <@${participant.userId}>`;
                    }

                    const pfpMessage = await message.channel.send({
                        content: dropContent,
                        files: [fileAttachment]
                    }).catch(err => {
                        console.error(`Drop failed for team ${participant.teamName}:`, err);
                        return null;
                    });

                    if (pfpMessage) {
                        successCount++;
                        
                        let reactionEmoji = votingEmoji;
                        const customMatch = votingEmoji.match(/<?a?:?([^:\s]+):(\d+)>?/);
                        if (customMatch) {
                            reactionEmoji = customMatch[2];
                        }

                        await pfpMessage.react(reactionEmoji).catch(() => {});

                        client.lmdbSet(`voting_card_${guildId}_${pfpMessage.id}`, {
                            messageId: pfpMessage.id,
                            userId: targetUser.id,
                            teamName: participant.teamName
                        });

                        const cards = client.lmdbGet(`voting_cards_${guildId}`) || [];
                        cards.push({
                            messageId: pfpMessage.id,
                            channelId: message.channel.id,
                            userId: targetUser.id,
                            teamName: participant.teamName
                        });
                        client.lmdbSet(`voting_cards_${guildId}`, cards);

                        const logsId = client.lmdbGet(`voting_logs_channel_${guildId}`) || 
                                       client.lmdbGet(`logging_cfg_${guildId}`)?.voting;
                        const logsChan = client.channels.cache.get(logsId) || 
                                         await client.channels.fetch(logsId).catch(() => null);
                        if (logsChan) {
                            await logsChan.send({
                                components: [
                                    new ContainerBuilder()
                                        .setAccentColor(0x26272F)
                                        .addTextDisplayComponents(
                                            new TextDisplayBuilder().setContent(
                                                `🗳️ **PFP Dropped for Voting (Bulk)**\n` +
                                                `> **Team:** \`${participant.teamName}\`\n` +
                                                `> **User:** ${targetUser} (\`${targetUser.tag}\`)\n` +
                                                `> **Message Link:** [Jump to Message](${pfpMessage.url})`
                                            )
                                        )
                                ],
                                flags: MessageFlags.IsComponentsV2
                            }).catch(() => {});
                        }

                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }

                const { updateLeaderboard } = require("../../events/messageReactionRemove");
                await updateLeaderboard(client, message.guild).catch(() => {});

                await statusMsg.edit({ content: `${tickEmoji} **Successfully dropped PFPs for ${successCount} teams!**` });
                return;
            } else {
                const targetUser = message.mentions.users.first() || 
                                   (args[1] ? await client.users.fetch(args[1]).catch(() => null) : null);

                if (!targetUser) {
                    return message.reply({ content: `${crossEmoji} **Please specify the user.** (e.g. \`${prefix}pfp drop @User\` or \`${prefix}pfp drop all\`)` });
                }

                const participant = client.lmdbGet(`participant_${guildId}_${targetUser.id}`);
                if (!participant) {
                    return message.reply({ content: `${crossEmoji} **This user is not registered for the PFP event.**` });
                }

                const pfpPath = participant.pfpLocalPath;
                let fileAttachment;

                if (fs.existsSync(pfpPath)) {
                    fileAttachment = { attachment: pfpPath, name: `${participant.teamName}_pfp.png` };
                } else {
                    fileAttachment = { attachment: participant.pfpUrl, name: `${participant.teamName}_pfp.png` };
                }

                let dropContent = `## **TEAM 1:- ${participant.teamName}**\n`;
                if (participant.isDuo && participant.teammateId) {
                    dropContent += `## **NAME:-** <@${participant.userId}> & <@${participant.teammateId}>`;
                } else {
                    dropContent += `## **NAME:-** <@${participant.userId}>`;
                }

                const pfpMessage = await message.channel.send({
                    content: dropContent,
                    files: [fileAttachment]
                }).catch(err => {
                    console.error("Drop failed:", err);
                    return null;
                });

                if (!pfpMessage) {
                    return message.reply({ content: `${crossEmoji} **Failed to drop PFP image.** Check bot channel attachments permissions.` });
                }

                let reactionEmoji = votingEmoji;
                const customMatch = votingEmoji.match(/<?a?:?([^:\s]+):(\d+)>?/);
                if (customMatch) {
                    reactionEmoji = customMatch[2];
                }

                Promise.all([
                    pfpMessage.react(reactionEmoji).catch(() => {}),
                    message.delete().catch(() => {})
                ]).catch(() => {});

                client.lmdbSet(`voting_card_${guildId}_${pfpMessage.id}`, {
                    messageId: pfpMessage.id,
                    userId: targetUser.id,
                    teamName: participant.teamName
                });

                const cards = client.lmdbGet(`voting_cards_${guildId}`) || [];
                cards.push({
                    messageId: pfpMessage.id,
                    channelId: message.channel.id,
                    userId: targetUser.id,
                    teamName: participant.teamName
                });
                client.lmdbSet(`voting_cards_${guildId}`, cards);

                const logsId = client.lmdbGet(`voting_logs_channel_${guildId}`) || 
                               client.lmdbGet(`logging_cfg_${guildId}`)?.voting;
                const logsChan = client.channels.cache.get(logsId) || 
                                 await client.channels.fetch(logsId).catch(() => null);
                if (logsChan) {
                    await logsChan.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `🗳️ **PFP Dropped for Voting**\n` +
                                        `> **Team:** \`${participant.teamName}\`\n` +
                                        `> **User:** ${targetUser} (\`${targetUser.tag}\`)\n` +
                                        `> **Message Link:** [Jump to Message](${pfpMessage.url})`
                                    )
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }

                const { updateLeaderboard } = require("../../events/messageReactionRemove");
                await updateLeaderboard(client, message.guild).catch(() => {});
            }
        }
    }
};
