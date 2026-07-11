# AeroX Security Bot

A high-performance Discord security and moderation bot built to protect servers from nuking, raiding, spam, and other threats — with blazing-fast response times and automatic recovery.

---

## Credits

- **Base Bot** — [satyansh_32](https://dsc.gg/ratiogg)
- **Updated & Modified by** — itsfizys
- **Support Server** — [discord.gg/aerox](https://discord.gg/aerox)

---

## Features

### Antinuke
High-speed protection against unauthorized server destruction. The bot monitors audit logs in real time and instantly bans any user performing restricted actions — even those with Administrator permissions — unless they are the Server Owner or whitelisted.

**Monitored actions:**
- Channel create / delete / update
- Role create / delete / update
- Webhook create / update
- Guild updates (name, icon, vanity URL)
- Integration changes
- Mass bans / kicks / unbans
- Unauthorized bot additions

**Auto-recovery:** Deleted channels and roles are automatically restored. Unauthorized guild changes are reverted. Re-bans are issued if a protected user is unbanned without permission.

---

### AntiRaid
Stops server raids by monitoring member join patterns.

| Module | Description |
|---|---|
| Anti Mass Join | Detects and blocks rapid join bursts |
| Account Age Filter | Blocks accounts below a minimum age |
| Bot Filter | Blocks unauthorized bots from joining |

---

### Automod
Advanced message filtering with a strike-based escalation system.

| Module | Description |
|---|---|
| Anti Promotion / Links | Blocks unauthorized invite links and URLs |
| Anti Spam | Prevents message flooding |
| Anti Mass Mention | Limits bulk user/role mentions |
| Anti Mass Image / Forward | Controls image and forward spam |
| Anti Abuse | Filters abusive content |
| Anti NSFW | Blocks explicit content |
| Anti Caps | Limits excessive capitalization |
| Anti Emoji Spam | Prevents emoji flooding |

**Strike system:** Violations are tracked per user. Punishments escalate automatically — Delete → Timeout → Kick → Ban — based on a configurable threshold.

---

### Verification
A captcha-based onboarding system to keep bot accounts out of your server. A dedicated verification channel is created, and all other channels remain hidden until the user completes the captcha.

---

### Moderation
Standard moderation tools for server management.

| Command | Description |
|---|---|
| `ban` | Ban a member |
| `kick` | Kick a member |
| `mute` | Timeout a member |
| `unban` | Unban a user |
| `purge` | Bulk delete messages |
| `role` | Manage member roles |
| `hide` | Hide a channel |
| `lock` | Lock a channel |

---

### Info & Utility

| Command | Description |
|---|---|
| `help` | Show the help menu |
| `ping` | Check bot latency |
| `stats` | View bot statistics |
| `userinfo` | Display user information |
| `serverinfo` | Display server information |
| `avatar` | Fetch a user's avatar |
| `banner` | Fetch a user's banner |
| `prefix` | Change the bot prefix |

---

## Commands Reference

| Category | Commands |
|---|---|
| Antinuke | `antinuke`, `whitelist`, `multiwhitelist`, `extraowner` |
| AntiRaid | `antiraid`, `arsetup` |
| Automod | `automod`, `amsetup`, `amwhitelist`, `amchannelwl`, `amrolewl`, `amfilter`, `amhistory` |
| Verification | `verification setup`, `verification status`, `verification disable` |
| Moderation | `ban`, `kick`, `mute`, `unban`, `purge`, `role`, `hide`, `lock` |
| Info / Utility | `help`, `ping`, `stats`, `userinfo`, `serverinfo`, `avatar`, `banner`, `prefix` |

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | JavaScript (Node.js) |
| Discord Library | discord.js v14 |
| Sharding | Discord Hybrid Sharding |
| Primary Database | MongoDB (via quickmongo) |
| High-Speed Cache | LMDB (Lightning Memory-Mapped Database) |
| Networking | undici (Pool/Dispatch) |
| Image Processing | canvas, canvacord |

---

## Architecture Notes

- **Priority execution:** The bot process runs at the highest OS priority (`-20`) to ensure security events are handled before anything else.
- **Task queue:** A batching task queue allows the bot to issue mass bans rapidly during a nuke attempt without hitting rate limits.
- **Local cache:** Antinuke status and whitelists are stored in LMDB for near-instant reads with zero database latency during critical events.

---

## Setup

1. Clone the repository.
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your environment variables (MongoDB URI, bot token, etc.).
4. Start the bot:
   ```
   node src/cluster.js
   ```
   To run without sharding:
   ```
   node src/index.js
   ```

---

## Support

Join the support server for help, updates, and announcements:
**[discord.gg/aerox](https://discord.gg/aerox)**
