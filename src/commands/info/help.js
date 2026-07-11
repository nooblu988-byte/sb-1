const fs = require("fs");
const path = require("path");
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    SeparatorSpacingSize,
    ButtonStyle,
    MessageFlags,
} = require("discord.js");


module.exports = {
    name: "help",
    aliases: ["h", "commands", "cmds"],
    description: "View all available commands",
    category: "info",
    cooldown: 3,

    run: async (client, message) => {
        let prefix = client.config.prefix;
        const prefixData = await client.db.get(`prefix_${message.guild.id}`);
        if (prefixData) prefix = prefixData;

        const commandsPath = path.join(__dirname, "..");
        const categories = fs.readdirSync(commandsPath)
            .filter(d => fs.statSync(path.join(commandsPath, d)).isDirectory())
            .filter(c => !["owner", "subscription"].includes(c.toLowerCase()));

        const getCommands = (cat) => {
            const dir = path.join(commandsPath, cat);
            if (!fs.existsSync(dir)) return [];
            return fs.readdirSync(dir)
                .filter(f => f.endsWith(".js"))
                .map(f => require(path.join(dir, f)))
                .filter(c => c?.name);
        };

        const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        const sep  = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
        const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

        const makeDropdown = (selected = null) =>
            new StringSelectMenuBuilder()
                .setCustomId("help-category")
                .setPlaceholder(selected ? capitalize(selected) : "Browse by category")
                .addOptions(
                    categories.map((cat, i) => ({
                        label: `${i + 1}. ${capitalize(cat)}`,
                        value: cat,
                        default: cat === selected,
                    }))
                );

        const makeNavButtons = (homeDisabled) =>
            new ButtonBuilder()
                .setCustomId("home")
                .setLabel("Home")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(homeDisabled);

        const makeListButton = (listDisabled) =>
            new ButtonBuilder()
                .setCustomId("list")
                .setLabel("All Commands")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(listDisabled);

        const buildHome = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${client.user.username}\n` +
                        `-# Prefix: \`${prefix}\` — ${categories.length} categories`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `Hey there! ${client.emoji.automod}\nWelcome to **${client.user.username}** — your all-in-one server protection bot.\nUse the dropdown below to explore commands by category, or hit **All Commands** for a full overview.`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `[Invite Me](${client.config.inviteURL})  |  [Support Server](${client.config.support_server_link})`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(true), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown()));

        const buildList = () => {
            const container = new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("## All Commands")
                )
                .addSeparatorComponents(sep());

            categories.forEach((cat, index) => {
                const cmds = getCommands(cat).map(c => `\`${c.name}\``).join("  ") || "None";
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${index + 1}. ${capitalize(cat)}**\n${cmds}`
                    )
                );
                if (index < categories.length - 1) container.addSeparatorComponents(thin());
            });

            return container
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(true))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown()));
        };

        const buildAntinukeCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Antinuke**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}antinuke\`\n` +
                        `${client.emoji.arrow} \`${prefix}antinuke enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antinuke disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antinuke status\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Whitelist**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}whitelist\`\n` +
                        `${client.emoji.arrow} \`${prefix}whitelist add <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}whitelist remove <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}whitelist show\`\n` +
                        `${client.emoji.arrow} \`${prefix}multiwhitelist add <@user1> <@user2> <@user3> ...\`\n` +
                        `${client.emoji.arrow} \`${prefix}multiwhitelist remove <@user1> <@user2> <@user3> ...\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Extraowner**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}extraowner\`\n` +
                        `${client.emoji.arrow} \`${prefix}extraowner add\`\n` +
                        `${client.emoji.arrow} \`${prefix}extraowner remove\`\n` +
                        `${client.emoji.arrow} \`${prefix}extraowner show\``
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("antinuke")));

        const buildAutomodCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Automod**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}automod\`\n` +
                        `${client.emoji.arrow} \`${prefix}automod enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}automod disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}automod status\`\n` +
                        `${client.emoji.arrow} \`${prefix}amsetup\` — Full setup`
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**User Whitelist**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}amwhitelist add <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amwhitelist remove <@user>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amwhitelist show\`\n` +
                        `${client.emoji.arrow} \`${prefix}amwhitelist reset\`\n` +
                        `${client.emoji.arrow} \`${prefix}ammultiwhitelist add <@user1> <@user2> ...\`\n` +
                        `${client.emoji.arrow} \`${prefix}ammultiwhitelist remove <@user1> <@user2> ...\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Channel & Role Whitelist**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}amchannelwl add #channel\`\n` +
                        `${client.emoji.arrow} \`${prefix}amchannelwl remove #channel\`\n` +
                        `${client.emoji.arrow} \`${prefix}amchannelwl show\`\n` +
                        `${client.emoji.arrow} \`${prefix}amrolewl add @role\`\n` +
                        `${client.emoji.arrow} \`${prefix}amrolewl remove @role\`\n` +
                        `${client.emoji.arrow} \`${prefix}amrolewl show\``
                    )
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Custom Filter & History**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}amfilter add <word>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amfilter remove <word>\`\n` +
                        `${client.emoji.arrow} \`${prefix}amfilter show\`\n` +
                        `${client.emoji.arrow} \`${prefix}amfilter reset\`\n` +
                        `${client.emoji.arrow} \`${prefix}amhistory <@user>\` — View strikes & violations`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("automod")));

        const buildLoggingCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Logging**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}logging\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging status\`\n` +
                        `${client.emoji.arrow} \`${prefix}logging setup\` — Configure channels per event group`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("logging")));

        const buildAntiraidCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**AntiRaid**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}antiraid\`\n` +
                        `${client.emoji.arrow} \`${prefix}antiraid enable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antiraid disable\`\n` +
                        `${client.emoji.arrow} \`${prefix}antiraid status\`\n` +
                        `${client.emoji.arrow} \`${prefix}arsetup\` — Full module setup`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("antiraid")));

        const buildVerificationCategory = () =>
            new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent("**Verification**")
                )
                .addSeparatorComponents(thin())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${client.emoji.arrow} \`${prefix}verification\`\n` +
                        `${client.emoji.arrow} \`${prefix}verification setup\` — Create role, channel & hide all others\n` +
                        `${client.emoji.arrow} \`${prefix}verification disable\` — Remove verification system\n` +
                        `${client.emoji.arrow} \`${prefix}verification status\` — View current configuration`
                    )
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown("verification")));

        const buildCategory = (cat) => {
            if (cat.toLowerCase() === "antinuke")     return buildAntinukeCategory();
            if (cat.toLowerCase() === "automod")      return buildAutomodCategory();
            if (cat.toLowerCase() === "logging")      return buildLoggingCategory();
            if (cat.toLowerCase() === "antiraid")     return buildAntiraidCategory();
            if (cat.toLowerCase() === "verification") return buildVerificationCategory();

            const cmds = getCommands(cat).map(c => `\`${c.name}\``).join("  ") || "None";
            return new ContainerBuilder()
                .setAccentColor(0x26272F)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${capitalize(cat)}`)
                )
                .addSeparatorComponents(sep())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(cmds)
                )
                .addSeparatorComponents(sep())
                .addActionRowComponents((row) =>
                    row.addComponents(makeNavButtons(false), makeListButton(false))
                )
                .addActionRowComponents((row) => row.addComponents(makeDropdown(cat)));
        };

        const msg = await message.reply({
            components: [buildHome()],
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = msg.createMessageComponentCollector({
            filter: (i) => {
                if (i.user.id !== message.author.id) {
                    i.reply({ content: "Only the command author can use this menu.", ephemeral: true });
                    return false;
                }
                return true;
            },
            time: 0,
        });

        collector.on("collect", async (i) => {
            if (i.customId === "home") {
                return i.update({ components: [buildHome()], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.customId === "list") {
                return i.update({ components: [buildList()], flags: MessageFlags.IsComponentsV2 });
            }

            if (i.values?.[0]) {
                return i.update({ components: [buildCategory(i.values[0])], flags: MessageFlags.IsComponentsV2 });
            }
        });
    },
};
