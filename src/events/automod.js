const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");

const INVITE_REGEX = /discord\.(gg|com\/invite)\/[a-zA-Z0-9-]+/i;
const LINK_REGEX   = /https?:\/\/[^\s]+/i;
const EMOJI_REGEX  = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)/gu;

const ABUSE_WORDS = [
    "nigger", "nigga", "faggot", "fag", "chink", "spic", "kike",
    "tranny", "retard", "cunt",
];

const NSFW_KEYWORDS = [
    "porn", "hentai", "nude", "nudes", "xxx", "onlyfans", "nsfw",
    "blowjob", "handjob", "cumshot", "anal", "creampie",
    "pussy", "boobs", "tits", "titties", "dick", "cock", "penis",
    "vagina", "dildo", "masturbat", "erotic", "milf", "bdsm",
    "fetish", "whore", "slut", "naked", "hardcore", "deepthroat",
    "gangbang", "orgy", "sexting", "naughty", "lewd",
];

const wordMatch = (text, words) =>
    words.some(w => new RegExp(`\\b${w}`, "i").test(text));

const normalizeLeet = (text) => text
    .toLowerCase()
    .replace(/ph/g, "f")
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/(?<=[a-z])[*.\-_](?=[a-z])/g, "");

const spamTracker   = new Map();
const mentionTracker = new Map();

const DEFAULT_CFG = {
    modules: {
        promotion:   { enabled: true,  action: "delete" },
        links:       { enabled: true,  action: "delete" },
        spam:        { enabled: true,  action: "delete" },
        massMention: { enabled: true,  action: "delete" },
        massImages:  { enabled: true,  action: "delete" },
        massForward: { enabled: true,  action: "delete" },
        abuse:       { enabled: true,  action: "delete" },
        nsfw:        { enabled: true,  action: "delete" },
        nsfwImages:  { enabled: true,  action: "delete" },
        caps:        { enabled: false, action: "delete" },
        emojiSpam:   { enabled: false, action: "delete" },
    },
    action: "delete",
    limits: {
        spamCount:       5,
        spamWindow:      5000,
        mentionLimit:    5,
        imageLimit:      5,
        capsPercent:     70,
        emojiLimit:      10,
        timeoutDuration: 300000,
    },
    strikes:   { enabled: false, threshold: 3 },
    dmNotify:  false,
    logChannel: null,
};

const ESCALATION = ["delete", "timeout", "kick", "ban"];

const getConfig = (client, guildId) => {
    const saved = client.lmdbGet(`automod_cfg_${guildId}`);
    if (!saved) return DEFAULT_CFG;
    const cfg = { ...DEFAULT_CFG, ...saved };
    cfg.modules = { ...DEFAULT_CFG.modules, ...(saved.modules || {}) };
    cfg.limits  = { ...DEFAULT_CFG.limits,  ...(saved.limits  || {}) };
    cfg.strikes = { ...DEFAULT_CFG.strikes, ...(saved.strikes || {}) };
    return cfg;
};

module.exports = (client) => {
    client.on("messageCreate", async (message) => {
        if (!message.guild || message.author.bot) return;

        const guildId = message.guild.id;
        const userId  = message.author.id;

        if (client.lmdbGet(`automod_${guildId}`) !== "enabled") return;

        if (client.config.owner.includes(userId)) return;
        if (message.guild.ownerId === userId) return;

        const extra1 = client.lmdbGet(`ownerPermit1_${guildId}`);
        const extra2 = client.lmdbGet(`ownerPermit2_${guildId}`);
        if (extra1 === userId || extra2 === userId) return;

        const userWl = client.lmdbGet(`amwhitelist_${guildId}`) || [];
        if (userWl.includes(userId)) return;

        const channelWl = client.lmdbGet(`amcwl_${guildId}`) || [];
        if (channelWl.includes(message.channel.id)) return;

        const roleWl = client.lmdbGet(`amrwl_${guildId}`) || [];
        if (roleWl.length > 0) {
            const member = message.guild.members.cache.get(userId)
                || await message.guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.some(r => roleWl.includes(r.id))) return;
        }

        const me = message.guild.members.me;

        // Role hierarchy protection: never touch a member (or their messages)
        // whose highest role is above or equal to the bot's highest role.
        const authorMember = message.member || message.guild.members.cache.get(userId);
        if (me && authorMember && authorMember.roles.highest.position >= me.roles.highest.position) return;

        if (!me?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

        const cfg        = getConfig(client, guildId);
        const content    = message.content || "";
        const lower      = content.toLowerCase();
        const normalized = normalizeLeet(content);
        const sep        = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

        const applyAction = async (action, member, title) => {
            if (action === "timeout") {
                if (me.permissions.has(PermissionFlagsBits.ModerateMembers) && member) {
                    await member.timeout(cfg.limits.timeoutDuration, `Automod: ${title}`).catch(() => {});
                }
            } else if (action === "kick") {
                if (me.permissions.has(PermissionFlagsBits.KickMembers) && member) {
                    await member.kick(`Automod: ${title}`).catch(() => {});
                }
            } else if (action === "ban") {
                if (me.permissions.has(PermissionFlagsBits.BanMembers) && member) {
                    await message.guild.members.ban(userId, { reason: `Automod: ${title}` }).catch(() => {});
                }
            }
        };

        const recordHistory = (module, action) => {
            const histKey = `am_history_${guildId}_${userId}`;
            let history   = client.lmdbGet(histKey) || [];
            history.unshift({ module, action, timestamp: Date.now() });
            if (history.length > 20) history = history.slice(0, 20);
            client.lmdbSet(histKey, history);
        };

        const punish = async (moduleKey, title, reason) => {
            const modCfg      = cfg.modules[moduleKey] || {};
            const baseAction  = modCfg.action || cfg.action || "delete";

            let finalAction = baseAction;
            const strikeKey = `am_strikes_${guildId}_${userId}`;

            if (cfg.strikes.enabled) {
                let strikes = (client.lmdbGet(strikeKey) || 0) + 1;
                if (strikes >= cfg.strikes.threshold) {
                    const idx = ESCALATION.indexOf(baseAction);
                    finalAction = ESCALATION[Math.min(idx + 1, ESCALATION.length - 1)];
                    client.lmdbSet(strikeKey, 0);
                } else {
                    client.lmdbSet(strikeKey, strikes);
                }
            }

            recordHistory(moduleKey, finalAction);

            const member = finalAction !== "delete"
                ? (message.member || message.guild.members.cache.get(userId) || await message.guild.members.fetch(userId).catch(() => null))
                : null;

            // ─── STRICT ORDER: PUNISH → DELETE → WARN ───
            // Each step is fully awaited before the next one starts, so
            // the kick/ban/timeout is guaranteed to land before the
            // message is removed, and the message is guaranteed to be
            // removed before the warning gets posted.
            await applyAction(finalAction, member, title);
            await message.delete().catch(() => {});

            const actionNote = {
                timeout: ` You have been timed out for ${cfg.limits.timeoutDuration >= 3600000
                    ? `${cfg.limits.timeoutDuration / 3600000}h`
                    : `${cfg.limits.timeoutDuration / 60000}min`}.`,
                kick:    " You have been kicked from the server.",
                ban:     " You have been permanently banned.",
            }[finalAction] || "";

            const warn = await message.channel.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`**${title}**`)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `<@${userId}> ${reason}${actionNote}\n-# Your message was removed by automod.`
                            )
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
            }).catch(() => null);

            if (warn) {
                setTimeout(() => {
                    warn.delete().catch(err => {
                        console.error("[Automod] warn delete failed:", err?.message || err);
                    });
                }, 4000);
            }

            if (cfg.dmNotify) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    user.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `## Automod Action — ${message.guild.name}`
                                    )
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `**Violation:** ${title}\n**Reason:** ${reason}\n**Action taken:** \`${finalAction}\``
                                    )
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `-# Please follow the server rules to avoid further action.`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }
            }

            if (cfg.logChannel) {
                const logCh = message.guild.channels.cache.get(cfg.logChannel);
                if (logCh) {
                    logCh.send({
                        components: [
                            new ContainerBuilder()
                                .setAccentColor(0x26272F)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent("## Automod Log")
                                )
                                .addSeparatorComponents(sep())
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `**User:** <@${userId}> (\`${userId}\`)\n` +
                                        `**Violation:** ${title}\n` +
                                        `**Channel:** <#${message.channel.id}>\n` +
                                        `**Action:** \`${finalAction}\`\n` +
                                        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
                                    )
                                ),
                        ],
                        flags: MessageFlags.IsComponentsV2,
                        allowedMentions: { parse: [] },
                    }).catch(() => {});
                }
            }
        };

        

        if (cfg.modules.promotion?.enabled && INVITE_REGEX.test(content)) {
            return punish("promotion", "Server Promotions Not Allowed", "Do not advertise other servers here.");
        }

        if (cfg.modules.links?.enabled && LINK_REGEX.test(content)) {
            return punish("links", "Links Not Allowed", "Sending links is not permitted in this server.");
        }

        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        if (cfg.modules.massMention?.enabled) {
            if (mentionCount >= cfg.limits.mentionLimit) {
                return punish("massMention", "Mass Mention Detected", "You cannot mention that many users at once.");
            }
            if (mentionCount > 0) {
                const mKey  = `${guildId}-${userId}-m`;
                const now   = Date.now();
                let   mtimes = mentionTracker.get(mKey) || [];
                mtimes = mtimes.filter(t => now - t < 10000);
                for (let i = 0; i < mentionCount; i++) mtimes.push(now);
                mentionTracker.set(mKey, mtimes);
                if (mtimes.length >= cfg.limits.mentionLimit) {
                    mentionTracker.set(mKey, []);
                    return punish("massMention", "Mass Mention Detected", "You are mentioning too many users across messages.");
                }
            }
        }

        if (cfg.modules.massImages?.enabled && message.attachments.size >= cfg.limits.imageLimit) {
            return punish("massImages", "Mass Images Detected", "You cannot send that many attachments at once.");
        }

        if (cfg.modules.nsfwImages?.enabled && message.attachments.size > 0) {
            const EXPLICIT_FLAG = 1 << 4;
            const hasExplicit = [...message.attachments.values()].some(
                a => (a.flags?.bitfield & EXPLICIT_FLAG) !== 0
            );
            if (hasExplicit) {
                return punish("nsfwImages", "NSFW Media Detected", "Explicit image or video content is not allowed in this server.");
            }
        }

        const isForward =
            (message.flags?.bitfield & (1 << 14)) !== 0 ||
            (message.messageSnapshots && message.messageSnapshots.size > 0);

        if (cfg.modules.massForward?.enabled && isForward) {
            return punish("massForward", "Mass Forwards Not Allowed", "Forwarding messages is not permitted here.");
        }

        if (cfg.modules.spam?.enabled) {
            const trackerKey = `${guildId}-${userId}`;
            const now        = Date.now();
            let   times      = spamTracker.get(trackerKey) || [];
            times = times.filter(t => now - t < cfg.limits.spamWindow);
            times.push(now);
            spamTracker.set(trackerKey, times);
            if (times.length >= cfg.limits.spamCount) {
                spamTracker.set(trackerKey, []);
                return punish("spam", "Spam Detected", "You are sending messages too fast. Please slow down.");
            }
        }

        if (cfg.modules.abuse?.enabled && (wordMatch(lower, ABUSE_WORDS) || wordMatch(normalized, ABUSE_WORDS))) {
            return punish("abuse", "Abusive Language Detected", "Abusive or slur language is not tolerated here.");
        }

        if (cfg.modules.nsfw?.enabled && (wordMatch(lower, NSFW_KEYWORDS) || wordMatch(normalized, NSFW_KEYWORDS))) {
            return punish("nsfw", "NSFW Content Detected", "NSFW content is not allowed in this server.");
        }

        if (cfg.modules.caps?.enabled && content.length >= 8) {
            const letters = content.replace(/[^a-zA-Z]/g, "");
            if (letters.length >= 6) {
                const upperCount = letters.split("").filter(c => c === c.toUpperCase()).length;
                const capsPercent = (upperCount / letters.length) * 100;
                if (capsPercent >= cfg.limits.capsPercent) {
                    return punish("caps", "Excessive Caps Detected", "Please avoid typing in ALL CAPS.");
                }
            }
        }

        if (cfg.modules.emojiSpam?.enabled) {
            const emojiCount = (content.match(EMOJI_REGEX) || []).length;
            if (emojiCount >= cfg.limits.emojiLimit) {
                return punish("emojiSpam", "Emoji Spam Detected", "Please avoid sending excessive emojis.");
            }
        }

        const customFilter = client.lmdbGet(`amfilter_${guildId}`) || [];
        if (customFilter.length > 0 && customFilter.some(w => lower.includes(w))) {
            return punish("customFilter", "Filtered Word Detected", "Your message contains a prohibited word.");
        }
    });
};
