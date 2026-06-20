const db = require('../db');
const { mention } = require('../utils/format');

async function handleStats(ctx) {
  const args = ctx.message.text.trim().split(/\s+/).slice(1);

  if (args.length === 0) {
    return sendLeaderboard(ctx);
  }

  return sendPersonalStats(ctx, args[0]);
}

async function sendLeaderboard(ctx) {
  const top = await db.getTopUsers(50);
  if (top.length === 0) {
    return ctx.reply('No stats yet — be the first to earn $MYT!');
  }

  const lines = top.map((u, i) => {
    const name = u.username ? `@${u.username}` : u.first_name || `User ${u.telegram_id}`;
    return `${i + 1}. ${name} — ${u.balance} $MYT`;
  });

  await ctx.reply(`🏆 *Makyton Leaderboard (Top ${top.length})*\n\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
  });
}

async function sendPersonalStats(ctx, usernameArg) {
  const user = await db.getUserByUsername(usernameArg);
  if (!user) {
    return ctx.reply(`No record found for ${usernameArg}. They may not have started the bot yet.`);
  }

  const name = mention(user.telegram_id, user.username, user.first_name);
  const text =
    `📊 *Stats for ${name}*\n\n` +
    `Balance: *${user.balance} $MYT*\n` +
    `Verified Makytian: ${user.verified ? '✅ Yes' : '❌ No'}\n` +
    `Joined channel/group task: ${user.joined_task_done ? '✅' : '❌'}\n` +
    `Started bot task: ${user.started_bot_task_done ? '✅' : '❌'}\n` +
    `Successful referrals: ${user.referral_count}`;

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = { handleStats };
