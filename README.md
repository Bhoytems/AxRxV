# Makyton Bot

A Web3-flavored Telegram bot that rewards users with **$MYT** (an in-app point
balance, no token contract yet) for completing Telegram-based tasks, and
verifies users as "Makytians" by collecting their MATIC wallet address.

## What it does

- Welcomes new members in your main group with a **GET VERIFIED** button
- `/start` in DM shows **VERIFY** and **WITHDRAW** buttons
- **VERIFY** → collects a MATIC wallet address → posts the user's Telegram
  username, Telegram ID, and wallet address to your **Makyton Verification
  Group (MVG)** → announces "@username has become a Makytian" in the main group
- **WITHDRAW** → replies that distribution isn't live yet
- Tasks, paid automatically and logged to the MVG:
  - Join the channel/group — **15 $MYT**
  - Start the bot — **10 $MYT**
  - Refer a new verified user — **10 $MYT**
- `/stats` — top 50 leaderboard by $MYT balance
- `/stats @username` — a specific user's stats
- `/refcode` — generates a personal referral deep link
- All balances and verification records are stored permanently in Postgres —
  deleting a message in the MVG does **not** affect a user's balance or status

## 1. Create the bot with BotFather

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`, choose a name (e.g. `Makyton`) and a username ending in
   `bot` (e.g. `MakytonBot`)
3. Save the **token** it gives you — this is `BOT_TOKEN`
4. Send `/setprivacy` for your bot, select it, and set privacy to **Disable**
   — this lets the bot see join/leave messages and commands properly in groups
5. Send `/setjoingroups` → **Enable**

## 2. Set up your groups/channel

You'll need:
- **Main group** — where members get welcomed and where `/stats` and
  `/refcode` are used. Add the bot as a member.
- **Makyton Verification Group (MVG)** — where verification + task logs are
  posted. Add the bot here too.
- *(Optional)* a **channel** if "join channel" is a separate target from the
  main group. Add the bot as an **admin** here (required to detect joins).

To get each chat's numeric ID:
1. Add the bot to the group/channel
2. Send any message in it
3. Temporarily check your Railway logs (every incoming chat ID isn't logged
   by default — easiest is to add `@userinfobot` or `@RawDataBot` to the
   group for a moment, or check the logs after wiring `console.log(ctx.chat)`
   in `index.js` if needed)

Group/channel IDs are negative numbers (e.g. `-1001234567890`).

## 3. Configure environment variables

Copy `.env.example` to `.env` for local testing, and set the same variables
in Railway's dashboard (Variables tab) for deployment:

| Variable | Description |
|---|---|
| `BOT_TOKEN` | From BotFather |
| `BOT_USERNAME` | Your bot's username, no `@` |
| `DATABASE_URL` | Auto-filled by Railway's Postgres plugin |
| `PGSSL` | `true` if your Postgres requires SSL (usually yes on Railway's public URL) |
| `MVG_CHAT_ID` | Makyton Verification Group chat ID |
| `MAIN_GROUP_ID` | Main group chat ID |
| `TARGET_CHANNEL_ID` | (Optional) channel ID for the join task |
| `TARGET_CHANNEL_USERNAME` | (Optional) display name used in task messages |
| `REWARD_JOIN_TASK` | Default `15` |
| `REWARD_START_BOT_TASK` | Default `10` |
| `REWARD_REFERRAL` | Default `10` |

## 4. Deploy to Railway

1. Push this project to a GitHub repo (or use Railway's CLI to deploy
   directly from this folder)
2. In Railway: **New Project → Deploy from GitHub repo**, select this repo
3. Add a **Postgres** plugin to the project (Railway auto-injects
   `DATABASE_URL` into your bot service)
4. In your bot service's **Variables** tab, add all the variables from the
   table above
5. Railway will detect `npm start` automatically from `package.json` and
   deploy. Check the **Deployments → Logs** tab — you should see:
   ```
   [db] schema ready
   [makyton] bot is running
   ```
6. The database table is created automatically on first boot — no manual
   migration step needed

## 5. Local testing (optional, before deploying)

```bash
npm install
cp .env.example .env   # fill in your values
npm start
```

You'll need a local or cloud Postgres instance reachable via `DATABASE_URL`
for local testing (e.g. `docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass postgres`).

## Notes & things to revisit later

- **Polling vs webhook**: the bot currently uses long polling, which is the
  simplest setup on Railway and fine for moderate user counts. If you scale
  up significantly, switching to a webhook (using Railway's public URL) will
  reduce latency — ask me when you're ready and I'll wire it up.
- **Channel join detection** requires the bot to be an **admin** of that
  channel. If you only care about the main group, you can leave
  `TARGET_CHANNEL_ID` blank — the group join already covers the task.
- **Referral payout timing**: referrers are paid once the *referred* user
  completes wallet verification (not just on `/start`), to avoid fake-account
  abuse. Let me know if you'd rather pay out earlier.
- **$MYT is in-app only** right now — no token contract, no on-chain
  transfers. Wallet addresses are stored for future use (e.g. an eventual
  airdrop), but nothing automated touches them yet.
- **Automated on-chain withdrawals** were intentionally left out, as discussed.
  When you're ready to build that, it'll need careful handling of a hot
  wallet's private key and a real $MYT token contract.
