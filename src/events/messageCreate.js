const {
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const commandCooldowns = new Map();
const blacklistCooldown = new Map();

let globalLock = false;
let lockTimeout = null;

function applyGlobalLock() {
  globalLock = true;
  clearTimeout(lockTimeout);
  lockTimeout = setTimeout(() => {
    globalLock = false;
  }, 1000);
}

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

module.exports = async (client) => {
  client.on("rateLimit", () => applyGlobalLock());

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;
    if (globalLock) return;

    const perms = message.channel.permissionsFor(message.guild.members.me);
    if (!perms || !perms.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])) return;

    // ═══════════════════════════════════════════════════════════════
    // 😀 AUTOREACT SYSTEM (runs only on an explicitly typed @mention —
    // NOT on a plain reply, which Discord also counts as a "mention")
    // ═══════════════════════════════════════════════════════════════
    try {
      const autoreactKey = `autoreact_${message.guild.id}`;
      const autoreactData = client.lmdbGet(autoreactKey);

      if (autoreactData && message.mentions.users.size > 0) {
        const canReact = message.channel.permissionsFor(message.guild.members.me)?.has(PermissionFlagsBits.AddReactions);

        if (canReact) {
          for (const [userId, emoji] of Object.entries(autoreactData)) {
            const explicitlyTagged =
              message.content.includes(`<@${userId}>`) || message.content.includes(`<@!${userId}>`);
            if (explicitlyTagged) {
              await message.react(emoji).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error("[AutoReact Error]", err.message);
    }

    let prefix = client.config.prefix;
    const prefixData = client.lmdbGet(`prefix_${message.guild.id}`);
    if (prefixData) prefix = prefixData;

    const mentionedBot =
      message.content === `<@${client.user.id}>` ||
      message.content === `<@!${client.user.id}>`;

    const botregex = RegExp(`^<@!?${client.user.id}>( |)`);
    const pre = message.content.match(botregex)
      ? message.content.match(botregex)[0]
      : prefix;

    const argsWithPrefix = message.content.startsWith(pre)
      ? message.content.slice(pre.length).trim().split(/ +/)
      : null;

    const argsWithoutPrefix = message.content.trim().split(/ +/);

    const commandWithPrefix = argsWithPrefix ? argsWithPrefix.shift()?.toLowerCase() : null;
    const commandWithoutPrefix = argsWithoutPrefix.shift()?.toLowerCase();

    const cmdWithPrefix = commandWithPrefix
      ? client.commands.get(commandWithPrefix) ||
        client.commands.find((c) => c.aliases?.includes(commandWithPrefix))
      : null;

    const cmdWithoutPrefix =
      client.commands.get(commandWithoutPrefix) ||
      client.commands.find((c) => c.aliases?.includes(commandWithoutPrefix));

    const npList = client.lmdbGet("noprefix") || [];
    const isNoprefixUser = npList.some((entry) => entry.userId === message.author.id);

    let cmd, args;
    if (isNoprefixUser) {
      cmd = cmdWithoutPrefix || cmdWithPrefix;
      args = cmdWithoutPrefix ? argsWithoutPrefix : argsWithPrefix;
    } else {
      cmd = cmdWithPrefix;
      args = argsWithPrefix;
    }

    const bl = client.lmdbGet(`blacklist_${client.user.id}`) || [];

    if ((mentionedBot || cmd) && bl.includes(message.author.id)) {
      const now = Date.now();
      const last = blacklistCooldown.get(message.author.id) || 0;
      if (now - last < 60000) return;
      blacklistCooldown.set(message.author.id, now);

      const reason = client.lmdbGet(`blreason_${message.author.id}`) || "No reason provided";

      return message.channel.send({
        components: [
          new ContainerBuilder()
            .setAccentColor(0xFF0000)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `<@${message.author.id}> **You are blacklisted**`
              )
            )
            .addSeparatorComponents(sep())
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `\`\`\`yml\nReason : ${reason}\`\`\``
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (mentionedBot) {
      return message.channel.send({
        components: [
          new ContainerBuilder()
            .setAccentColor(0x26272F)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `Hey ${message.author}, my prefix is \`${prefix}\`\n-# Type \`${prefix}help\` to get started`
              )
            )
            .addSeparatorComponents(sep())
            .addActionRowComponents((row) =>
              row.addComponents(
                new ButtonBuilder()
                  .setLabel("Invite")
                  .setStyle(ButtonStyle.Link)
                  .setURL("https://dsc.gg/aerox")
                  .setEmoji("1461812701973053480"),
                new ButtonBuilder()
                  .setLabel("Support")
                  .setStyle(ButtonStyle.Link)
                  .setURL("https://discord.gg/susmitaop")
                  .setEmoji("1461812634167808091")
              )
            ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (!cmd) return;

    const uid = message.author.id;
    const now = Date.now();
    const cooldownAmount = (cmd.cooldown || 3) * 1000;
    const cooldownKey = `${uid}-${cmd.name}`;

    if (commandCooldowns.has(cooldownKey)) {
      const expirationTime = commandCooldowns.get(cooldownKey);
      if (now < expirationTime) {
        const remaining = Math.ceil((expirationTime - now) / 1000);
        const msg = await message.channel.send({
          content: `${client.emoji.error} Please wait **${remaining}** seconds to use **${cmd.name}** again.`,
        });
        setTimeout(() => msg.delete().catch(() => {}), expirationTime - now);
        return;
      }
    }

    commandCooldowns.set(cooldownKey, now + cooldownAmount);
    setTimeout(() => commandCooldowns.delete(cooldownKey), cooldownAmount);

    // Global Bot Log for Command
    try {
      const logConfig = client.lmdbGet("global_botlogs_config");
      if (logConfig && logConfig.commandsChannelId) {
        const logChannel = client.channels.cache.get(logConfig.commandsChannelId) || 
                           await client.channels.fetch(logConfig.commandsChannelId).catch(() => null);
        if (logChannel) {
          logChannel.send({
            components: [
              new ContainerBuilder()
                .setAccentColor(0x7289DA)
                .addSectionComponents(
                  new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📝 Command Log`))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ size: 256 })))
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(
                    `### ⚙️ Command Details\n` +
                    `> **Command:** \`${prefix}${cmd.name}\`\n` +
                    `> **Arguments:** \`${args.join(" ") || "None"}\`\n\n` +
                    `### 👤 Executed By\n` +
                    `> **User:** ${message.author} | \`${message.author.tag}\` (\`${message.author.id}\`)\n\n` +
                    `### 📍 Location\n` +
                    `> **Server:** **${message.guild.name}** (\`${message.guild.id}\`)\n` +
                    `> **Channel:** ${message.channel} (\`${message.channel.id}\`)`
                  )
                )
            ],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("[Global Command Log Error]", err.message);
    }

    await cmd.run(client, message, args, prefix).catch((err) => {
      console.error(`[COMMAND ERROR] "${cmd.name}" failed:`, err);
    });
  });
};
