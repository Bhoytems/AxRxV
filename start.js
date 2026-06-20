const db = require('../db');
const { mention } = require('../utils/format');

const REWARD_START_BOT_TASK = parseInt(process.env.REWARD_START_BOT_TASK || '10', 10);

function mainMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ VERIFY', callback_data: 'verify_start' }],
        [{ text: '💰 WITHDRAW', callback_data: 'withdraw' }],
      ],
    },
  };
}

async function handleStart(ctx) {
  const tgUser = ctx.from;
  const user = await db.upsertUser(tgUser.id, tgUser.username, tgUser.first_name);

  // Handle referral payload: /start ref_123456789
  const payload = ctx.startPayload; // telegraf strips "/start " for us
  if (payload && payload.startsWith('ref_')) {
    const referrerId = parseInt(payload.replace('ref_', ''), 10);
    if (!isNaN(referrerId)) {
      await db.setReferredBy(tgUser.id, referrerId);
    }
  }

  // Award "start bot" task once
  const justCompleted = await db.markStartedBotTaskDone(tgUser.id);
  if (justCompleted) {
    await db.addBalance(tgUser.id, REWARD_START_BOT_TASK);

    const botUsername = process.env.BOT_USERNAME;
    const text = `${mention(tgUser.id, tgUser.username, tgUser.first_name)} completed the bot task (${botUsername})`;

    if (process.env.MVG_CHAT_ID) {
      ctx.telegram
        .sendMessage(process.env.MVG_CHAT_ID, text, { parse_mode: 'Markdown' })
        .catch((err) => console.error('[start] failed to post to MVG:', err.message));
    }
  }

  await ctx.reply(
    `Welcome to *Makyton*, ${mention(tgUser.id, tgUser.username, tgUser.first_name)}!\n\n` +
      `Complete tasks, earn *$MYT*, and get verified as a Makytian.\n\n` +
      `Tap *VERIFY* to submit your MATIC wallet address, or *WITHDRAW* to check withdrawal status.`,
    { parse_mode: 'Markdown', ...mainMenuKeyboard() }
  );
}

module.exports = { handleStart, mainMenuKeyboard };
