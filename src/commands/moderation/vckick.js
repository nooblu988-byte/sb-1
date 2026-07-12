const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");
const { resolveVcTargets, checkVcHierarchy, HIERARCHY_REASON_TEXT } = require("../../utils/vcModeration");

module.exports = {
    name: "vckick",
    aliases: ["vckickall"],
    description: "Kick everyone (or specific tagged members) from your current voice channel",
    category: "moderation",
    cooldown: 5,
    run: async (client, message, args, prefix) => {

        const errorContainer = (text) => {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return { components: [container], flags: MessageFlags.IsComponentsV2 };
        };

        if (!message.member.permissions.has(PermissionFlagsBits.MoveMembers)) {
            return message.channel.send(errorContainer(`${client.emoji.error} | You need the **\`MOVE_MEMBERS\`** permission to use this command.`));
        }

        if (!message.guild.members.me.permissions.has(PermissionFlagsBits.MoveMembers)) {
            return message.channel.send(errorContainer(`${client.emoji.error} | I need the **\`MOVE_MEMBERS\`** permission to do this.`));
        }

        if (!args[0]) {
            return message.channel.send(errorContainer(
                `${client.emoji.error} | **Usage:**\n` +
                `\`${prefix}vckick all\` — kick everyone from your VC\n` +
                `\`${prefix}vckick @user1 @user2\` — kick specific members from your VC`
            ));
        }

        const { vc, targets, notInVc, error } = resolveVcTargets(message, args);

        if (error === "not_in_vc") {
            return message.channel.send(errorContainer(`${client.emoji.error} | You need to be in a **voice channel** to use this command.`));
        }
        if (error === "no_target") {
            return message.channel.send(errorContainer(`${client.emoji.error} | Mention at least one member, or use \`${prefix}vckick all\`.`));
        }
        if (targets.length === 0) {
            return message.channel.send(errorContainer(`${client.emoji.error} | No valid members to kick from **${vc.name}**.`));
        }

        let kicked = 0, blocked = 0, failed = 0;
        const blockedNames = [];

        for (const member of targets) {
            const reason = checkVcHierarchy(message.guild, message.member, member);
            if (reason) {
                blocked++;
                blockedNames.push(`${member.user.username} (${HIERARCHY_REASON_TEXT[reason]})`);
                continue;
            }
            try {
                await member.voice.disconnect(`VC kicked by ${message.author.tag}`);
                kicked++;
            } catch {
                failed++;
            }
        }

        let resultText = `${client.emoji.tick2} | Kicked **${kicked}** member${kicked !== 1 ? "s" : ""} from **${vc.name}**.`;
        if (notInVc?.length) resultText += `\n-# ${notInVc.length} mentioned member${notInVc.length !== 1 ? "s aren't" : " isn't"} in that VC — skipped.`;
        if (blocked) resultText += `\n-# ${blocked} skipped: ${blockedNames.slice(0, 5).join(", ")}${blockedNames.length > 5 ? "…" : ""}`;
        if (failed) resultText += `\n-# ${failed} failed (connection issue or left VC).`;

        await message.channel.send({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(resultText))],
            flags: MessageFlags.IsComponentsV2,
        });
    }
};
