const {
    getConfig,
    getJoinInfo,
    saveJoinInfo,
    clearJoinInfo,
    primeGuildCache,
    resolveJoin,
    bumpCacheOnInviteCreate,
    dropCacheOnInviteDelete,
} = require("../utils/inviteTracking");

// The account's main profile display name (what shows on their profile),
// not the unique @username handle — falls back to username if unset.
const profileName = (user) => user.globalName || user.username;

module.exports = (client) => {
    client.once("clientReady", async () => {
        for (const [, guild] of client.guilds.cache) {
            await primeGuildCache(client, guild).catch(() => {});
        }
    });

    client.on("guildCreate", (guild) => {
        primeGuildCache(client, guild).catch(() => {});
    });

    client.on("inviteCreate", (invite) => {
        if (invite.guild) bumpCacheOnInviteCreate(client, invite.guild, invite);
    });

    client.on("inviteDelete", (invite) => {
        if (invite.guild) dropCacheOnInviteDelete(client, invite.guild, invite);
    });

    client.on("guildMemberAdd", async (member) => {
        try {
            const guild = member.guild;
            const cfg = getConfig(client, guild.id);
            if (!cfg) return;

            const result = await resolveJoin(client, guild);
            const name = profileName(member.user);

            let content;
            if (result.type === "vanity") {
                content = `${name} joined using a vanity invite.`;
            } else if (result.type === "invite" && result.inviterId) {
                content = `${name} joined, invited by <@${result.inviterId}>.`;
            } else {
                content = `${name} joined. I can not figure out how they joined.`;
            }

            saveJoinInfo(client, guild.id, member.id, result);

            const channel = guild.channels.cache.get(cfg.joinChannelId);
            if (channel) channel.send({ content }).catch(() => {});
        } catch (err) {
            console.error("[Invite Tracking] guildMemberAdd error:", err);
        }
    });

    client.on("guildMemberRemove", async (member) => {
        try {
            const guild = member.guild;
            const cfg = getConfig(client, guild.id);
            if (!cfg) return;

            const info = getJoinInfo(client, guild.id, member.id);
            const name = profileName(member.user);

            let content;
            if (!info || info.type === "unknown") {
                content = `${name} left the server. I can not figure out how they joined.`;
            } else if (info.type === "vanity") {
                content = `${name} left the server. They joined using the vanity invite.`;
            } else if (info.type === "invite" && info.inviterId) {
                content = `${name} left the server, they were invited by <@${info.inviterId}>.`;
            } else {
                content = `${name} left the server. I can not figure out how they joined.`;
            }

            clearJoinInfo(client, guild.id, member.id);

            const channel = guild.channels.cache.get(cfg.leaveChannelId);
            if (channel) channel.send({ content }).catch(() => {});
        } catch (err) {
            console.error("[Invite Tracking] guildMemberRemove error:", err);
        }
    });
};
