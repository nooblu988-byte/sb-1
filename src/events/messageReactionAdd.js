const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { getTrophyEmoji, getVoteEmoji, getArrowEmoji, getTickEmoji, getCrossEmoji } = require("../utils/votingHelper");

module.exports = (client) => {
    client.on("messageReactionAdd", async (reaction, user) => {
        if (user.bot) return;

        const guildId = reaction.message.guildId;
        if (!guildId) return;

        const guild = reaction.message.guild || client.guilds.cache.get(guildId);
        if (!guild) return;

        const messageId = reaction.message.id;

        // Fetch card directly from LMDB for instant 0ms check
        const isCard = client.lmdbGet(`voting_card_${guildId}_${messageId}`);
        if (!isCard) return;

        const configuredEmoji = getVoteEmoji(client, guildId);
        
        const isEmojiMatch = (reactionEmoji, configuredEmoji) => {
            if (!configuredEmoji) return false;
            const customEmojiMatch = configuredEmoji.match(/:(\d+)>$/) || configuredEmoji.match(/^(\d+)$/);
            if (customEmojiMatch) {
                return reactionEmoji.id === customEmojiMatch[1];
            }
            return reactionEmoji.name === configuredEmoji;
        };

        if (!isEmojiMatch(reaction.emoji, configuredEmoji)) return;

        const voteKey = `votes_${guildId}_${messageId}`;
        
        // Fetch voters from LMDB instantly
        const voters = client.lmdbGet(voteKey) || [];

        if (!voters.includes(user.id)) {
            voters.push(user.id);
            
            // Write to LMDB synchronously and update MongoDB in background
            client.lmdb.put(voteKey, voters);
            client.db.set(voteKey, voters).catch(() => {});

            // Update leaderboard in background without blocking
            const { updateLeaderboard } = require("./messageReactionRemove");
            updateLeaderboard(client, guild).catch(console.error);

            // Fetch user (if partial) and send logs asynchronously in the background
            (async () => {
                let voter = client.users.cache.get(user.id) || user;
                if (voter.partial) {
                    try {
                        voter = await client.users.fetch(voter.id);
                    } catch (err) {
                        console.error("Failed to fetch partial user in background:", err);
                    }
                }

                const createdTimestamp = voter.createdTimestamp || Date.now();
                const accountAgeInDays = (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);

                const logsId = client.lmdbGet(`voting_logs_channel_${guildId}`) || 
                               client.lmdbGet(`logging_cfg_${guildId}`)?.voting;
                const logsChan = client.channels.cache.get(logsId) || 
                                 await client.channels.fetch(logsId).catch(() => null);
                if (logsChan) {
                    let avatarUrl;
                    try {
                        avatarUrl = voter.displayAvatarURL({ size: 256 });
                    } catch {
                        avatarUrl = voter.defaultAvatarURL;
                    }
                    const isUnderage = accountAgeInDays < 25;
                    const warningText = isUnderage ? `\n> **⚠️ Warning:** Account is < 25 days old (\`${accountAgeInDays.toFixed(1)} days\`)` : "";

                    const container = new ContainerBuilder()
                        .setAccentColor(isUnderage ? 0xF39C12 : 0x2ECC71)
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(isUnderage ? `## ➕ Vote Registered (Underage Account)` : `## ➕ Vote Registered`)
                                )
                                .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
                        )
                        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `> **Voter:** ${voter} (\`${voter.tag || voter.id}\` / \`${voter.id}\`)\n` +
                                `> **Voted For Team:** **${isCard.teamName}**\n` +
                                `> **Target Member:** <@${isCard.userId}>\n` +
                                `> **Timestamp:** <t:${Math.floor(Date.now() / 1000)}:T> (<t:${Math.floor(Date.now() / 1000)}:R>)${warningText}`
                            )
                        );

                    await logsChan.send({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
            })().catch(console.error);
        }
    });
};
