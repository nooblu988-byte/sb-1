const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

const sendLog = async (client, guildId, group, title, details) => {
    if (client.lmdbGet(`logging_${guildId}`) !== "enabled") return;
    const cfg       = client.lmdbGet(`logging_cfg_${guildId}`) || {};
    const channelId = cfg[group];
    if (!channelId) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    await channel.send({
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

const ts = () => `<t:${Math.floor(Date.now() / 1000)}:T>`;

module.exports = (client) => {
    
    client.on("voiceStateUpdate", async (oldState, newState) => {
        const guildId = newState.guild.id;
        
        const user = newState.member?.user ?? oldState.member?.user;
        if (!user) return;

        const tag   = `${user.tag} (\`${user.id}\`)`;
        const oldCh = oldState.channel;
        const newCh = newState.channel;

        let title, details;

        if (!oldCh && newCh) {
            title   = "Voice Join";
            details = `**User:** ${tag}\n**Channel:** ${newCh.name}\n**Time:** ${ts()}`;
        } else if (oldCh && !newCh) {
            title   = "Voice Leave";
            details = `**User:** ${tag}\n**Channel:** ${oldCh.name}\n**Time:** ${ts()}`;
        } else if (oldCh && newCh && oldCh.id !== newCh.id) {
            title   = "Voice Move";
            details = `**User:** ${tag}\n**From:** ${oldCh.name}\n**To:** ${newCh.name}\n**Time:** ${ts()}`;
        } else if (oldCh && newCh && oldCh.id === newCh.id) {
            if (!oldState.serverMute && newState.serverMute) {
                title   = "Server Muted";
                details = `**User:** ${tag}\n**Channel:** ${newCh.name}\n**Time:** ${ts()}`;
            } else if (oldState.serverMute && !newState.serverMute) {
                title   = "Server Unmuted";
                details = `**User:** ${tag}\n**Channel:** ${newCh.name}\n**Time:** ${ts()}`;
            } else if (!oldState.serverDeaf && newState.serverDeaf) {
                title   = "Server Deafened";
                details = `**User:** ${tag}\n**Channel:** ${newCh.name}\n**Time:** ${ts()}`;
            } else if (oldState.serverDeaf && !newState.serverDeaf) {
                title   = "Server Undeafened";
                details = `**User:** ${tag}\n**Channel:** ${newCh.name}\n**Time:** ${ts()}`;
            }
        }

        if (title) await sendLog(client, guildId, "vc", title, details);
    });

    
    client.on("messageDelete", async (message) => {
        if (!message.guild) return;
        if (message.partial) return;
        if (message.author?.bot) return;

        const tag     = `${message.author.tag} (\`${message.author.id}\`)`;
        const content = message.content ? message.content.slice(0, 1000) : "*No text content*";

        await sendLog(client, message.guild.id, "messages", "Message Deleted",
            `**User:** ${tag}\n**Channel:** <#${message.channel.id}>\n**Content:** ${content}\n**Time:** ${ts()}`
        );
    });

    client.on("messageUpdate", async (oldMessage, newMessage) => {
        if (!newMessage.guild) return;
        
        if (oldMessage.partial || newMessage.partial) return;
        if (newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const tag    = `${newMessage.author.tag} (\`${newMessage.author.id}\`)`;
        const before = oldMessage.content?.slice(0, 500) || "*Empty*";
        const after  = newMessage.content?.slice(0, 500)  || "*Empty*";

        await sendLog(client, newMessage.guild.id, "messages", "Message Edited",
            `**User:** ${tag}\n**Channel:** <#${newMessage.channel.id}>\n**Before:** ${before}\n**After:** ${after}\n**Time:** ${ts()}`
        );
    });

    client.on("messageDeleteBulk", async (messages, channel) => {
        if (!channel.guild) return;

        await sendLog(client, channel.guild.id, "messages", "Bulk Message Delete",
            `**Channel:** <#${channel.id}>\n**Count:** ${messages.size} messages removed\n**Time:** ${ts()}`
        );
    });

    
    client.on("roleCreate", async (role) => {
        await sendLog(client, role.guild.id, "roles", "Role Created",
            `**Name:** ${role.name}\n**ID:** \`${role.id}\`\n**Time:** ${ts()}`
        );
    });

    client.on("roleDelete", async (role) => {
        await sendLog(client, role.guild.id, "roles", "Role Deleted",
            `**Name:** ${role.name}\n**ID:** \`${role.id}\`\n**Time:** ${ts()}`
        );
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

        await sendLog(client, newRole.guild.id, "roles", "Role Updated",
            `**Role:** ${newRole.name}\n${changes.join("\n")}\n**Time:** ${ts()}`
        );
    });

    
    client.on("channelCreate", async (channel) => {
        if (!channel.guild) return;
        await sendLog(client, channel.guild.id, "channels", "Channel Created",
            `**Name:** ${channel.name}\n**ID:** \`${channel.id}\`\n**Time:** ${ts()}`
        );
    });

    client.on("channelDelete", async (channel) => {
        if (!channel.guild) return;
        await sendLog(client, channel.guild.id, "channels", "Channel Deleted",
            `**Name:** ${channel.name}\n**ID:** \`${channel.id}\`\n**Time:** ${ts()}`
        );
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

        await sendLog(client, newChannel.guild.id, "channels", "Channel Updated",
            `**Channel:** <#${newChannel.id}>\n${changes.join("\n")}\n**Time:** ${ts()}`
        );
    });

    
    client.on("guildMemberAdd", async (member) => {
        if (member.partial || !member.user) return;

        const user    = member.user;
        const created = `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`;

        await sendLog(client, member.guild.id, "members", "Member Joined",
            `**User:** ${user.tag} (\`${user.id}\`)\n**Account Created:** ${created}\n**Time:** ${ts()}`
        );
    });

    client.on("guildMemberRemove", async (member) => {
        if (!member.user) return;

        const user  = member.user;
        const roles = member.partial
            ? "*Unknown*"
            : member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(", ") || "None";

        await sendLog(client, member.guild.id, "members", "Member Left",
            `**User:** ${user.tag} (\`${user.id}\`)\n**Roles:** ${roles}\n**Time:** ${ts()}`
        );
    });

    client.on("guildMemberUpdate", async (oldMember, newMember) => {
        if (!newMember.user) return;
        
        if (oldMember.partial) return;

        const user = newMember.user;
        const tag  = `${user.tag} (\`${user.id}\`)`;

        const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
        const newTimeout = newMember.communicationDisabledUntilTimestamp;

        if (!oldTimeout && newTimeout && newTimeout > Date.now()) {
            return sendLog(client, newMember.guild.id, "members", "Member Timed Out",
                `**User:** ${tag}\n**Expires:** <t:${Math.floor(newTimeout / 1000)}:R>\n**Time:** ${ts()}`
            );
        }

        if (oldTimeout && !newTimeout) {
            return sendLog(client, newMember.guild.id, "members", "Timeout Removed",
                `**User:** ${tag}\n**Time:** ${ts()}`
            );
        }

        const changes = [];

        if (oldMember.nickname !== newMember.nickname)
            changes.push(`**Nickname:** ${oldMember.nickname || "*None*"} → ${newMember.nickname || "*None*"}`);

        const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
        if (addedRoles.size)   changes.push(`**Roles Added:** ${addedRoles.map(r => r.name).join(", ")}`);
        if (removedRoles.size) changes.push(`**Roles Removed:** ${removedRoles.map(r => r.name).join(", ")}`);
        if (!changes.length) return;

        await sendLog(client, newMember.guild.id, "members", "Member Updated",
            `**User:** ${tag}\n${changes.join("\n")}\n**Time:** ${ts()}`
        );
    });

    client.on("guildBanAdd", async (ban) => {
        await sendLog(client, ban.guild.id, "members", "Member Banned",
            `**User:** ${ban.user.tag} (\`${ban.user.id}\`)\n**Reason:** ${ban.reason || "No reason provided"}\n**Time:** ${ts()}`
        );
    });

    client.on("guildBanRemove", async (ban) => {
        await sendLog(client, ban.guild.id, "members", "Member Unbanned",
            `**User:** ${ban.user.tag} (\`${ban.user.id}\`)\n**Time:** ${ts()}`
        );
    });
};
