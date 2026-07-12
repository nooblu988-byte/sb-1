const { PermissionFlagsBits } = require("discord.js");
const { buildVcToggleCommand } = require("../../utils/vcModeration");

module.exports = buildVcToggleCommand({
    name: "vcundeafen",
    aliases: ["vcundeafenall", "vcundeaf"],
    description: "Remove the server-deafen from everyone (or specific tagged members) in your current voice channel",
    permission: PermissionFlagsBits.DeafenMembers,
    permissionLabel: "DEAFEN_MEMBERS",
    verb: "undeafen",
    verbPast: "Undeafened",
    setVoiceState: (member, reason) => member.voice.setDeaf(false, reason),
});
