const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  PermissionFlagsBits,
} = require("discord.js");

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = {
  name: "autoreact",
  aliases: ["ar", "autoreaction"],
  description: "Auto-react when specific users are mentioned",
  category: "util",
  cooldown: 3,

  run: async (client, message, args, prefix) => {
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

    const guildId = message.guild.id;
    const key = `autoreact_${guildId}`;
    const sub = args[0]?.toLowerCase();

    // ─── HELP ───
    if (!sub) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## 😀 AutoReact System")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`\`${prefix}autoreact add @user <emoji>\`\` — Add auto-react for a user\n` +
                `\`\`${prefix}autoreact remove @user\`\` — Remove auto-react\n` +
                `\`\`${prefix}autoreact list\`\` — View all auto-reacts\n` +
                `\`\`${prefix}autoreact clear\`\` — Clear all auto-reacts`
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `-# Example: \`\`${prefix}autoreact add @user 🔥\`\``
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── LIST ───
    if (sub === "list") {
      const data = client.lmdbGet(key) || {};
      const entries = Object.entries(data);

      if (entries.length === 0) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} No auto-reacts set for this server.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const listText = entries
        .map(([uid, emoji], i) => `${i + 1}. <@${uid}> → ${emoji}`)
        .join("\n");

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## 😀 AutoReact List")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(listText)
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `-# Total: ${entries.length} auto-reacts`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── CLEAR ───
    if (sub === "clear") {
      client.lmdbDel(key);
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.tick} All auto-reacts cleared for this server.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── ADD ───
    if (sub === "add") {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please mention a user.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      let emoji = args.slice(2).join(" ").trim();

      if (!emoji) {
        const mentionStr = `<@${mentionedUser.id}>`;
        const mentionStr2 = `<@!${mentionedUser.id}>`;
        let contentAfter = message.content;
        if (contentAfter.includes(mentionStr2)) {
          contentAfter = contentAfter.split(mentionStr2).pop();
        } else {
          contentAfter = contentAfter.split(mentionStr).pop();
        }
        emoji = contentAfter?.trim();
      }

      if (!emoji) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please provide an emoji.\n-# Example: \`\`${prefix}autoreact add @user 🔥\`\``
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const data = client.lmdbGet(key) || {};
      data[mentionedUser.id] = emoji;
      client.lmdbSet(key, data);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.tick} AutoReact added for <@${mentionedUser.id}> with ${emoji}.\n-# Bot will auto-react whenever someone mentions them.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    // ─── REMOVE ───
    if (sub === "remove") {
      const mentionedUser = message.mentions.users.first();
      if (!mentionedUser) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please mention a user to remove.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const data = client.lmdbGet(key) || {};
      if (!data[mentionedUser.id]) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} <@${mentionedUser.id}> has no auto-react set.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      delete data[mentionedUser.id];
      if (Object.keys(data).length === 0) {
        client.lmdbDel(key);
      } else {
        client.lmdbSet(key, data);
      }

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.tick} AutoReact removed for <@${mentionedUser.id}>.`
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
              `${client.emoji.cross} Invalid option. Use \`\`${prefix}autoreact\`\` for help.`
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
