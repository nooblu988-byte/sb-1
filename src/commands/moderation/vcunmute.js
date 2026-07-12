const { PermissionFlagsBits } = require("discord.js");
const { buildVcToggleCommand } = require("../../utils/vcModeration");

module.exports = buildVcToggleCommand({
    name: "vcunmute",
    aliases: ["vcunmuteall"],
    description: "Remove the server-mute from everyone (or specific tagged members) in your current voice channel",
    permission: PermissionFlagsBits.MuteMembers,
    permissionLabel: "MUTE_MEMBERS",
    verb: "unmute",
    verbPast: "Unmuted",
    setVoiceState: (member, reason) => member.voice.setMute(false, reason),
});
