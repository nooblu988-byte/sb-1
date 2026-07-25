const { 
    ContainerBuilder, 
    TextDisplayBuilder, 
    MessageFlags, 
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
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
} = require("../utils/votingHelper");

module.exports = (client) => {
    client.on("interactionCreate", async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd || !cmd.runSlash) return;

            try {
                await cmd.runSlash(client, interaction);
            } catch (err) {
                console.error(`[Slash Command Error] ${interaction.commandName}:`, err);
                const errPayload = {
                    components: [
                        new ContainerBuilder()
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent("An error occurred while executing this command."))
                    ],
                    flags: MessageFlags.IsComponentsV2 | 64,
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errPayload).catch(() => {});
                } else {
                    await interaction.reply(errPayload).catch(() => {});
                }
            }
            return;
        }

        if (!interaction.isButton()) return;

        if (interaction.customId === "cmd_delete") {
            if (interaction.message.interaction?.user?.id !== interaction.user.id) {
                return interaction.reply({ content: "You cannot delete this message!", flags: 64 });
            }
            await interaction.message.delete().catch(() => {});
            return;
        }

        const guildId = interaction.guildId;
        const tickEmoji = getTickEmoji(client, guildId);
        const crossEmoji = getCrossEmoji(client, guildId);

        // ═══════════════════════════════════════════════════════════════
        // 🗳️ VOTING CONTROL BUTTONS HANDLER (ADMINS ONLY)
        // ═══════════════════════════════════════════════════════════════
        if (interaction.customId === "voting_control_setup" || interaction.customId === "voting_control_disable") {
            const owners = client.config?.owner || [];
            const extra1 = client.lmdbGet(`ownerPermit1_${guildId}`);
            const extra2 = client.lmdbGet(`ownerPermit2_${guildId}`);
            const extraOwners = [extra1, extra2].filter(Boolean);

            if (
                interaction.user.id !== interaction.guild.ownerId &&
                !owners.includes(interaction.user.id) &&
                !extraOwners.includes(interaction.user.id) &&
                !client.isWhitelisted(guildId, interaction.user.id) &&
                !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
            ) {
                return interaction.reply({
                    content: `${crossEmoji} **Only the Server Owner, Administrators, or bot owners can manage this.**`,
                    flags: 64
                });
            }

            if (interaction.customId === "voting_control_setup") {
                await interaction.reply({ content: "⏳ **Setting up voting system channels...**", flags: 64 });
                try {
                    const category = await setupVoting(client, interaction.guild, interaction.user);
                    await interaction.followUp({
                        content: `${tickEmoji} **Voting system setup completed successfully!** Created category: **${category.name}**`,
                        flags: 64
                    });
                } catch (err) {
                    console.error("Setup via button failed:", err);
                    await interaction.followUp({
                        content: `${crossEmoji} **Setup failed:** ${err.message}`,
                        flags: 64
                    });
                }
            } else {
                await disableVoting(client, interaction.guild, interaction.user);
                await interaction.reply({
                    content: `${tickEmoji} **Voting registration buttons have been successfully disabled.**`,
                    flags: 64
                });
            }
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // 🗳️ VOTING REGISTRATION BUTTONS HANDLER
        // ═══════════════════════════════════════════════════════════════
        if (interaction.customId === "voting_reg_single" || interaction.customId === "voting_reg_duo") {
            const isEnabled = client.lmdbGet(`voting_system_${guildId}`) === "enabled";

            if (!isEnabled) {
                return interaction.reply({
                    content: `${crossEmoji} **The voting system is currently disabled by administrators.**`,
                    flags: 64
                });
            }

            const isDuo = interaction.customId === "voting_reg_duo";
            const participants = client.lmdbGet(`participants_${guildId}`) || [];

            if (participants.includes(interaction.user.id)) {
                return interaction.reply({
                    content: `${crossEmoji} **You are already registered for this event!**`,
                    flags: 64
                });
            }

            // Create private thread under the registration channel
            const channel = interaction.channel;
            const thread = await channel.threads.create({
                name: `register-${interaction.user.username}`,
                type: ChannelType.GuildPrivateThread,
                reason: 'PFP Event Registration Wizard',
                autoArchiveDuration: 60,
            }).catch(async (err) => {
                console.error("Failed to create private thread, trying public thread:", err);
                return await channel.threads.create({
                    name: `register-${interaction.user.username}`,
                    type: ChannelType.GuildPublicThread,
                    reason: 'PFP Event Registration Wizard',
                    autoArchiveDuration: 60,
                }).catch(() => null);
            });

            if (!thread) {
                return interaction.reply({
                    content: `${crossEmoji} **Failed to start registration.** Thread creation failed. Ensure the bot has \`Manage Threads\` permissions.`,
                    flags: 64
                });
            }

            await thread.members.add(interaction.user.id).catch(() => {});
            await interaction.reply({
                content: `${tickEmoji} **Registration started!** Go to the thread ${thread} to complete your registration.`,
                flags: 64
            });

            // Start Wizard
            runRegistrationWizard(client, thread, interaction, isDuo);
        }
    });
};

/**
 * Handles step-by-step registration wizard in the private thread.
 */
async function runRegistrationWizard(client, thread, interaction, isDuo) {
    const guildId = interaction.guildId;
    const arrowEmoji = getArrowEmoji(client, guildId);
    const tickEmoji = getTickEmoji(client, guildId);
    const crossEmoji = getCrossEmoji(client, guildId);

    const sep = () => {
        const { SeparatorBuilder, SeparatorSpacingSize } = require("discord.js");
        return new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
    };

    try {
        const greetEmbed = new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 📝 PFP Event Registration Wizard (${isDuo ? "Duo" : "Single"})`),
                new TextDisplayBuilder().setContent(
                    `Welcome ${interaction.user}! Please complete the registration details below.\n\n` +
                    `${arrowEmoji} **Step 1:** Enter your **Team Name** (e.g. "Team Warriors").`
                )
            )
            .addSeparatorComponents(sep());

        await thread.send({
            components: [greetEmbed],
            flags: MessageFlags.IsComponentsV2
        });

        const filter = m => m.author.id === interaction.user.id;
        const collector = thread.createMessageCollector({ filter, time: 300000 }); // 5 minutes

        let step = 1;
        let teamName = "";
        let teammateUser = null;
        let pfpUrl = "";
        let pfpUrls = [];

        collector.on("collect", async (m) => {
            if (step === 1) {
                teamName = m.content.trim();
                if (!teamName || teamName.length < 2 || teamName.length > 32) {
                    return thread.send({ content: `${crossEmoji} **Team name must be between 2 and 32 characters.** Please enter it again.` });
                }

                if (isDuo) {
                    step = 2;
                    await thread.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${arrowEmoji} **Step 2:** Tag/mention your **Teammate** (or enter their User ID).`
                                    )
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                } else {
                    step = 3;
                    await thread.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${arrowEmoji} **Step 2:** Please **drop or attach the profile picture (PFP)** you want to use for voting, or send a direct image URL.`
                                    )
                                )
                        ],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            } else if (step === 2) {
                const input = m.content.trim();
                let targetId = m.mentions.users.first()?.id;
                if (!targetId) {
                    const match = input.match(/^<@!?(\d+)>$/) || input.match(/^(\d+)$/);
                    if (match) targetId = match[1];
                }

                if (!targetId) {
                    return thread.send({ content: `${crossEmoji} **Invalid user.** Please tag your teammate or send their ID.` });
                }

                if (targetId === interaction.user.id) {
                    return thread.send({ content: `${crossEmoji} **You cannot add yourself as a teammate.** Please tag someone else.` });
                }

                const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                if (!member) {
                    return thread.send({ content: `${crossEmoji} **That user is not in this server.**` });
                }

                if (member.user.bot) {
                    return thread.send({ content: `${crossEmoji} **Bots cannot participate in this event.**` });
                }

                const participants = client.lmdbGet(`participants_${interaction.guildId}`) || [];
                if (participants.includes(targetId)) {
                    return thread.send({ content: `${crossEmoji} **That user is already registered for this event!**` });
                }

                teammateUser = member.user;
                await thread.members.add(teammateUser.id).catch(() => {});

                step = 3;
                await thread.send({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x26272F)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `${arrowEmoji} **Step 3:** Please **drop or attach the team's profile picture (PFP)** you want to use for voting, or send a direct image URL.`
                                )
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });
            } else if (step === 3) {
                // Collect all attachments in the message
                const attachments = [...m.attachments.values()];
                const urls = attachments.map(a => a.url);

                // Collect any URLs from the message text
                const text = m.content.trim();
                const textUrls = text.split(/\s+/).filter(w => w.startsWith("http"));
                
                const currentUrls = [...urls, ...textUrls];

                if (isDuo) {
                    if (pfpUrls.length === 0) {
                        // First input message
                        if (currentUrls.length === 0) {
                            return thread.send({ content: `${crossEmoji} **Please drop/attach a valid image file or paste a direct image URL.**` });
                        }
                        
                        pfpUrls.push(...currentUrls);

                        if (pfpUrls.length === 1) {
                            // Only 1 image so far, ask for the second one
                            await thread.send({
                                content: `ℹ️ **First image received!** Please upload/send the **second image** for your teammate, or type \`skip\` to proceed with only this single image.`
                            });
                            return; // Wait for the next message in step 3
                        }
                    } else {
                        // Second input message (pfpUrls already has 1 image)
                        if (text.toLowerCase() === "skip") {
                            // User wants to proceed with just 1 image
                            pfpUrl = pfpUrls[0];
                            collector.stop("completed");
                            return;
                        }

                        if (currentUrls.length === 0) {
                            return thread.send({ content: `${crossEmoji} **Please upload/send the second image, or type \`skip\` to proceed with just the first one.**` });
                        }

                        pfpUrls.push(...currentUrls);
                    }
                    
                    pfpUrl = pfpUrls[0];
                    collector.stop("completed");
                } else {
                    // Single Mode: proceed immediately on first valid image(s)
                    if (currentUrls.length === 0) {
                        return thread.send({ content: `${crossEmoji} **Please drop/attach a valid image file or paste a direct image URL.**` });
                    }
                    pfpUrls = currentUrls;
                    pfpUrl = pfpUrls[0];
                    collector.stop("completed");
                }
            }
        });

        collector.on("end", async (collected, reason) => {
            if (reason !== "completed") {
                await thread.send({ content: "⏳ **Registration timed out.** This thread will be deleted." }).catch(() => {});
                setTimeout(() => thread.delete().catch(() => {}), 5000);
                return;
            }

            const loadingMsg = await thread.send({ content: "⚙️ **Downloading PFP, applying glowing border and shining stars effects...**" });

            try {
                const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
                
                let processedBuffer;
                try {
                    if (isDuo && pfpUrls.length >= 2) {
                        // Download both images
                        const [res1, res2] = await Promise.all([
                            fetch(pfpUrls[0], {
                                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
                            }),
                            fetch(pfpUrls[1], {
                                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
                            })
                        ]);
                        if (!res1.ok || !res2.ok) throw new Error("Failed to download teammate PFPs");
                        
                        const [buf1, buf2] = await Promise.all([
                            res1.buffer(),
                            res2.buffer()
                        ]);

                        const { applyDuoPfpEffects } = require("../utils/imageEffects");
                        processedBuffer = await applyDuoPfpEffects(buf1, buf2);
                    } else {
                        // Single image processing (or only 1 URL provided for Duo)
                        const res = await fetch(pfpUrl, {
                            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
                        });
                        if (!res.ok) throw new Error("PFP download failed");
                        const buffer = await res.buffer();
                        
                        const { applyPfpEffects } = require("../utils/imageEffects");
                        processedBuffer = await applyPfpEffects(buffer, isDuo);
                    }
                } catch (err) {
                    console.error("Failed to apply image effects, using original/first PFP:", err);
                    // Fallback to first image buffer
                    const res = await fetch(pfpUrl, {
                        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
                    });
                    processedBuffer = await res.buffer();
                }

                const fs = require("fs");
                const path = require("path");
                const pfpsDir = path.join(__dirname, "..", "database", "pfps");
                if (!fs.existsSync(pfpsDir)) {
                    fs.mkdirSync(pfpsDir, { recursive: true });
                }
                const filename = `${interaction.guildId}_${interaction.user.id}_${Date.now()}.png`;
                const localPath = path.join(pfpsDir, filename);
                fs.writeFileSync(localPath, processedBuffer);

                const logsId = client.lmdbGet(`registration_logs_channel_${interaction.guildId}`);
                const logsChan = client.channels.cache.get(logsId) || 
                                 await client.channels.fetch(logsId).catch(() => null);

                let finalPfpUrl = pfpUrl;
                if (logsChan) {
                    const logMsg = await logsChan.send({
                        content: `📁 **PFP Backup** for Team \`${teamName}\``,
                        files: [{ attachment: processedBuffer, name: "pfp_event.png" }]
                    }).catch(() => null);
                    if (logMsg) {
                        finalPfpUrl = logMsg.attachments.first()?.url;
                    }
                }

                const participantData = {
                    userId: interaction.user.id,
                    username: interaction.user.tag,
                    isDuo: isDuo,
                    teammateId: teammateUser ? teammateUser.id : null,
                    teammateTag: teammateUser ? teammateUser.tag : null,
                    teamName: teamName,
                    pfpUrl: finalPfpUrl,
                    pfpLocalPath: localPath,
                    registeredAt: Date.now()
                };

                client.lmdbSet(`participant_${guildId}_${interaction.user.id}`, participantData);
                const participants = client.lmdbGet(`participants_${guildId}`) || [];
                participants.push(interaction.user.id);

                if (isDuo && teammateUser) {
                    participants.push(teammateUser.id);
                    client.lmdbSet(`participant_${guildId}_${teammateUser.id}`, participantData);
                }
                client.lmdbSet(`participants_${guildId}`, participants);

                await loadingMsg.delete().catch(() => {});
                await thread.send({
                    components: [
                        new ContainerBuilder()
                            .setAccentColor(0x00FF00)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## ${tickEmoji} Registration Successful!`),
                                new TextDisplayBuilder().setContent(
                                    `**Team Name:** \`${teamName}\`\n` +
                                    `**Type:** \`${isDuo ? "Duo" : "Single"}\`\n` +
                                    (isDuo ? `**Teammate:** ${teammateUser}\n` : "") +
                                    `\nYour team is registered! This thread will close in 5 seconds.`
                                )
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2
                });

                if (logsChan) {
                    const { SectionBuilder, ThumbnailBuilder } = require("discord.js");
                    logsChan.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addSectionComponents(
                                    new SectionBuilder()
                                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📝 Registration Successful`))
                                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(interaction.user.displayAvatarURL({ size: 256 })))
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `> **Team Name:** **${teamName}**\n` +
                                        `> **Registrant:** ${interaction.user} (\`${interaction.user.tag}\` / \`${interaction.user.id}\`)\n` +
                                        (isDuo ? `> **Teammate:** ${teammateUser} (\`${teammateUser.tag}\` / \`${teammateUser.id}\`)\n` : "") +
                                        `> **Type:** \`${isDuo ? "Duo" : "Single"}\`\n` +
                                        `> **Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                                    )
                                )
                        ],
                        files: [{ attachment: processedBuffer, name: "registered_pfp.png" }],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }

                setTimeout(() => thread.delete().catch(() => {}), 5000);
            } catch (err) {
                console.error("Error inside wizard completion:", err);
                await loadingMsg.delete().catch(() => {});
                await thread.send({ content: `${crossEmoji} **Failed to complete registration:** ${err.message}. Thread will close.` }).catch(() => {});
                setTimeout(() => thread.delete().catch(() => {}), 10000);
            }
        });
    } catch (err) {
        console.error("Failed to execute registration wizard:", err);
        thread.send({ content: `${crossEmoji} **Wizard Error:** ${err.message}` }).catch(() => {});
        setTimeout(() => thread.delete().catch(() => {}), 10000);
    }
}
