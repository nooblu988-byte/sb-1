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

            let content;
            if (result.type === "vanity") {
                content = `${member.user.tag} joined using a vanity invite.`;
            } else if (result.type === "invite" && result.inviterId) {
                content = `${member.user.tag} joined, invited by <@${result.inviterId}>.`;
            } else {
                content = `${member.user.tag} joined. I can not figure out how they joined.`;
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

            let content;
            if (!info || info.type === "unknown") {
                content = `${member.user.tag} left the server. I can not figure out how they joined.`;
            } else if (info.type === "vanity") {
                content = `${member.user.tag} left the server. They joined using the vanity invite.`;
            } else if (info.type === "invite" && info.inviterId) {
                content = `${member.user.tag} left the server, they were invited by <@${info.inviterId}>.`;
            } else {
                content = `${member.user.tag} left the server. I can not figure out how they joined.`;
            }

            clearJoinInfo(client, guild.id, member.id);

            const channel = guild.channels.cache.get(cfg.leaveChannelId);
            if (channel) channel.send({ content }).catch(() => {});
        } catch (err) {
            console.error("[Invite Tracking] guildMemberRemove error:", err);
        }
    });
};
