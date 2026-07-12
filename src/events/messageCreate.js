const {
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  SeparatorSpacingSize,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const { RateLimiter } = require("../utils/rateLimit");

const commandCooldowns = new Map();
const blacklistCooldown = new Map();
const rateLimitWarnings = new Map();

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
  const rateLimiter = new RateLimiter(client);

  client.on("rateLimit", () => applyGlobalLock());

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;
    if (globalLock) return;

    // ─── RATE LIMIT CHECK ───
    const rateCheck = rateLimiter.check(message);
    if (rateCheck.limited) {
      const warnKey = `${message.author.id}-${message.guild.id}`;
      const lastWarn = rateLimitWarnings.get(warnKey) || 0;
      const now = Date.now();

      if (now - lastWarn > 15000) {
        rateLimitWarnings.set(warnKey, now);

        let warnText = "⏳ **Rate Limited** — You are sending commands too fast. Please slow down.";

        if (rateCheck.reason === "user") {
          const remaining = rateLimiter.getUserLockoutRemaining(message.author.id, message.guild.id);
          warnText = `⏳ **Rate Limited** — Too many commands. Wait **${remaining}s** before using commands again.`;
        } else if (rateCheck.reason === "guild") {
          const remaining = rateLimiter.getGuildLockoutRemaining(message.guild.id);
          warnText = `⏳ **Server Rate Limited** — This server is sending too many commands. Wait **${remaining}s**.`;
        } else if (rateCheck.reason === "global") {
          warnText = `⏳ **Global Rate Limited** — Bot is under heavy load. Please wait a moment.`;
        }

        try {
          const warnMsg = await message.channel.send({ content: warnText });
          setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
        } catch (e) {}
      }
      return;
    }

    const perms = message.channel.permissionsFor(message.guild.members.me);
    if (!perms || !perms.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ])) return;

    // ═══════════════════════════════════════════════════════════════
    // 😀 AUTOREACT SYSTEM (NEW — runs on any message with mentions)
    // ═══════════════════════════════════════════════════════════════
    try {
      const autoreactKey = `autoreact_${message.guild.id}`;
      const autoreactData = client.lmdbGet(autoreactKey);

      if (autoreactData && message.mentions.users.size > 0) {
        const canReact = message.channel.permissionsFor(message.guild.members.me)?.has(PermissionFlagsBits.AddReactions);

        if (canReact) {
          for (const [userId, emoji] of Object.entries(autoreactData)) {
            if (message.mentions.users.has(userId)) {
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

    await cmd.run(client, message, args, prefix).catch((err) => {
      console.error(`[COMMAND ERROR] "${cmd.name}" failed:`, err);
    });
  });
};
