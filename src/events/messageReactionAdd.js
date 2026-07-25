const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { getTrophyEmoji, getVoteEmoji, getArrowEmoji, getTickEmoji, getCrossEmoji } = require("../utils/votingHelper");

module.exports = (client) => {
    client.on("messageReactionAdd", async (reaction, user) => {
        if (user.bot || !reaction.message.guild) return;

        const guildId = reaction.message.guild.id;
        const messageId = reaction.message.id;

        // Fetch card directly from MongoDB for real-time consistency across shards/restarts
        const isCard = await client.db.get(`voting_card_${guildId}_${messageId}`);
        if (!isCard) return;

        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (err) {
                console.error("Failed to fetch partial reaction:", err);
                return;
            }
        }

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

        const accountAgeInDays = (Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24);

        const voteKey = `votes_${guildId}_${messageId}`;
        
        // Fetch voters directly from MongoDB
        const voters = (await client.db.get(voteKey)) || [];

        if (!voters.includes(user.id)) {
            voters.push(user.id);
            // Write to MongoDB and keep local LMDB in sync
            await client.db.set(voteKey, voters);
            client.lmdb.put(voteKey, voters);

            const logsId = client.lmdbGet(`voting_logs_channel_${guildId}`) || 
                           client.lmdbGet(`logging_cfg_${guildId}`)?.voting;
            const logsChan = client.channels.cache.get(logsId) || 
                             await client.channels.fetch(logsId).catch(() => null);
            if (logsChan) {
                const avatarUrl = user.displayAvatarURL({ size: 256 });
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
                            `> **Voter:** ${user} (\`${user.tag}\` / \`${user.id}\`)\n` +
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

            // Do not await updateLeaderboard to make the reaction response instant and smooth
            const { updateLeaderboard } = require("./messageReactionRemove");
            updateLeaderboard(client, reaction.message.guild).catch(console.error);
        }
    });
};
