const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

function formatCustomEmojis(text, client) {
  if (!text || !client) return text;

  const protectedEmojis = [];
  text = text.replace(/<(a)?:(\w+):(\d+)>/g, (match) => {
    protectedEmojis.push(match);
    return `__PROTECTED_EMOJI_${protectedEmojis.length - 1}__`;
  });

  text = text.replace(/:(\w+):/g, (match, name) => {
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
  return (
    `🦋 Welcome {user_mention} to the **{server_name}** Discord Server! 🦋\n\n` +
    `💖 Where friendships stay forever & vibes never end 💖\n\n` +
    `➢ 📖 READ → Rulebook\n` +
    `➢ 💬 ENJOY → Chat\n` +
    `➢ 🖼️ IMAGE → Media\n\n` +
    `❤️ Have Fun Here ❤️`
  );
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
      console.error("[GIF Banner Fetch Error]", err.message);
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
    console.error("[Banner Buffer Error]", err.message);
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
    user_createdate: member.user.createdAt.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    server_name: guild.name,
    server_id: guild.id,
    server_membercount: guild.memberCount,
    server_icon:
      guild.iconURL({ dynamic: true }) ??
      "https://cdn.discordapp.com/embed/avatars/0.png",
  };

  let content = cfg.message ? safeFormat(cfg.message, placeholders) : "";
  content = formatCustomEmojis(content, member.client);

  let description = cfg.description || buildDefaultDesc();
  description = safeFormat(description, placeholders);
  description = formatCustomEmojis(description, member.client);
  description = truncate(description, 4096);

  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(
      cfg.color ? parseInt(cfg.color.replace("#", ""), 16) : 0xe6e6fa
    )
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
      const attachment = new AttachmentBuilder(bannerData.buffer, {
        name: bannerData.name,
      });
      embed.setImage(`attachment://${bannerData.name}`);
      files.push(attachment);
    } else {
      embed.setImage(cfg.bannerUrl);
    }
  }

  embed.setThumbnail(
    member.user.displayAvatarURL({ dynamic: true, size: 256 })
  );

  await welcomeChannel.send({
    content: content || undefined,
    embeds: [embed],
    files: files.length ? files : undefined,
  });
}

module.exports = (client) => {
  client.on("guildMemberAdd", async (member) => {
    const guild = member.guild;

    // ═══════════════════════════════════════════════════════════════
    // 🏷️ AUTONICK SYSTEM (FIXED — Display Name Priority)
    // ═══════════════════════════════════════════════════════════════
    try {
      const autonickKey = `autonick_${guild.id}`;
      const autonickData = client.lmdbGet(autonickKey);

      if (autonickData && autonickData.enabled === true && autonickData.format) {
        let format = autonickData.format;

        // 🔥 PRIORITY ORDER for name:
        // 1. member.displayName  → Server nickname / global display name
        // 2. user.globalName     → Discord global display name
        // 3. user.username       → Real username (fallback)
        const displayName = member.displayName || member.user.globalName || member.user.username;

        const placeholders = {
          // Bande ka jo naam dikhta hai (priority: server nick > global name > username)
          displayname: displayName,
          // Discord ka global display name
          globalname: member.user.globalName || member.user.username,
          // Real username (login ID)
          username: member.user.username,
          userid: member.id,
          servername: guild.name,
          membercount: guild.memberCount,
          random: Math.floor(1000 + Math.random() * 9000).toString(),
        };

        let nickname = format;

        // Replace all placeholders (case-insensitive)
        for (const [key, value] of Object.entries(placeholders)) {
          const regex = new RegExp(`{${key}}`, "gi");
          nickname = nickname.replace(regex, String(value));
        }

        // 🛡️ SAFETY: If no name placeholder used, append display name
        const hasNamePlaceholder = /{username}|{displayname}|{globalname}/i.test(format);
        if (!hasNamePlaceholder) {
          nickname = `${nickname} ${displayName}`;
        }

        // Truncate to 32 chars (Discord limit)
        nickname = nickname.substring(0, 32).trim();

        // Don't change if already same
        if (member.nickname !== nickname && member.displayName !== nickname) {
          await member.setNickname(nickname).catch((err) => {
            console.error(
              `[AutoNick] Failed to set nickname for ${member.user.tag}: ${err.message}`
            );
          });
        }
      }
    } catch (err) {
      console.error("[AutoNick Error]", err.message);
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎉 NEW WELCOME SYSTEM
    // ═══════════════════════════════════════════════════════════════
    const welcomeKey = `welcome_cfg_${guild.id}`;
    const welcomeCfg = client.lmdbGet(welcomeKey);

    let welcomeSent = false;

    if (welcomeCfg && welcomeCfg.channelId && welcomeCfg.enabled !== false) {
      const welcomeChannel = guild.channels.cache.get(welcomeCfg.channelId);
      if (welcomeChannel) {
        try {
          await sendWelcomeEmbed(member, welcomeChannel, welcomeCfg);
          console.log(
            `[Welcome] Auto-welcome sent for ${member.user.tag} in ${guild.name}`
          );
          welcomeSent = true;
        } catch (err) {
          console.error("[Welcome Auto Error]", err.message);
        }
      } else {
        console.error(
          `[Welcome] Channel ${welcomeCfg.channelId} not found in ${guild.name}`
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 📜 OLD GREET SYSTEM (only if new welcome did NOT run)
    // ═══════════════════════════════════════════════════════════════
    if (welcomeSent) {
      console.log(
        `[Welcome] Skipping old greet system for ${member.user.tag} (new welcome already sent)`
      );
      return;
    }

    try {
      const guildKey = `greet_${guild.id}`;
      const config = await client.db.get(guildKey);
      if (!config || !config.channelId) return;

      const greetChannel = guild.channels.cache.get(config.channelId);
      if (!greetChannel) return;

      const placeholders = {
        user: `<@${member.id}>`,
        user_avatar: member.user.displayAvatarURL({ dynamic: true }),
        user_name: member.user.username,
        user_id: member.id,
        user_nick: member.displayName,
        user_joindate: member.joinedAt
          ? member.joinedAt.toLocaleDateString("en-US", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Unknown",
        user_createdate: member.user.createdAt.toLocaleDateString("en-US", {
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        server_name: guild.name,
        server_id: guild.id,
        server_membercount: guild.memberCount,
        server_icon:
          guild.iconURL({ dynamic: true }) ??
          "https://cdn.discordapp.com/embed/avatars/0.png",
      };

      let sent;

      if (config.type === "embed") {
        const ed = config.embedData;

        const embed = new EmbedBuilder()
          .setTitle(safeFormat(ed.title, placeholders) || null)
          .setDescription(safeFormat(ed.description, placeholders) || null)
          .setColor(ed.color ?? 0xe6e6fa);

        if (ed.footer_text) {
          embed.setFooter({
            text: safeFormat(ed.footer_text, placeholders),
            iconURL: safeFormat(ed.footer_icon, placeholders) || undefined,
          });
        }
        if (ed.author_name) {
          embed.setAuthor({
            name: safeFormat(ed.author_name, placeholders),
            iconURL: safeFormat(ed.author_icon, placeholders) || undefined,
          });
        }
        if (ed.thumbnail)
          embed.setThumbnail(safeFormat(ed.thumbnail, placeholders));
        if (ed.image) embed.setImage(safeFormat(ed.image, placeholders));

        const content = ed.message
          ? safeFormat(ed.message, placeholders)
          : undefined;
        sent = await greetChannel
          .send({ content, embeds: [embed] })
          .catch(() => null);
      }

      if (sent && config.autoDelete) {
        setTimeout(() => sent.delete().catch(() => {}), config.autoDelete * 1000);
      }
    } catch (err) {
      console.error("[Old Greet Error]", err.message);
    }
  });
};
