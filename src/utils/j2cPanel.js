'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ACCENT = 0x8C6BFF;

function buildPanelMessage() {
    const embed = new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('🎚️ Room Control Deck')
        .setDescription(
            'Join **Join 2 Create** (or **Join 2 Create Duo**) below to spin up your own private room.\n' +
            'Once you\'re inside it, use the buttons here to manage it — only you (the room owner) can use them.'
        )
        .addFields(
            { name: '🔐 Access', value: '`Lock` `Unlock` `Hide` `Unhide`', inline: false },
            { name: '👥 Roster', value: '`Invite` `Block` `Permit` `Limit`', inline: false },
            { name: '🛠️ Customize', value: '`Rename` `Bitrate` `Region` `Reset`', inline: false },
            { name: '👑 Ownership', value: '`Chat` `Waitlist` `Claim` `Transfer`', inline: false },
        )
        .setFooter({ text: 'Room Control Deck • you must be sitting in your own room to use these' });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_unlock').setLabel('Unlock').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_hide').setLabel('Hide').setEmoji('🙈').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_unhide').setLabel('Unhide').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_invite').setLabel('Invite').setEmoji('➕').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('j2c_action_block').setLabel('Block').setEmoji('⛔').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('j2c_action_permit').setLabel('Permit').setEmoji('✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('j2c_action_limit').setLabel('Limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('j2c_action_bitrate').setLabel('Bitrate').setEmoji('🎚️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('j2c_action_region').setLabel('Region').setEmoji('🌐').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('j2c_action_reset').setLabel('Reset').setEmoji('♻️').setStyle(ButtonStyle.Secondary),
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('j2c_action_chat').setLabel('Chat').setEmoji('💬').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_waitlist').setLabel('Waitlist').setEmoji('⏳').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('j2c_action_claim').setLabel('Claim').setEmoji('👑').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('j2c_action_transfer').setLabel('Transfer').setEmoji('🔁').setStyle(ButtonStyle.Primary),
    );

    return { embeds: [embed], components: [row1, row2, row3, row4] };
}

module.exports = { buildPanelMessage, ACCENT };
