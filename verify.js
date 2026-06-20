const db = require('../db');
const { mention, isValidMaticAddress } = require('../utils/format');
const { mainMenuKeyboard } = require('./start');

const REWARD_REFERRAL = parseInt(process.env.REWARD_REFERRAL || '10', 10);

async function onVerifyButton(ctx) {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);

  if (user && user.verified) {
    return ctx.reply('✅ You are already a verified Makytian.');
  }

  await db.setAwaitingWallet(ctx.from.id, true);
  await ctx.reply(
    'Please send your *MATIC (Polygon) wallet address*.\n\n' +
      'Example:\n`0xA1b2C3d4E5f6789012345678901234567890aBcD`',
    { parse_mode: 'Markdown' }
  );
}

async function onWithdrawButton(ctx) {
  await ctx.answerCbQuery();
  await ctx.reply('⏳ Distribution date will be out soon, gain enough token first.');
}

// Called from the global text handler in index.js when a user is mid-verification.
async function onWalletMessage(ctx) {
  const address = ctx.message.text.trim();

  if (!isValidMaticAddress(address)) {
    return ctx.reply(
      '❌ That doesn\'t look like a valid MATIC wallet address. It should start with `0x` ' +
        'followed by 40 characters. Please send it again.',
      { parse_mode: 'Markdown' }
    );
  }

  await db.setPendingWallet(ctx.from.id, address);

  await ctx.reply(
    `You entered:\n\`${address}\`\n\nPress *DONE* to confirm and submit for verification.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ DONE', callback_data: 'verify_done' }],
          [{ text: '✏️ Re-enter address', callback_data: 'verify_start' }],
        ],
      },
    }
  );
}

async function onVerifyDone(ctx) {
  await ctx.answerCbQuery();
  const tgUser = ctx.from;
  const pending = await db.getUser(tgUser.id);

  if (!pending || !pending.pending_wallet) {
    return ctx.reply('No wallet address on file yet. Tap VERIFY to start.', mainMenuKeyboard());
  }

  const updated = await db.finalizeVerification(tgUser.id);
  const who = mention(tgUser.id, tgUser.username, tgUser.first_name);

  await ctx.reply(
    '🎉 Your wallet has been submitted for verification!\n\n' +
      'As long as your verification record stays on file, your Makytian status is permanent.',
    mainMenuKeyboard()
  );

  // Post to Makyton Verification Group (MVG)
  if (process.env.MVG_CHAT_ID) {
    const mvgText =
      `Telegram username: ${tgUser.username ? '@' + tgUser.username : '(none)'}\n` +
      `Telegram ID: ${tgUser.id}\n` +
      `MATIC wallet address: ${updated.wallet_address}`;
    ctx.telegram
      .sendMessage(process.env.MVG_CHAT_ID, mvgText)
      .catch((err) => console.error('[verify] failed to post to MVG:', err.message));
  }

  // Announce in main group
  if (process.env.MAIN_GROUP_ID) {
    ctx.telegram
      .sendMessage(process.env.MAIN_GROUP_ID, `${who} has become a Makytian`, { parse_mode: 'Markdown' })
      .catch((err) => console.error('[verify] failed to post to main group:', err.message));
  }

  // Pay referrer, if any, now that the referred user is verified
  const referrer = await db.awardReferralIfDue(tgUser.id);
  if (referrer) {
    await db.addBalance(referrer.telegram_id, REWARD_REFERRAL);
    const referrerMention = mention(referrer.telegram_id, referrer.username, referrer.first_name);
    if (process.env.MVG_CHAT_ID) {
      ctx.telegram
        .sendMessage(process.env.MVG_CHAT_ID, `${referrerMention} referred ${who}`, {
          parse_mode: 'Markdown',
        })
        .catch((err) => console.error('[verify] failed to post referral to MVG:', err.message));
    }
  }
}

module.exports = { onVerifyButton, onWithdrawButton, onWalletMessage, onVerifyDone };
