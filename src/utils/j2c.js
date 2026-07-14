'use strict';

const { PermissionFlagsBits } = require('discord.js');

const cfgKey     = (gid) => `j2c_cfg_${gid}`;
const channelKey = (cid) => `j2c_channel_${cid}`;

const getConfig = (client, gid) => client.lmdbGet(cfgKey(gid)) || null;
const setConfig = (client, gid, data) => client.lmdbSet(cfgKey(gid), data);

const getChannelData = (client, cid) => client.lmdbGet(channelKey(cid)) || null;
const setChannelData = (client, cid, data) => client.lmdbSet(channelKey(cid), data);
const delChannelData = (client, cid) => client.lmdbDel(channelKey(cid));

function defaultRoomState(ownerId, isDuo) {
    return {
        ownerId,
        isDuo: !!isDuo,
        locked: false,
        hidden: false,
        chatLocked: false,
        waitingEnabled: false,
        bannedIds: [],
        permittedIds: [],
        waitingList: [],
    };
}

function isOwner(client, channelId, userId) {
    const data = getChannelData(client, channelId);
    return !!data && data.ownerId === userId;
}

function canControl(member, channelId, client) {
    if (isOwner(client, channelId, member.id)) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return false;
}

module.exports = {
    getConfig,
    setConfig,
    getChannelData,
    setChannelData,
    delChannelData,
    defaultRoomState,
    isOwner,
    canControl,
};
