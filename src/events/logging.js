const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);
const ts   = () => `<t:${Math.floor(Date.now() / 1000)}:T>`;

// Big Wick-style log card: bold title (+ optional pfp thumbnail on the
// right), then a set of bold-labelled fields, then a small timestamp footer.
const sendLog = async (client, guildId, group, { title, fields = [], thumbnail, color = 0x2B2D31 } = {}) => {
    if (client.lmdbGet(`logging_${guildId}`) !== "enabled") return;
    const cfg       = client.lmdbGet(`logging_cfg_${guildId}`) || {};
    const channelId = cfg[group];
    if (!channelId) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const headerText = new TextDisplayBuilder().setContent(`## ${title}`);
    const container   = new ContainerBuilder().setAccentColor(color);

    if (thumbnail) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(headerText)
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
        );
    } else {
        container.addTextDisplayComponents(headerText);
    }

    container.addSeparatorComponents(sep());

    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${f.label}**\n${f.value}`)
        );
        if (i < fields.length - 1) container.addSeparatorComponents(thin());
    }

    container
        .addSeparatorComponents(sep())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${ts()}`));

    await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    }).catch(() => {});
};

module.exports = (client) => {

    // ─── VOICE ───
    client.on("voiceStateUpdate", async (oldState, newState) => {
        const guildId = newState.guild.id;

        const member = newState.member ?? oldState.member;
        const user   = member?.user;
        if (!user) return;

        const target = `<@${user.id}> (\`${user.id}\`)`;
        const avatar = user.displayAvatarURL({ size: 256 });
        const oldCh  = oldState.channel;
        const newCh  = newState.channel;

        let title, fields;

        if (!oldCh && newCh) {
            title  = "Voice Join";
            fields = [
                { label: "Target",  value: target },
                { label: "Channel", value: `${newCh}` },
            ];
        } else if (oldCh && !newCh) {
            title  = "Voice Leave";
            fields = [
                { label: "Target",  value: target },
                { label: "Channel", value: `${oldCh}` },
            ];
        } else if (oldCh && newCh && oldCh.id !== newCh.id) {
            title  = "Voice Switched";
            fields = [
                { label: "Target",  value: target },
                { label: "Changes", value: `• From : ${oldCh}\n• To : ${newCh}` },
            ];
        } else if (oldCh && newCh && oldCh.id === newCh.id) {
            if (!oldState.serverMute && newState.serverMute) {
                title  = "Server Muted";
                fields = [{ label: "Target", value: target }, { label: "Channel", value: `${newCh}` }];
            } else if (oldState.serverMute && !newState.serverMute) {
                title  = "Server Unmuted";
                fields = [{ label: "Target", value: target }, { label: "Channel", value: `${newCh}` }];
            } else if (!oldState.serverDeaf && newState.serverDeaf) {
                title  = "Server Deafened";
                fields = [{ label: "Target", value: target }, { label: "Channel", value: `${newCh}` }];
            } else if (oldState.serverDeaf && !newState.serverDeaf) {
                title  = "Server Undeafened";
                fields = [{ label: "Target", value: target }, { label: "Channel", value: `${newCh}` }];
            }
        }

        if (title) await sendLog(client, guildId, "vc", { title, fields, thumbnail: avatar, color: 0xFEE75C });
    });

    // ─── MESSAGES ───
    client.on("messageDelete", async (message) => {
        if (!message.guild || message.partial || message.author?.bot) return;

        const content = message.content ? message.content.slice(0, 1000) : "*No text content*";

        await sendLog(client, message.guild.id, "messages", {
            title: "Message Deleted",
            thumbnail: message.author.displayAvatarURL({ size: 256 }),
            color: 0xED4245,
            fields: [
                { label: "Author",  value: `<@${message.author.id}> (\`${message.author.id}\`)` },
                { label: "Channel", value: `${message.channel}` },
                { label: "Content", value: content },
            ],
        });
    });

    client.on("messageUpdate", async (oldMessage, newMessage) => {
        if (!newMessage.guild) return;
        if (oldMessage.partial || newMessage.partial) return;
        if (newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const before = oldMessage.content?.slice(0, 500) || "*Empty*";
        const after  = newMessage.content?.slice(0, 500)  || "*Empty*";

        await sendLog(client, newMessage.guild.id, "messages", {
            title: "Message Edited",
            thumbnail: newMessage.author.displayAvatarURL({ size: 256 }),
            color: 0xFEE75C,
            fields: [
                { label: "Author",  value: `<@${newMessage.author.id}> (\`${newMessage.author.id}\`)` },
                { label: "Channel", value: `${newMessage.channel}` },
                { label: "Before",  value: before },
                { label: "After",   value: after },
            ],
        });
    });

    client.on("messageDeleteBulk", async (messages, channel) => {
        if (!channel.guild) return;

        await sendLog(client, channel.guild.id, "messages", {
            title: "Messages Purged",
            color: 0xED4245,
            fields: [
                { label: "Channel", value: `${channel}` },
                { label: "Action",  value: `Deleted ${messages.size} messages in ${channel}` },
            ],
        });
    });

    // ─── ROLES ───
    client.on("roleCreate", async (role) => {
        await sendLog(client, role.guild.id, "roles", {
            title: "Role Created",
            color: 0x57F287,
            fields: [{ label: "Role", value: `${role} (\`${role.id}\`)` }],
        });
    });

    client.on("roleDelete", async (role) => {
        await sendLog(client, role.guild.id, "roles", {
            title: "Role Deleted",
            color: 0xED4245,
            fields: [{ label: "Role", value: `**${role.name}** (\`${role.id}\`)` }],
        });
    });

    client.on("roleUpdate", async (oldRole, newRole) => {
        const changes = [];
        if (oldRole.name !== newRole.name)
            changes.push(`**Name:** ${oldRole.name} → ${newRole.name}`);
        if (oldRole.color !== newRole.color)
            changes.push(`**Color:** \`#${oldRole.color.toString(16).padStart(6, "0")}\` → \`#${newRole.color.toString(16).padStart(6, "0")}\``);
        if (oldRole.hoist !== newRole.hoist)
            changes.push(`**Hoisted:** ${oldRole.hoist} → ${newRole.hoist}`);
        if (oldRole.mentionable !== newRole.mentionable)
            changes.push(`**Mentionable:** ${oldRole.mentionable} → ${newRole.mentionable}`);
        if (!changes.length) return;

        await sendLog(client, newRole.guild.id, "roles", {
            title: "Role Updated",
            color: 0xFEE75C,
            fields: [
                { label: "Role",    value: `${newRole}` },
                { label: "Changes", value: changes.join("\n") },
            ],
        });
    });

    // ─── CHANNELS ───
    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;
        await sendLog(client, channel.guild.id, "channels", {
            title: "Channel Created",
            color: 0x57F287,
            fields: [{ label: "Channel", value: `${channel} (\`${channel.id}\`)` }],
        });
    });

    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        await sendLog(client, channel.guild.id, "channels", {
            title: "Channel Deleted",
            color: 0xED4245,
            fields: [{ label: "Channel", value: `**${channel.name}** (\`${channel.id}\`)` }],
        });
    });

    client.on("channelUpdate", async (oldChannel, newChannel) => {
        if (!newChannel.guild) return;

        const changes = [];
        if (oldChannel.name !== newChannel.name)
            changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
        if ("topic" in newChannel && oldChannel.topic !== newChannel.topic)
            changes.push(`**Topic:** ${oldChannel.topic || "*None*"} → ${newChannel.topic || "*None*"}`);
        if ("nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw)
            changes.push(`**NSFW:** ${oldChannel.nsfw} → ${newChannel.nsfw}`);
        if (!changes.length) return;

        await sendLog(client, newChannel.guild.id, "channels", {
            title: "Channel Updated",
            color: 0xFEE75C,
            fields: [
                { label: "Channel", value: `${newChannel}` },
                { label: "Changes", value: changes.join("\n") },
            ],
        });
    });

    // ─── MEMBERS ───
    client.on("guildMemberAdd", async (member) => {
        if (member.partial || !member.user) return;

        const user    = member.user;
        const created = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;

        await sendLog(client, member.guild.id, "members", {
            title: "Member Joined",
            thumbnail: user.displayAvatarURL({ size: 256 }),
            color: 0x57F287,
            fields: [
                { label: "User",            value: `<@${user.id}> (\`${user.id}\`)` },
                { label: "Account Created", value: created },
            ],
        });
    });

    client.on("guildMemberRemove", async (member) => {
        if (!member.user) return;

        const user  = member.user;
        const roles = member.partial
            ? "*Unknown*"
            : member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(", ") || "None";

        await sendLog(client, member.guild.id, "members", {
            title: "Member Left",
            thumbnail: user.displayAvatarURL({ size: 256 }),
            color: 0xED4245,
            fields: [
                { label: "User",  value: `${user.tag} (\`${user.id}\`)` },
                { label: "Roles", value: roles },
            ],
        });
    });

    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        if (!newMember.user) return;
        if (oldMember.partial) return;

        const user   = newMember.user;
        const target = `<@${user.id}> (\`${user.id}\`)`;

        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (!oldTimeout && newTimeout && newTimeout > Date.now()) {
            return sendLog(client, newMember.guild.id, "members", {
                title: "Member Timed Out",
                thumbnail: user.displayAvatarURL({ size: 256 }),
                color: 0xED4245,
                fields: [
                    { label: "Target",  value: target },
                    { label: "Expires", value: `<t:${Math.floor(newTimeout / 1000)}:R>` },
                ],
            });
        }

        if (oldTimeout && !newTimeout) {
            return sendLog(client, newMember.guild.id, "members", {
                title: "Timeout Removed",
                thumbnail: user.displayAvatarURL({ size: 256 }),
                color: 0x57F287,
                fields: [{ label: "Target", value: target }],
            });
        }

        const changes = [];

        if (oldMember.nickname !== newMember.nickname)
            changes.push(`**Nickname:** ${oldMember.nickname || "*None*"} → ${newMember.nickname || "*None*"}`);

        const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
        if (addedRoles.size)   changes.push(`**Roles Added:** ${addedRoles.map(r => r.name).join(", ")}`);
        if (removedRoles.size) changes.push(`**Roles Removed:** ${removedRoles.map(r => r.name).join(", ")}`);
        if (!changes.length) return;

        await sendLog(client, newMember.guild.id, "members", {
            title: "Member Updated",
            thumbnail: user.displayAvatarURL({ size: 256 }),
            color: 0xFEE75C,
            fields: [
                { label: "Target",  value: target },
                { label: "Changes", value: changes.join("\n") },
            ],
        });
    });

    client.on("guildBanAdd", async (ban) => {
        await sendLog(client, ban.guild.id, "members", {
            title: "Member Banned",
            thumbnail: ban.user.displayAvatarURL({ size: 256 }),
            color: 0xED4245,
            fields: [
                { label: "User",   value: `${ban.user.tag} (\`${ban.user.id}\`)` },
                { label: "Reason", value: ban.reason || "No reason provided" },
            ],
        });
    });

    client.on("guildBanRemove", async (ban) => {
        await sendLog(client, ban.guild.id, "members", {
            title: "Member Unbanned",
            thumbnail: ban.user.displayAvatarURL({ size: 256 }),
            color: 0x57F287,
            fields: [{ label: "User", value: `${ban.user.tag} (\`${ban.user.id}\`)` }],
        });
    });
};
