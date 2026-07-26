const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { getTrophyEmoji, getVoteEmoji, getArrowEmoji, getTickEmoji, getCrossEmoji } = require("../utils/votingHelper");

const mongoWriteQueues = new Map(); // key -> Promise

function queueMongoWrite(client, key, value) {
    let queue = mongoWriteQueues.get(key) || Promise.resolve();
    queue = queue.then(async () => {
        await client.db.set(key, value);
    }).catch(err => {
        console.error(`MongoDB write error for key ${key}:`, err);
    });
    mongoWriteQueues.set(key, queue);
    
    // Cleanup queue when done to avoid memory leaks
    queue.finally(() => {
        if (mongoWriteQueues.get(key) === queue) {
            mongoWriteQueues.delete(key);
        }
    });
}

module.exports = (client) => {
    client.on("messageReactionAdd", async (reaction, user) => {
        if (reaction.message.partial) {
            try {
                await reaction.message.fetch();
            } catch (err) {
                console.error("Failed to fetch partial message in messageReactionAdd:", err);
                return;
            }
        }

        if (user.bot || !reaction.message.guild) return;

        const guild = reaction.message.guild;
        const guildId = guild.id;
        const messageId = reaction.message.id;

        // Fetch card metadata from LMDB (fallback to MongoDB)
        let isCard = client.lmdbGet(`voting_card_${guildId}_${messageId}`);
        if (!isCard) {
            isCard = await client.db.get(`voting_card_${guildId}_${messageId}`);
            if (isCard) {
                client.lmdb.putSync(`voting_card_${guildId}_${messageId}`, isCard);
            }
        }
        if (!isCard) return;

        // Fetch user if partial
        let voter = user;
        if (voter.partial) {
            try {
                voter = await client.users.fetch(voter.id);
            } catch (err) {
                console.error("Failed to fetch partial user in messageReactionAdd:", err);
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

        const createdTimestamp = voter.createdTimestamp || Date.now();
        const accountAgeInDays = (Date.now() - createdTimestamp) / (1000 * 60 * 60 * 24);

        const voteKey = `votes_${guildId}_${messageId}`;
        
        // Check if the user has already voted on any card in this guild
        const voterRecordKey = `voter_record_${guildId}_${voter.id}`;
        const alreadyVotedMsgId = client.lmdbGet(voterRecordKey);
        if (alreadyVotedMsgId && alreadyVotedMsgId !== messageId) {
            // Remove the user's reaction automatically since they can only vote for one card
            await reaction.users.remove(voter.id).catch(() => {});
            return;
        }

        // Fetch voters synchronously from LMDB
        const voters = client.lmdbGet(voteKey) || [];

        if (!voters.includes(voter.id)) {
            voters.push(voter.id);
            // Save the voting record
            client.lmdbSet(voterRecordKey, messageId);
            // Write to LMDB synchronously to prevent race conditions
            client.lmdb.putSync(voteKey, voters);
            // Sync to MongoDB sequentially in the background to prevent out-of-order writes
            queueMongoWrite(client, voteKey, voters);

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

            // Do not await scheduleLeaderboardUpdate to make reaction response instant and smooth
            const { scheduleLeaderboardUpdate } = require("./messageReactionRemove");
            scheduleLeaderboardUpdate(client, guild).catch(console.error);
        }
    });
};
