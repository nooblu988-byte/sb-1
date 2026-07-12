const { PermissionFlagsBits } = require("discord.js");
const { buildVcToggleCommand } = require("../../utils/vcModeration");

module.exports = buildVcToggleCommand({
    name: "vcmute",
    aliases: ["vcmuteall"],
    description: "Server-mute everyone (or specific tagged members) in your current voice channel",
    permission: PermissionFlagsBits.MuteMembers,
    permissionLabel: "MUTE_MEMBERS",
    verb: "mute",
    verbPast: "Muted",
    setVoiceState: (member, reason) => member.voice.setMute(true, reason),
});
