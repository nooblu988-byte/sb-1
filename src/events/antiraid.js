const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    PermissionFlagsBits,
} = require("discord.js");

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

const DEFAULT_CFG = {
    action:  "kick",
    modules: {
        massJoin:   { enabled: true,  threshold: 10, window: 5 },
        accountAge: { enabled: false, days: 7                  },
        botFilter:  { enabled: true                            },
    },
    alertChannel: null,
};

const getConfig = (client, guildId) => {
    const s = client.lmdbGet(`antiraid_cfg_${guildId}`) || {};
    return {
        action: s.action || DEFAULT_CFG.action,
        modules: {
            massJoin: {
                enabled:   s.modules?.massJoin?.enabled   ?? DEFAULT_CFG.modules.massJoin.enabled,
                threshold: s.modules?.massJoin?.threshold ?? DEFAULT_CFG.modules.massJoin.threshold,
                window:    s.modules?.massJoin?.window    ?? DEFAULT_CFG.modules.massJoin.window,
            },
            accountAge: {
                enabled: s.modules?.accountAge?.enabled ?? DEFAULT_CFG.modules.accountAge.enabled,
                days:    s.modules?.accountAge?.days    ?? DEFAULT_CFG.modules.accountAge.days,
            },
            botFilter: {
                enabled: s.modules?.botFilter?.enabled ?? DEFAULT_CFG.modules.botFilter.enabled,
            },
        },
        alertChannel: s.alertChannel || null,
    };
};


const joinTracker = new Map();

module.exports = (client) => {
    client.on("guildMemberAdd", async (member) => {
        if (!member.user) return;
        const guildId = member.guild.id;
        if (client.lmdbGet(`antiraid_${guildId}`) !== "enabled") return;

        
        const me = member.guild.members.me;
        if (!me) return;

        const cfg = getConfig(client, guildId);

        
        if (member.id === member.guild.ownerId) return;
        const whitelist = client.lmdbGet(`whitelist_${guildId}`) || [];
        const extra1    = client.lmdbGet(`ownerPermit1_${guildId}`);
        const extra2    = client.lmdbGet(`ownerPermit2_${guildId}`);
        if (whitelist.includes(member.id)) return;
        if (extra1 === member.id || extra2 === member.id) return;

        const canKick = me.permissions.has(PermissionFlagsBits.KickMembers);
        const canBan  = me.permissions.has(PermissionFlagsBits.BanMembers);
        if (cfg.action === "ban" && !canBan) return;
        if (cfg.action === "kick" && !canKick) return;

        const executeAction = async (userId, reason) => {
            if (cfg.action === "ban") {
                await member.guild.members.ban(userId, { reason }).catch(() => {});
            } else {
                const m = member.guild.members.cache.get(userId)
                    || await member.guild.members.fetch(userId).catch(() => null);
                if (m) await m.kick(reason).catch(() => {});
            }
        };

        const sendAlert = async (title, details) => {
            if (!cfg.alertChannel) return;
            const ch = member.guild.channels.cache.get(cfg.alertChannel);
            if (!ch) return;
            await ch.send({
                components: [
                    new ContainerBuilder()
                        .setAccentColor(0x26272F)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`**${title}**`)
                        )
                        .addSeparatorComponents(sep())
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(details)
                        ),
                ],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            }).catch(() => {});
        };

        const ts = `<t:${Math.floor(Date.now() / 1000)}:T>`;
        const actionLabel = cfg.action === "ban" ? "Banned" : "Kicked";

        
        if (cfg.modules.botFilter.enabled && member.user.bot) {
            await executeAction(member.id, "AntiRaid: Unauthorized bot");
            await sendAlert("Bot Blocked",
                `**Bot:** ${member.user.tag} (\`${member.id}\`)\n` +
                `**Action:** ${actionLabel}\n` +
                `**Reason:** Unauthorized bot join\n` +
                `**Time:** ${ts}`
            );
            return;
        }

        
        if (cfg.modules.accountAge.enabled) {
            const ageMs      = cfg.modules.accountAge.days * 86_400_000;
            const accountAge = Date.now() - member.user.createdTimestamp;
            if (accountAge < ageMs) {
                const ageDays = Math.floor(accountAge / 86_400_000);
                await executeAction(member.id,
                    `AntiRaid: Account age ${ageDays}d < required ${cfg.modules.accountAge.days}d`
                );
                await sendAlert("New Account Blocked",
                    `**User:** ${member.user.tag} (\`${member.id}\`)\n` +
                    `**Account Age:** ${ageDays} day${ageDays !== 1 ? "s" : ""}\n` +
                    `**Required:** ${cfg.modules.accountAge.days}+ days\n` +
                    `**Action:** ${actionLabel}\n` +
                    `**Time:** ${ts}`
                );
                return;
            }
        }

        
        if (cfg.modules.massJoin.enabled) {
            const now      = Date.now();
            const windowMs = cfg.modules.massJoin.window * 1000;
            const thresh   = cfg.modules.massJoin.threshold;

            let joins = joinTracker.get(guildId) || [];
            joins = joins.filter(j => now - j.at < windowMs);
            joins.push({ id: member.id, at: now });
            joinTracker.set(guildId, joins);

            if (joins.length >= thresh) {
                const raiders = [...joins];
                joinTracker.set(guildId, []);

                await sendAlert("Raid Detected",
                    `**${raiders.length} users** joined within ${cfg.modules.massJoin.window}s\n` +
                    `**Threshold:** ${thresh} joins / ${cfg.modules.massJoin.window}s\n` +
                    `**Action:** ${actionLabel} all recent joiners\n` +
                    `**Time:** ${ts}`
                );

                for (const { id } of raiders) {
                    await executeAction(id, "AntiRaid: Mass join raid detected");
                }
            }
        }
    });
};
