const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

// ═══════════════════════════════════════════════════════════════
// 🎉 WELCOME MULTI — same as `welcome` but supports MULTIPLE channels
// Config is stored separately (welcomemulti_cfg_<guildId>) so the
// original `welcome` system is NOT affected in any way.
// ═══════════════════════════════════════════════════════════════
const MAX_CHANNELS = 10;

// ── HELPER FUNCTIONS (duplicated from welcome.js) ──
function formatCustomEmojis(text, client) {
  if (!text || !client) return text;

  const protectedEmojis = [];
  text = text.replace(/<(a)?:([a-zA-Z0-9_-]+):(\d+)>/g, (match) => {
    protectedEmojis.push(match);
    return `__PROTECTED_EMOJI_${protectedEmojis.length - 1}__`;
  });

  text = text.replace(/:([a-zA-Z0-9_-]+):/g, (match, name) => {
    const emoji = client.emojis.cache.find((e) => e.name === name);
    if (emoji) {
      return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
    }
    return match;
  });

  protectedEmojis.forEach((emoji, i) => {
    text = text.replace(`__PROTECTED_EMOJI_${i}__`, emoji);
  });

  return text;
}

function safeFormat(text, placeholders) {
  if (!text) return "";
  return text.replace(/\{(\w+)\}/gi, (_, key) => {
    return String(placeholders[key.toLowerCase()] ?? `{${key}}`);
  });
}

function buildDefaultDesc() {
  return `🦋 Welcome {user_mention} to the **{server_name}** Discord Server! 🦋\n\n` +
    `💖 Where friendships stay forever & vibes never end 💖\n\n` +
    `➢ 📖 READ → Rulebook\n` +
    `➢ 💬 ENJOY → Chat\n` +
    `➢ 🖼️ IMAGE → Media\n\n` +
    `❤️ Have Fun Here ❤️`;
}

function truncate(str, maxLen) {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + "...";
}

async function getBannerAttachment(bannerUrl) {
  if (!bannerUrl) return null;

  if (bannerUrl.toLowerCase().includes(".gif")) {
    try {
      const response = await fetch(bannerUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, name: "welcome-banner.gif" };
    } catch (err) {
      console.error("[WelcomeMulti GIF Banner Fetch Error]", err.message);
      return null;
    }
  }

  try {
    const img = await loadImage(bannerUrl);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const buffer = await canvas.encode("png");
    return { buffer, name: "welcome-banner.png" };
  } catch (err) {
    console.error("[WelcomeMulti Banner Buffer Error]", err.message);
    return null;
  }
}

async function sendWelcomeEmbed(member, welcomeChannel, cfg) {
  const guild = member.guild;

  const placeholders = {
    user: `<@${member.id}>`,
    user_mention: `<@${member.id}>`,
    user_avatar: member.user.displayAvatarURL({ dynamic: true }),
    user_name: member.user.username,
    user_id: member.id,
    user_nick: member.displayName,
    user_createdate: member.user.createdAt.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
    server_name: guild.name,
    server_id: guild.id,
    server_membercount: guild.memberCount,
    server_icon: guild.iconURL({ dynamic: true }) ?? "https://cdn.discordapp.com/embed/avatars/0.png",
  };

  let content = cfg.message ? safeFormat(cfg.message, placeholders) : "";
  content = formatCustomEmojis(content, member.client);

  let description = cfg.description || buildDefaultDesc();
  description = safeFormat(description, placeholders);
  description = formatCustomEmojis(description, member.client);
  description = truncate(description, 4096);

  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(cfg.color ? parseInt(cfg.color.replace("#", ""), 16) : 0xE6E6FA)
    .setFooter({
      text: `Member #${guild.memberCount}`,
      iconURL: guild.iconURL({ dynamic: true }) ?? undefined,
    });

  let title = cfg.title ? safeFormat(cfg.title, placeholders) : "";
  title = formatCustomEmojis(title, member.client);
  if (title && title.trim().length > 0) {
    title = truncate(title, 256);
    embed.setTitle(title);
  }

  let files = [];
  if (cfg.bannerUrl) {
    const bannerData = await getBannerAttachment(cfg.bannerUrl);
    if (bannerData) {
      const attachment = new AttachmentBuilder(bannerData.buffer, { name: bannerData.name });
      embed.setImage(`attachment://${bannerData.name}`);
      files.push(attachment);
    } else {
      embed.setImage(cfg.bannerUrl);
    }
  }

  embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));

  await welcomeChannel.send({ content: content || undefined, embeds: [embed], files: files.length ? files : undefined });
}

// ── MAIN COMMAND ──
module.exports = {
  name: "welcomemulti",
  aliases: ["wlm", "welcomemultichannel"],
  description: "Welcome system for MULTIPLE channels with custom banner & text",
  category: "welcome",
  cooldown: 3,

  run: async (client, message, args, prefix) => {
    const ENABLED_EMOJI = client.emoji.enabled2;
    const DISABLED_EMOJI = client.emoji.disabled2;

    if (!client.config.owner.includes(message.author.id) &&
      message.guild.ownerId !== message.author.id) {
      return message.channel.send({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${client.emoji.cross} Only the **Server Owner** can use this command.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const sub = args[0]?.toLowerCase();
    const guildId = message.guild.id;
    const cfgKey = `welcomemulti_cfg_${guildId}`;
    const cfg = client.lmdbGet(cfgKey);

    const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    // small reply helper
    const box = (color, text) =>
      message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(text)),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    const notConfigured = () =>
      box(0x26272F, `${client.emoji.cross} Welcome multi system is not configured. Run \`\`\`${prefix}welcomemulti setup #channel1 #channel2\`\`\` first.`);

    const getChannelIds = (c) => (Array.isArray(c?.channelIds) ? c.channelIds : []);

    // Parse channels from args (mentions or IDs) → { valid: [channel], invalid: [string] }
    const parseChannels = (list) => {
      const valid = [];
      const invalid = [];
      for (const raw of list) {
        const id = raw.replace(/[<#>]/g, "");
        const ch = /^\d+$/.test(id) ? message.guild.channels.cache.get(id) : null;
        if (
          ch &&
          (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
        ) {
          if (!valid.some((v) => v.id === ch.id)) valid.push(ch);
        } else {
          invalid.push(raw);
        }
      }
      return { valid, invalid };
    };

    if (!sub) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## Welcome Multi System")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`\`\`${prefix}welcomemulti setup <#ch1> <#ch2> ...\`\`\` — Set multiple welcome channels (max ${MAX_CHANNELS})\n` +
                `\`\`\`${prefix}welcomemulti add <#channel>\`\`\` — Add one more channel\n` +
                `\`\`\`${prefix}welcomemulti remove <#channel>\`\`\` — Remove one channel\n` +
                `\`\`\`${prefix}welcomemulti disable\`\`\` — Disable welcome multi system\n` +
                `\`\`\`${prefix}welcomemulti status\`\`\` — View current settings\n` +
                `\`\`\`${prefix}welcomemulti banner <image-url>\`\`\` — Set custom banner (GIF or static)\n` +
                `\`\`\`${prefix}welcomemulti removebanner\`\`\` — Remove custom banner\n` +
                `\`\`\`${prefix}welcomemulti title <text>\`\`\` — Set welcome title\n` +
                `\`\`\`${prefix}welcomemulti desc <text>\`\`\` — Set welcome description\n` +
                `\`\`\`${prefix}welcomemulti color <hex>\`\`\` — Set embed color\n` +
                `\`\`\`${prefix}welcomemulti message <text>\`\`\` — Set plain message\n` +
                `\`\`\`${prefix}welcomemulti test\`\`\` — Test welcome in all channels\n\n` +
                "**Placeholders:** `{user}` `{user_name}` `{user_mention}` `{server_name}` `{server_membercount}` `{user_id}` `{user_createdate}`"
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`-# Requested by ${message.author.tag}`)
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "status") {
      const ids = getChannelIds(cfg);
      if (!ids.length) {
        return box(
          0x26272F,
          `${DISABLED_EMOJI} Welcome multi system is **not configured** for this server.\n` +
          `-# Run \`\`\`${prefix}welcomemulti setup #channel1 #channel2\`\`\` to set it up.`
        );
      }

      const channelList = ids
        .map((id) => (message.guild.channels.cache.get(id) ? `<#${id}>` : `\`Deleted (${id})\``))
        .join(", ");
      const bannerStatus = cfg.bannerUrl ? `${ENABLED_EMOJI} Set` : `${DISABLED_EMOJI} Not set`;

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## ${message.guild.name} — Welcome Multi Status`)
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**Status:** ${ENABLED_EMOJI} Active\n` +
                `**Channels (${ids.length}):** ${channelList}\n` +
                `**Banner:** ${bannerStatus}\n` +
                `**Title:** \`\`\`${cfg.title ? cfg.title.substring(0, 50) + (cfg.title.length > 50 ? "..." : "") : "Default"}\`\`\`\n` +
                `**Description:** \`\`\`${cfg.description ? cfg.description.substring(0, 50) + "..." : "Default"}\`\`\`\n` +
                `**Color:** \`\`\`${cfg.color || "#E6E6FA"}\`\`\`\n` +
                `**Message:** \`\`\`${cfg.message || "None"}\`\`\``
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`-# Server ID: ${guildId}`)
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "setup" || sub === "channel" || sub === "channels") {
      const { valid, invalid } = parseChannels(args.slice(1));

      if (!valid.length) {
        return box(
          0x26272F,
          `${client.emoji.cross} Please mention at least one valid text/announcement channel.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti setup #channel1 #channel2 #channel3\`\`\``
        );
      }

      if (valid.length > MAX_CHANNELS) {
        return box(0x26272F, `${client.emoji.cross} You can set a maximum of **${MAX_CHANNELS}** channels.`);
      }

      const newCfg = {
        channelIds: valid.map((c) => c.id),
        bannerUrl: cfg?.bannerUrl || null,
        title: cfg?.title || "Welcome {user_name}! 🎉",
        description: cfg?.description || buildDefaultDesc(),
        color: cfg?.color || "#E6E6FA",
        message: cfg?.message || "",
        enabled: true,
      };

      client.lmdbSet(cfgKey, newCfg);

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Welcome multi system has been **configured**!\n\n` +
        `${client.emoji.arrow} Channels (${valid.length}): ${valid.map((c) => `<#${c.id}>`).join(", ")}\n` +
        `${client.emoji.arrow} Banner: ${newCfg.bannerUrl ? "Set" : "Not set"}\n` +
        `${client.emoji.arrow} Title: \`\`\`${newCfg.title}\`\`\`\n` +
        (invalid.length ? `\n⚠️ Skipped invalid: ${invalid.map((i) => `\`${i}\``).join(", ")}\n` : "\n") +
        `-# Use \`\`\`${prefix}welcomemulti banner <url>\`\`\` to set a custom banner image or GIF.`
      );
    }

    if (sub === "add") {
      if (!getChannelIds(cfg).length) return notConfigured();

      const { valid, invalid } = parseChannels(args.slice(1));
      if (!valid.length) {
        return box(
          0x26272F,
          `${client.emoji.cross} Please mention a valid text/announcement channel.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti add #channel\`\`\``
        );
      }

      const ids = getChannelIds(cfg);
      const added = valid.filter((c) => !ids.includes(c.id));
      if (!added.length) {
        return box(0x26272F, `${client.emoji.cross} That channel is already in the welcome list.`);
      }
      if (ids.length + added.length > MAX_CHANNELS) {
        return box(0x26272F, `${client.emoji.cross} You can set a maximum of **${MAX_CHANNELS}** channels.`);
      }

      cfg.channelIds = [...ids, ...added.map((c) => c.id)];
      client.lmdbSet(cfgKey, cfg);

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Added ${added.map((c) => `<#${c.id}>`).join(", ")}\n` +
        `-# Total channels: ${cfg.channelIds.length}` +
        (invalid.length ? `\n⚠️ Skipped invalid: ${invalid.map((i) => `\`${i}\``).join(", ")}` : "")
      );
    }

    if (sub === "remove") {
      if (!getChannelIds(cfg).length) return notConfigured();

      const rawId = (args[1] || "").replace(/[<#>]/g, "");
      const ids = getChannelIds(cfg);
      if (!/^\d+$/.test(rawId) || !ids.includes(rawId)) {
        return box(
          0x26272F,
          `${client.emoji.cross} That channel is not in the welcome list.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti remove #channel\`\`\``
        );
      }

      const left = ids.filter((id) => id !== rawId);
      if (!left.length) {
        client.lmdbDel(cfgKey);
        return box(
          0xFF0000,
          `${DISABLED_EMOJI} Removed <#${rawId}>. No channels left, so welcome multi system has been **disabled**.`
        );
      }

      cfg.channelIds = left;
      client.lmdbSet(cfgKey, cfg);

      return box(
        0xFF0000,
        `${DISABLED_EMOJI} Removed <#${rawId}>.\n-# Remaining channels: ${left.map((id) => `<#${id}>`).join(", ")}`
      );
    }

    if (sub === "disable") {
      if (!getChannelIds(cfg).length) {
        return box(0x26272F, `${DISABLED_EMOJI} Welcome multi system is **not configured** for this server.`);
      }

      client.lmdbDel(cfgKey);

      return box(
        0xFF0000,
        `${DISABLED_EMOJI} Welcome multi system has been **disabled**.\n` +
        `-# All welcome multi settings have been removed.`
      );
    }

    if (sub === "banner") {
      if (!getChannelIds(cfg).length) return notConfigured();

      let imageUrl = null;

      const attachment = message.attachments.first();
      if (attachment) {
        const contentType = attachment.contentType || "";
        const name = attachment.name || "";
        const isImage = contentType.startsWith("image/") ||
                        /\.(png|jpe?g|webp|gif)$/i.test(name);

        if (!isImage) {
          return box(
            0x26272F,
            `${client.emoji.cross} The uploaded file is not a valid image.\n` +
            `-# Please upload a **PNG, JPG, GIF, or WEBP** image.`
          );
        }

        imageUrl = attachment.url;
      }

      if (!imageUrl && args[1]) {
        const urlArg = args.slice(1).join(" ");
        const urlPattern = /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i;
        if (urlPattern.test(urlArg)) {
          imageUrl = urlArg;
        } else {
          return box(
            0x26272F,
            `${client.emoji.cross} Invalid image URL.\n` +
            `-# **Option 1:** Drag & drop an image/GIF with the command\n` +
            `-# **Option 2:** Provide a direct image URL\n` +
            `**Example:** \`\`\`${prefix}welcomemulti banner https://i.imgur.com/yourbanner.gif\`\`\``
          );
        }
      }

      if (!imageUrl) {
        return box(
          0x26272F,
          `${client.emoji.cross} No image provided.\n\n` +
          `**How to set a banner:**\n` +
          `${client.emoji.arrow} **Drag & Drop:** Upload an image/GIF directly in chat with \`\`\`${prefix}welcomemulti banner\`\`\`\n` +
          `${client.emoji.arrow} **URL:** \`\`\`${prefix}welcomemulti banner https://example.com/banner.gif\`\`\`\n\n` +
          `**Supported formats:** PNG, JPG, JPEG, WEBP, **GIF (animated)**\n` +
          `**Recommended size:** 1024x500 pixels for best results`
        );
      }

      cfg.bannerUrl = imageUrl;
      client.lmdbSet(cfgKey, cfg);

      const isGif = imageUrl.toLowerCase().includes(".gif");

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Custom banner has been **set**!\n` +
        `-# Image URL saved successfully.\n` +
        `${isGif ? "🎬 **Animated GIF** detected!" : "🖼️ **Static image** set."}\n\n` +
        `**Preview:** [Click to view](${imageUrl})`
      );
    }

    if (sub === "removebanner") {
      if (!getChannelIds(cfg).length) {
        return box(0x26272F, `${client.emoji.cross} Welcome multi system is not configured.`);
      }

      cfg.bannerUrl = null;
      client.lmdbSet(cfgKey, cfg);

      return box(
        0xFF0000,
        `${DISABLED_EMOJI} Custom banner has been **removed**.\n` +
        `-# Welcome embed will be sent without banner image.`
      );
    }

    if (sub === "title") {
      if (!getChannelIds(cfg).length) return notConfigured();

      const newTitle = args.slice(1).join(" ");
      if (!newTitle) {
        return box(
          0x26272F,
          `${client.emoji.cross} Please provide a title.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti title Welcome {user_name}!\`\`\`\n\n` +
          "**Placeholders:** `{user}` `{user_name}` `{server_name}` `{server_membercount}` `{user_mention}`\n\n" +
          `⚠️ **Max 256 characters** after placeholders are replaced.`
        );
      }

      cfg.title = newTitle;
      client.lmdbSet(cfgKey, cfg);

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Welcome title has been **updated**.\n` +
        `-# New title: \`\`\`${newTitle.substring(0, 100)}${newTitle.length > 100 ? "..." : ""}\`\`\`\n` +
        `-# Length: ${newTitle.length}/256 chars`
      );
    }

    if (sub === "desc" || sub === "description") {
      if (!getChannelIds(cfg).length) return notConfigured();

      const newDesc = args.slice(1).join(" ");
      if (!newDesc) {
        return box(
          0x26272F,
          `${client.emoji.cross} Please provide a description.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti desc Welcome to {server_name}!\`\`\`\n\n` +
          "**Placeholders:** `{user}` `{user_name}` `{server_name}` `{server_membercount}` `{user_mention}` `{user_createdate}`\n\n" +
          `⚠️ **Max 4096 characters** after placeholders are replaced.`
        );
      }

      cfg.description = newDesc;
      client.lmdbSet(cfgKey, cfg);

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Welcome description has been **updated**.\n` +
        `-# New description: \`\`\`${newDesc.substring(0, 100)}${newDesc.length > 100 ? "..." : ""}\`\`\`\n` +
        `-# Length: ${newDesc.length}/4096 chars`
      );
    }

    if (sub === "color") {
      if (!getChannelIds(cfg).length) return notConfigured();

      const newColor = args[1];
      if (!newColor || !/^#?[0-9A-Fa-f]{6}$/.test(newColor)) {
        return box(
          0x26272F,
          `${client.emoji.cross} Please provide a valid hex color.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti color #E6E6FA\`\`\`\n` +
          `**Examples:** \`\`\`#FF0000\`\`\` (red), \`\`\`#57F287\`\`\` (green), \`\`\`#E6E6FA\`\`\` (lavender)`
        );
      }

      cfg.color = newColor.startsWith("#") ? newColor : "#" + newColor;
      client.lmdbSet(cfgKey, cfg);

      return box(
        parseInt(cfg.color.replace("#", ""), 16),
        `${ENABLED_EMOJI} Welcome color has been **updated**.\n` +
        `-# New color: \`\`\`${cfg.color}\`\`\``
      );
    }

    if (sub === "message") {
      if (!getChannelIds(cfg).length) return notConfigured();

      const newMessage = args.slice(1).join(" ");
      if (!newMessage) {
        return box(
          0x26272F,
          `${client.emoji.cross} Please provide a welcome message.\n` +
          `-# Usage: \`\`\`${prefix}welcomemulti message Welcome {user_mention} to {server_name}!\`\`\`\n\n` +
          "**Placeholders:** `{user}` `{user_name}` `{user_mention}` `{server_name}` `{server_membercount}` `{user_id}` `{user_createdate}`"
        );
      }

      cfg.message = newMessage;
      client.lmdbSet(cfgKey, cfg);

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Welcome message has been **updated**.\n` +
        `-# New message: \`\`\`${newMessage}\`\`\``
      );
    }

    if (sub === "test") {
      const ids = getChannelIds(cfg);
      if (!ids.length) return notConfigured();

      const sentTo = [];
      const failed = [];

      for (const id of ids) {
        const ch = message.guild.channels.cache.get(id);
        if (!ch) {
          failed.push(`\`${id}\` (not found)`);
          continue;
        }
        try {
          await sendWelcomeEmbed(message.member, ch, cfg);
          sentTo.push(`<#${id}>`);
        } catch (err) {
          console.error("[WelcomeMulti Test Error]", err);
          failed.push(`<#${id}> (${err.message})`);
        }
      }

      if (!sentTo.length) {
        return box(
          0xFF0000,
          `${client.emoji.cross} Failed to send welcome test.\n` +
          `-# ${failed.join(", ")}`
        );
      }

      return box(
        0x57F287,
        `${ENABLED_EMOJI} Welcome test sent to ${sentTo.join(", ")}.\n` +
        (failed.length ? `⚠️ Failed: ${failed.join(", ")}\n` : "") +
        `-# Check the channels to see how it looks!`
      );
    }

    return box(
      0x26272F,
      `${client.emoji.cross} Invalid option. Use \`\`\`${prefix}welcomemulti\`\`\``
    );
  },
};
