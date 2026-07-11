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

// ── HELPER FUNCTIONS ──
function formatCustomEmojis(text, client) {
  if (!text || !client) return text;

  // Step 1: Protect already-formatted emojis like <:name:id> or <a:name:id>
  const protectedEmojis = [];
  text = text.replace(/<(a)?:([a-zA-Z0-9_-]+):(\d+)>/g, (match) => {
    protectedEmojis.push(match);
    return `__PROTECTED_EMOJI_${protectedEmojis.length - 1}__`;
  });

  // Step 2: Convert :name: to <:name:id> only if bot has that emoji
  text = text.replace(/:([a-zA-Z0-9_-]+):/g, (match, name) => {
    const emoji = client.emojis.cache.find(e => e.name === name);
    if (emoji) {
      return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
    }
    return match;
  });

  // Step 3: Restore protected emojis
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

  // For GIFs — download raw buffer so animation is preserved
  if (bannerUrl.toLowerCase().includes('.gif')) {
    try {
      const response = await fetch(bannerUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, name: 'welcome-banner.gif' };
    } catch (err) {
      console.error('[GIF Banner Fetch Error]', err.message);
      return null;
    }
  }

  // For static images — re-encode via canvas for reliability
  try {
    const img = await loadImage(bannerUrl);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const buffer = await canvas.encode('png');
    return { buffer, name: 'welcome-banner.png' };
  } catch (err) {
    console.error('[Banner Buffer Error]', err.message);
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
    server_icon: guild.iconURL({ dynamic: true }) ?? "https://cdn.discordapp.com/embed/avatars/0.png"
  };

  let content = cfg.message ? safeFormat(cfg.message, placeholders) : "";
  content = formatCustomEmojis(content, member.client);

  let description = cfg.description || buildDefaultDesc();
  description = safeFormat(description, placeholders);
  description = formatCustomEmojis(description, member.client);
  description = truncate(description, 4096);

  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(cfg.color ? parseInt(cfg.color.replace('#', ''), 16) : 0xE6E6FA)
    .setFooter({ 
      text: `Member #${guild.memberCount}`, 
      iconURL: guild.iconURL({ dynamic: true }) ?? undefined 
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
  name: "welcome",
  aliases: ["wl"],
  description: "Manage the server welcome system with custom banner & text",
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
    const cfgKey = `welcome_cfg_${guildId}`;
    const cfg = client.lmdbGet(cfgKey);

    const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

    if (!sub) {
      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent("## Welcome System")
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`\`\`${prefix}welcome setup <#channel>\`\`\` — Set welcome channel\n` +
                `\`\`\`${prefix}welcome disable\`\`\` — Disable welcome system\n` +
                `\`\`\`${prefix}welcome status\`\`\` — View current settings\n` +
                `\`\`\`${prefix}welcome banner <image-url>\`\`\` — Set custom banner (GIF or static)\n` +
                `\`\`\`${prefix}welcome removebanner\`\`\` — Remove custom banner\n` +
                `\`\`\`${prefix}welcome title <text>\`\`\` — Set welcome title\n` +
                `\`\`\`${prefix}welcome desc <text>\`\`\` — Set welcome description\n` +
                `\`\`\`${prefix}welcome color <hex>\`\`\` — Set embed color\n` +
                `\`\`\`${prefix}welcome message <text>\`\`\` — Set plain message\n` +
                `\`\`\`${prefix}welcome test\`\`\` — Test welcome with yourself\n\n` +
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
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${DISABLED_EMOJI} Welcome system is **not configured** for this server.\n` +
                  `-# Run \`\`\`${prefix}welcome setup <#channel>\`\`\` to set it up.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const welcomeChannel = message.guild.channels.cache.get(cfg.channelId);
      const bannerStatus = cfg.bannerUrl ? `${ENABLED_EMOJI} Set` : `${DISABLED_EMOJI} Not set`;

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## ${message.guild.name} — Welcome Status`
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `**Status:** ${ENABLED_EMOJI} Active\n` +
                `**Channel:** ${welcomeChannel ? `<#${cfg.channelId}>` : "\`Channel deleted\`"}\n` +
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

    if (sub === "setup") {
      const mentionedChannel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);

      if (!mentionedChannel) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please mention a valid channel.\n` +
                  `-# Usage: \`\`\`${prefix}welcome setup #channel\`\`\``
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (mentionedChannel.type !== ChannelType.GuildText && 
          mentionedChannel.type !== ChannelType.GuildAnnouncement) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please mention a text or announcement channel.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const newCfg = {
        channelId: mentionedChannel.id,
        bannerUrl: cfg?.bannerUrl || null,
        title: cfg?.title || "Welcome {user_name}! 🎉",
        description: cfg?.description || buildDefaultDesc(),
        color: cfg?.color || "#E6E6FA",
        message: cfg?.message || "",
        enabled: true,
      };

      client.lmdbSet(cfgKey, newCfg);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Welcome system has been **configured**!\n\n` +
                `${client.emoji.arrow} Channel: <#${mentionedChannel.id}>\n` +
                `${client.emoji.arrow} Banner: ${newCfg.bannerUrl ? "Set" : "Not set"}\n` +
                `${client.emoji.arrow} Title: \`\`\`${newCfg.title}\`\`\`\n\n` +
                `-# Use \`\`\`${prefix}welcome banner <url>\`\`\` to set a custom banner image or GIF.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "disable") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${DISABLED_EMOJI} Welcome system is **not configured** for this server.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      client.lmdbDel(cfgKey);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${DISABLED_EMOJI} Welcome system has been **disabled**.\n` +
                `-# All welcome settings have been removed.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "banner") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured. Run \`\`\`${prefix}welcome setup <#channel>\`\`\` first.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      let imageUrl = null;

      const attachment = message.attachments.first();
      if (attachment) {
        const contentType = attachment.contentType || "";
        const name = attachment.name || "";
        const isImage = contentType.startsWith("image/") || 
                        /\.(png|jpe?g|webp|gif)$/i.test(name);

        if (!isImage) {
          return message.reply({
            components: [
              new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `${client.emoji.cross} The uploaded file is not a valid image.\n` +
                    `-# Please upload a **PNG, JPG, GIF, or WEBP** image.`
                  )
                ),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }

        imageUrl = attachment.url;
      }

      if (!imageUrl && args[1]) {
        const urlArg = args.slice(1).join(" ");
        const urlPattern = /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i;
        if (urlPattern.test(urlArg)) {
          imageUrl = urlArg;
        } else {
          return message.reply({
            components: [
              new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `${client.emoji.cross} Invalid image URL.\n` +
                    `-# **Option 1:** Drag & drop an image/GIF with the command\n` +
                    `-# **Option 2:** Provide a direct image URL\n` +
                    `**Example:** \`\`\`${prefix}welcome banner https://i.imgur.com/yourbanner.gif\`\`\``
                  )
                ),
            ],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      }

      if (!imageUrl) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} No image provided.\n\n` +
                  `**How to set a banner:**\n` +
                  `${client.emoji.arrow} **Drag & Drop:** Upload an image/GIF directly in chat with \`\`\`${prefix}welcome banner\`\`\`\n` +
                  `${client.emoji.arrow} **URL:** \`\`\`${prefix}welcome banner https://example.com/banner.gif\`\`\`\n\n` +
                  `**Supported formats:** PNG, JPG, JPEG, WEBP, **GIF (animated)**\n` +
                  `**Recommended size:** 1024x500 pixels for best results`
                )
              ),
            ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      cfg.bannerUrl = imageUrl;
      client.lmdbSet(cfgKey, cfg);

      const isGif = imageUrl.toLowerCase().includes('.gif');

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Custom banner has been **set**!\n` +
                `-# Image URL saved successfully.\n` +
                `${isGif ? "🎬 **Animated GIF** detected!" : "🖼️ **Static image** set."}\n\n` +
                `**Preview:** [Click to view](${imageUrl})`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "removebanner") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      cfg.bannerUrl = null;
      client.lmdbSet(cfgKey, cfg);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${DISABLED_EMOJI} Custom banner has been **removed**.\n` +
                `-# Welcome embed will be sent without banner image.`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "title") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured. Run \`\`\`${prefix}welcome setup <#channel>\`\`\` first.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const newTitle = args.slice(1).join(" ");
      if (!newTitle) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please provide a title.\n` +
                  `-# Usage: \`\`\`${prefix}welcome title Welcome {user_name}!\`\`\`\n\n` +
                  "**Placeholders:** `{user}` `{user_name}` `{server_name}` `{server_membercount}` `{user_mention}`\n\n" +
                  `⚠️ **Max 256 characters** after placeholders are replaced.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      cfg.title = newTitle;
      client.lmdbSet(cfgKey, cfg);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Welcome title has been **updated**.\n` +
                `-# New title: \`\`\`${newTitle.substring(0, 100)}${newTitle.length > 100 ? "..." : ""}\`\`\`\n` +
                `-# Length: ${newTitle.length}/256 chars`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "desc" || sub === "description") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured. Run \`\`\`${prefix}welcome setup <#channel>\`\`\` first.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const newDesc = args.slice(1).join(" ");
      if (!newDesc) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please provide a description.\n` +
                  `-# Usage: \`\`\`${prefix}welcome desc Welcome to {server_name}!\`\`\`\n\n` +
                  "**Placeholders:** `{user}` `{user_name}` `{server_name}` `{server_membercount}` `{user_mention}` `{user_createdate}`\n\n" +
                  `⚠️ **Max 4096 characters** after placeholders are replaced.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      cfg.description = newDesc;
      client.lmdbSet(cfgKey, cfg);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Welcome description has been **updated**.\n` +
                `-# New description: \`\`\`${newDesc.substring(0, 100)}${newDesc.length > 100 ? "..." : ""}\`\`\`\n` +
                `-# Length: ${newDesc.length}/4096 chars`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "color") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured. Run \`\`\`${prefix}welcome setup <#channel>\`\`\` first.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const newColor = args[1];
      if (!newColor || !/^#?[0-9A-Fa-f]{6}$/.test(newColor)) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please provide a valid hex color.\n` +
                  `-# Usage: \`\`\`${prefix}welcome color #E6E6FA\`\`\`\n` +
                  `**Examples:** \`\`\`#FF0000\`\`\` (red), \`\`\`#57F287\`\`\` (green), \`\`\`#E6E6FA\`\`\` (lavender)`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      cfg.color = newColor.startsWith('#') ? newColor : '#' + newColor;
      client.lmdbSet(cfgKey, cfg);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(parseInt(cfg.color.replace('#', ''), 16))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Welcome color has been **updated**.\n` +
                `-# New color: \`\`\`${cfg.color}\`\`\``
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "message") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured. Run \`\`\`${prefix}welcome setup <#channel>\`\`\` first.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const newMessage = args.slice(1).join(" ");
      if (!newMessage) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Please provide a welcome message.\n` +
                  `-# Usage: \`\`\`${prefix}welcome message Welcome {user_mention} to {server_name}!\`\`\`\n\n` +
                  "**Placeholders:** `{user}` `{user_name}` `{user_mention}` `{server_name}` `{server_membercount}` `{user_id}` `{user_createdate}`"
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      cfg.message = newMessage;
      client.lmdbSet(cfgKey, cfg);

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Welcome message has been **updated**.\n` +
                `-# New message: \`\`\`${newMessage}\`\`\``
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (sub === "test") {
      if (!cfg || !cfg.channelId) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome system is not configured. Run \`\`\`${prefix}welcome setup <#channel>\`\`\` first.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const welcomeChannel = message.guild.channels.cache.get(cfg.channelId);
      if (!welcomeChannel) {
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0x26272F)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Welcome channel not found. Please reconfigure.`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      try {
        await sendWelcomeEmbed(message.member, welcomeChannel, cfg);
      } catch (err) {
        console.error("[Welcome Test Error]", err);
        return message.reply({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xFF0000)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                  `${client.emoji.cross} Failed to send welcome test.\n` +
                  `-# Error: ${err.message}`
                )
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      }

      return message.reply({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `${ENABLED_EMOJI} Welcome test sent to <#${welcomeChannel.id}>.\n` +
                `-# Check the channel to see how it looks!`
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    return message.reply({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x26272F)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `${client.emoji.cross} Invalid option. Use \`\`\`${prefix}welcome\`\`\``
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
