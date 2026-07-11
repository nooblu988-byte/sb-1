/**
 * Nooblu Security — Clean UI Utility
 * Import this in any command for consistent theming
 * 
 * Usage:
 *   const { CleanUI } = require("../../utils/premiumStyles");
 *   const ui = new CleanUI();
 *   const container = ui.container("Title", "description", "success");
 */

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} = require("discord.js");

class CleanUI {
    constructor() {
        this.THEME = {
            primary: 0x5865F2,
            success: 0x57F287,
            danger: 0xED4245,
            warning: 0xFEE75C,
            dark: 0x23272A,
            gray: 0x2C2F33,
        };
    }

    /**
     * Build a clean container
     * @param {string} title 
     * @param {string} content 
     * @param {string} type — "primary" | "success" | "danger" | "warning" | "dark" | "gray"
     * @param {Array} extraSections — Optional extra {content: string} or {divider: true}
     * @returns {ContainerBuilder}
     */
    container(title, content, type = "primary", extraSections = []) {
        const color = this.THEME[type] || this.THEME.primary;

        const c = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## **${title}**`))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

        if (extraSections.length > 0) {
            extraSections.forEach(section => {
                if (section.divider) {
                    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(section.spacing || SeparatorSpacingSize.Small));
                } else if (section.content) {
                    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(section.content));
                }
            });
        }

        return c;
    }

    /**
     * Compact notification (no header)
     * @param {string} content 
     * @param {string} type 
     * @returns {ContainerBuilder}
     */
    notify(content, type = "primary") {
        const color = this.THEME[type] || this.THEME.primary;
        return new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }

    /**
     * Confirmation preview container
     * @param {string} actionTitle 
     * @param {string} targetName 
     * @param {string} targetId 
     * @param {string} actionDetails 
     * @param {string} moderatorName 
     * @param {string} type — "warning" | "primary"
     * @returns {ContainerBuilder}
     */
    confirm(actionTitle, targetName, targetId, actionDetails, moderatorName, type = "warning") {
        const color = type === "warning" ? this.THEME.warning : this.THEME.primary;
        return new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## **${actionTitle}**`))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**Target:** [${targetName}](https://discord.com/users/${targetId})\n` +
                `**Action:** ${actionDetails}\n` +
                `**Moderator:** ${moderatorName}\n\n` +
                `*Are you sure you want to proceed?*`
            ));
    }

    /**
     * Success result container
     * @param {string} action 
     * @param {string} targetName 
     * @param {string} targetId 
     * @param {string} moderatorName 
     * @param {string} extraInfo 
     * @returns {ContainerBuilder}
     */
    success(action, targetName, targetId, moderatorName, extraInfo = "") {
        let content = `**User:** [${targetName}](https://discord.com/users/${targetId})\n` +
            `**Action:** ${action}\n` +
            `**Moderator:** ${moderatorName}`;
        if (extraInfo) content += `\n\n${extraInfo}`;

        return new ContainerBuilder()
            .setAccentColor(this.THEME.success)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## **Success**`))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`*Action logged successfully.*`));
    }

    /**
     * Error container
     * @param {string} title 
     * @param {string} reason 
     * @param {Array} solutions 
     * @returns {ContainerBuilder}
     */
    error(title, reason, solutions = []) {
        let content = `**${reason}**`;
        if (solutions.length > 0) {
            content += `\n\n**Possible solutions:**\n`;
            solutions.forEach(sol => content += `• ${sol}\n`);
        }

        return new ContainerBuilder()
            .setAccentColor(this.THEME.danger)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## **${title}**`))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    }

    /**
     * Permission denied
     * @param {string} permission 
     * @returns {ContainerBuilder}
     */
    denied(permission) {
        return this.container("Access Denied", `You need the **${permission}** permission to use this command.`, "danger");
    }

    /**
     * Confirm + Cancel buttons
     * @param {string} confirmId 
     * @param {string} cancelId 
     * @param {string} confirmLabel 
     * @param {string} cancelLabel 
     * @returns {ActionRowBuilder}
     */
    buttons(confirmId, cancelId, confirmLabel = "Confirm", cancelLabel = "Cancel") {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(confirmId).setLabel(confirmLabel).setStyle(ButtonStyle.Success).setEmoji("✅"),
            new ButtonBuilder().setCustomId(cancelId).setLabel(cancelLabel).setStyle(ButtonStyle.Danger).setEmoji("❌")
        );
    }

    /**
     * Custom button row
     * @param {Array} buttons — { id, label, style, emoji, url? }
     * @returns {ActionRowBuilder}
     */
    buttonRow(buttons) {
        const row = new ActionRowBuilder();
        buttons.forEach(btn => {
            const builder = new ButtonBuilder()
                .setLabel(btn.label)
                .setStyle(btn.url ? ButtonStyle.Link : (btn.style || ButtonStyle.Secondary))
                .setEmoji(btn.emoji || "🔘");
            if (btn.url) builder.setURL(btn.url);
            else builder.setCustomId(btn.id);
            row.addComponents(builder);
        });
        return row;
    }

    userLink(username, userId) {
        return `[${username}](https://discord.com/users/${userId})`;
    }

    codeBlock(prefix, command, args = "") {
        return `\`\`\`\n${prefix}${command} ${args}\n\`\`\``;
    }
}

module.exports = { CleanUI };
