/**
 * Nooblu Security — Rate Limit System
 * Prevents command spam, nuking attempts, and ping abuse
 */

class RateLimiter {
    constructor(client) {
        this.client = client;

        // ─── CONFIG ───
        this.config = {
            // Per-user: max commands per window
            userMax: 3,
            userWindow: 8000, // 8 seconds

            // Per-guild: max commands from all users per window
            guildMax: 15,
            guildWindow: 8000, // 8 seconds

            // Global across all guilds (bot-wide protection)
            globalMax: 80,
            globalWindow: 8000, // 8 seconds

            // Lockout duration when limit exceeded
            userLockout: 60000,    // 60 seconds
            guildLockout: 120000,  // 120 seconds
            globalLockout: 60000,  // 60 seconds

            // Trusted users bypass (whitelist + owner)
            bypassOwners: true,
            bypassWhitelist: true,
        };

        // ─── TRACKERS ───
        this.userMap = new Map();      // userId:guildId -> { count, firstHit, lockedUntil }
        this.guildMap = new Map();     // guildId -> { count, firstHit, lockedUntil }
        this.globalTracker = { count: 0, firstHit: 0, lockedUntil: 0 };

        // Cleanup interval
        this._startCleanup();
    }

    /**
     * Check if message should be rate limited
     * @param {Message} message 
     * @returns {Object} { limited: boolean, reason: string|null }
     */
    check(message) {
        if (!message.guild) return { limited: false, reason: null }; // DMs allowed

        const now = Date.now();
        const userId = message.author.id;
        const guildId = message.guild.id;

        // ─── BYPASS CHECKS ───
        if (this.config.bypassOwners && userId === message.guild.ownerId) return { limited: false, reason: null };
        if (this.config.bypassWhitelist) {
            const wl = this.client._whitelistCache?.get(guildId);
            if (wl?.has(userId)) return { limited: false, reason: null };
        }

        // ─── GLOBAL CHECK ───
        const globalResult = this._checkGlobal(now);
        if (globalResult.limited) {
            this._logLimit("GLOBAL", "Bot-wide spam detected", null, userId);
            return { limited: true, reason: "global" };
        }

        // ─── GUILD CHECK ───
        const guildResult = this._checkGuild(guildId, now);
        if (guildResult.limited) {
            this._logLimit("GUILD", `Server ${message.guild.name}`, guildId, userId);
            return { limited: true, reason: "guild" };
        }

        // ─── USER CHECK ───
        const userResult = this._checkUser(userId, guildId, now);
        if (userResult.limited) {
            this._logLimit("USER", `User ${message.author.username}`, guildId, userId);
            return { limited: true, reason: "user" };
        }

        return { limited: false, reason: null };
    }

    /**
     * Get remaining time for lockout
     * @param {string} userId 
     * @param {string} guildId 
     * @returns {number} seconds remaining, 0 if not locked
     */
    getUserLockoutRemaining(userId, guildId) {
        const key = `${guildId}:${userId}`;
        const data = this.userMap.get(key);
        if (!data || !data.lockedUntil) return 0;
        const remaining = Math.ceil((data.lockedUntil - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
    }

    /**
     * Get remaining time for guild lockout
     * @param {string} guildId 
     * @returns {number} seconds remaining, 0 if not locked
     */
    getGuildLockoutRemaining(guildId) {
        const data = this.guildMap.get(guildId);
        if (!data || !data.lockedUntil) return 0;
        const remaining = Math.ceil((data.lockedUntil - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
    }

    // ─── PRIVATE CHECKERS ───

    _checkUser(userId, guildId, now) {
        const key = `${guildId}:${userId}`;
        let data = this.userMap.get(key);

        if (!data) {
            data = { count: 1, firstHit: now, lockedUntil: 0 };
            this.userMap.set(key, data);
            return { limited: false };
        }

        // Check if still locked out
        if (now < data.lockedUntil) {
            return { limited: true };
        }

        // Reset if window passed
        if (now - data.firstHit > this.config.userWindow) {
            data.count = 1;
            data.firstHit = now;
            data.lockedUntil = 0;
            return { limited: false };
        }

        data.count++;

        // Trigger lockout
        if (data.count > this.config.userMax) {
            data.lockedUntil = now + this.config.userLockout;
            return { limited: true };
        }

        return { limited: false };
    }

    _checkGuild(guildId, now) {
        let data = this.guildMap.get(guildId);

        if (!data) {
            data = { count: 1, firstHit: now, lockedUntil: 0 };
            this.guildMap.set(guildId, data);
            return { limited: false };
        }

        if (now < data.lockedUntil) {
            return { limited: true };
        }

        if (now - data.firstHit > this.config.guildWindow) {
            data.count = 1;
            data.firstHit = now;
            data.lockedUntil = 0;
            return { limited: false };
        }

        data.count++;

        if (data.count > this.config.guildMax) {
            data.lockedUntil = now + this.config.guildLockout;
            return { limited: true };
        }

        return { limited: false };
    }

    _checkGlobal(now) {
        const data = this.globalTracker;

        if (now < data.lockedUntil) {
            return { limited: true };
        }

        if (now - data.firstHit > this.config.globalWindow) {
            data.count = 1;
            data.firstHit = now;
            data.lockedUntil = 0;
            return { limited: false };
        }

        data.count++;

        if (data.count > this.config.globalMax) {
            data.lockedUntil = now + this.config.globalLockout;
            return { limited: true };
        }

        return { limited: false };
    }

    _logLimit(type, target, guildId, userId) {
        const now = new Date().toISOString();
        console.log(`[RATELIMIT] ${now} | ${type} | ${target} | Guild: ${guildId} | User: ${userId}`);
    }

    _startCleanup() {
        setInterval(() => {
            const now = Date.now();

            for (const [key, data] of this.userMap) {
                if (now > data.lockedUntil + this.config.userWindow) {
                    this.userMap.delete(key);
                }
            }

            for (const [key, data] of this.guildMap) {
                if (now > data.lockedUntil + this.config.guildWindow) {
                    this.guildMap.delete(key);
                }
            }
        }, 300000);
    }
}

module.exports = { RateLimiter };
