const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");

module.exports = (client) => {
  client.on("guildDelete", async (guild) => {
    try {
      const logConfig = client.lmdbGet("global_botlogs_config");
      if (!logConfig || !logConfig.guildsChannelId) return;

      const logChannel = client.channels.cache.get(logConfig.guildsChannelId) || 
                         await client.channels.fetch(logConfig.guildsChannelId).catch(() => null);
      if (!logChannel) return;

      const owner = await guild.fetchOwner().catch(() => null);
      const ownerStr = owner ? `${owner.user.tag} (\`${owner.id}\`)` : `\`${guild.ownerId}\``;

      const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

      const iconUrl = guild.iconURL({ size: 256 }) || (owner ? owner.user.displayAvatarURL({ size: 256 }) : client.user.displayAvatarURL({ size: 256 }));

      await logChannel.send({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000) // Red for Leave
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📤 Left Server`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl))
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**Server Name**: ${guild.name}\n` +
                `**Server ID**: \`${guild.id}\`\n` +
                `**Server Owner**: ${ownerStr}\n` +
                `**Member Count**: \`${guild.memberCount}\``
              )
            )
        ],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    } catch (err) {
      console.error("[Global Leave Log Error]", err.message);
    }
  });
};
