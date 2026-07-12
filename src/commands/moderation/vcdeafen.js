const { PermissionFlagsBits } = require("discord.js");
const { buildVcToggleCommand } = require("../../utils/vcModeration");

module.exports = buildVcToggleCommand({
    name: "vcdeafen",
    aliases: ["vcdeafenall", "vcdeaf"],
    description: "Server-deafen everyone (or specific tagged members) in your current voice channel",
    permission: PermissionFlagsBits.DeafenMembers,
    permissionLabel: "DEAFEN_MEMBERS",
    verb: "deafen",
    verbPast: "Deafened",
    setVoiceState: (member, reason) => member.voice.setDeaf(true, reason),
});
