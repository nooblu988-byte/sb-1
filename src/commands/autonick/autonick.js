const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = {
  name: "autonick",
  aliases: ["anick", "nickauto"],
  description: "Auto-set nickname when a member joins the server",
  category: "util",
  cooldown: 3,

  run: async (client, message, args, prefix) => {
    const guildId = message.guild.id;

    // ═══════════════════════════════════════════════════════════════
    // 🔒 PERMISSION CHECK — Only Owner, Bot Owner, or Admin
    // ═══════════════════════════════════════════════════════════════
    const isServerOwner = message.guild.ownerId === message.author.id;
    const isBotOwner = client.config.owner?.includes(message.author.id);
    const isExtraOwner = client.config.extraowners?.includes(message.author.id);
    const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isServerOwner && !isBotOwner && !isExtraOwner && !isAdmin) {
      return message.channel.send({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.cross} Only **Server Owner**, **Bot Owner**, or users with **Administrator** permission can use this command.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const key = `autonick_${guildId}`;
    const sub = args[0]?.toLowerCase();

    // ─── HELP ───
    if (!sub) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## 🏷️ AutoNick System")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`\`${prefix}autonick enable <format>\`\` — Enable auto-nick\n` +
                `\`\`${prefix}autonick disable\`\` — Disable auto-nick\n` +
                `\`\`${prefix}autonick status\`\` — View current status\n` +
                `\`\`${prefix}autonick format\`\` — See available placeholders`
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `-# Example: \`\`${prefix}autonick enable NOOBLU {displayname}\`\``
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── STATUS ───
    if (sub === "status") {
      const data = client.lmdbGet(key);
      const isEnabled = data?.enabled === true;
      const format = data?.format || "Not set";

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(isEnabled ? 0x57F287 : 0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## 🏷️ AutoNick Status")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**Status** : ${isEnabled ? `${client.emoji.tick} Enabled` : `${client.emoji.cross} Disabled`}\n` +
                `**Format** : \`\`${format}\`\``
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                isEnabled
                  ? `${client.emoji.tick} New members will get their nickname auto-set.`
                  : `${client.emoji.cross} AutoNick is currently disabled.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── FORMAT HELP ───
    if (sub === "format") {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## 📋 Available Placeholders")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`{username}\` — Real username\n` +
                `\`{displayname}\` — Display name (what people see)\n` +
                `\`{globalname}\` — Discord global display name\n` +
                `\`{userid}\` — User ID\n` +
                `\`{servername}\` — Server name\n` +
                `\`{membercount}\` — Member count\n` +
                `\`{random}\` — Random 4-digit number`
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `-# Example: \`\`NOOBLU {displayname}\`\` → \`\`NOOBLU JohnDoe\`\``
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── DISABLE ───
    if (sub === "disable") {
      const data = client.lmdbGet(key);
      if (!data || !data.enabled) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} AutoNick is already **disabled** for this server.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      client.lmdbSet(key, { enabled: false, format: data.format });
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.cross} AutoNick has been **disabled**.\n-# New members will no longer get their nickname auto-set.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── ENABLE ───
    if (sub === "enable") {
      const format = args.slice(1).join(" ");
      if (!format) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please provide a nickname format.\n-# Use: \`\`${prefix}autonick enable <format>\`\``
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (format.length > 100) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Nickname format cannot exceed 100 characters.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      client.lmdbSet(key, { enabled: true, format });
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.tick} AutoNick has been **enabled**.\n` +
                `**Format** : \`\`${format}\`\`\n` +
                `-# New members will get their nickname auto-set automatically.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── INVALID ───
    return message.reply({
      components: [
        new ContainerBuilder()
          .setAccentColor(0xFF0000)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${client.emoji.cross} Invalid option. Use \`\`${prefix}autonick\`\` for help.`
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
