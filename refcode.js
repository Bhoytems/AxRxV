const db = require('../db');

async function handleRefCode(ctx) {
  const tgUser = ctx.from;
  await db.upsertUser(tgUser.id, tgUser.username, tgUser.first_name);

  const botUsername = process.env.BOT_USERNAME;
  const link = `https://t.me/${botUsername}?start=ref_${tgUser.id}`;

  await ctx.reply(
    `🔗 *Your personal referral link:*\n${link}\n\n` +
      `Share it — when someone joins through your link and gets verified as a Makytian, ` +
      `you'll automatically earn $MYT.`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { handleRefCode };
