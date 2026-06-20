const db = require('../db');
const { mention } = require('../utils/format');

const REWARD_JOIN_TASK = parseInt(process.env.REWARD_JOIN_TASK || '15', 10);

// Fires when one or more users join a group/supergroup the bot is in.
async function onNewChatMembers(ctx) {
  const chatId = String(ctx.chat.id);
  const isMainGroup = chatId === String(process.env.MAIN_GROUP_ID);

  for (const member of ctx.message.new_chat_members) {
    if (member.is_bot) continue;

    await db.upsertUser(member.id, member.username, member.first_name);

    if (isMainGroup) {
      // Welcome message with GET VERIFIED deep link button
      const botUsername = process.env.BOT_USERNAME;
      await ctx.reply(
        `Welcome ${mention(member.id, member.username, member.first_name)}, verify to become a Makytian.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: 'GET VERIFIED', url: `https://t.me/${botUsername}?start=verify` }],
            ],
          },
        }
      );

      await awardJoinTask(ctx, member, chatId);
    }
  }
}

// Fires on membership changes in chats where the bot is admin (used for channel joins).
// Requires the bot to be an admin of the target channel.
async function onChatMember(ctx) {
  const update = ctx.chatMember;
  if (!update) return;

  const chatId = String(update.chat.id);
  if (chatId !== String(process.env.TARGET_CHANNEL_ID)) return;

  const newStatus = update.new_chat_member.status;
  const oldStatus = update.old_chat_member.status;
  const justJoined = ['member', 'administrator'].includes(newStatus) && !['member', 'administrator'].includes(oldStatus);
  if (!justJoined) return;

  const member = update.new_chat_member.user;
  if (member.is_bot) return;

  await db.upsertUser(member.id, member.username, member.first_name);
  await awardJoinTask(ctx, member, chatId, true);
}

async function awardJoinTask(ctx, member, chatId, isChannel = false) {
  const justCompleted = await db.markJoinedTaskDone(member.id);
  if (!justCompleted) return; // already had this task, or race condition - no-op

  await db.addBalance(member.id, REWARD_JOIN_TASK);

  const label = isChannel
    ? process.env.TARGET_CHANNEL_USERNAME || 'channel'
    : 'main group';
  const text = `${mention(member.id, member.username, member.first_name)} completed the channel task (${label})`;

  if (process.env.MVG_CHAT_ID) {
    ctx.telegram
      .sendMessage(process.env.MVG_CHAT_ID, text, { parse_mode: 'Markdown' })
      .catch((err) => console.error('[groupEvents] failed to post to MVG:', err.message));
  }
}

module.exports = { onNewChatMembers, onChatMember };
