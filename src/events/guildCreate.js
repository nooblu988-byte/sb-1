const { ChannelType, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");

module.exports = (client) => {
  client.on("guildCreate", async (guild) => {
    try {
      const logConfig = client.lmdbGet("global_botlogs_config");
      if (!logConfig || !logConfig.guildsChannelId) return;

      const logChannel = client.channels.cache.get(logConfig.guildsChannelId) || 
                         await client.channels.fetch(logConfig.guildsChannelId).catch(() => null);
      if (!logChannel) return;

      // Try to create/get an invite link
      let inviteUrl = "No permissions to create invite";
      const inviteChannel = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildText && 
        c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite)
      );
      if (inviteChannel) {
        try {
          const invite = await inviteChannel.createInvite({ maxAge: 0, maxUses: 0, reason: "Global bot logs" });
          inviteUrl = invite.url;
        } catch (e) {}
      }

      // Try to get who added the bot
      let inviterStr = "Unknown (Audit log missing/inaccessible)";
      if (guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        try {
          const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: 28 }); // BOT_ADD is 28
          const entry = auditLogs.entries.first();
          if (entry && entry.target.id === client.user.id) {
            inviterStr = `${entry.executor.tag} (\`${entry.executor.id}\`)`;
          }
        } catch (e) {}
      }

      const owner = await guild.fetchOwner().catch(() => null);
      const ownerStr = owner ? `${owner.user.tag} (\`${owner.id}\`)` : `\`${guild.ownerId}\``;

      const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

      const iconUrl = guild.iconURL({ size: 256 }) || (owner ? owner.user.displayAvatarURL({ size: 256 }) : client.user.displayAvatarURL({ size: 256 }));

      await logChannel.send({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287) // Green for Join
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📥 Joined New Server`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `### 📥 Server Information\n` +
                `> **Name:** **${guild.name}**\n` +
                `> **ID:** \`${guild.id}\`\n` +
                `> **Member Count:** \`${guild.memberCount}\` members\n\n` +
                `### 👑 Owner & Inviter\n` +
                `> **Server Owner:** ${ownerStr}\n` +
                `> **Invited By:** ${inviterStr}\n\n` +
                `### 🔗 Invite Access\n` +
                `> **Invite Link:** ${inviteUrl}`
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    } catch (err) {
      console.error("[Global Join Log Error]", err.message);
    }
  });
};
