const db = require('../db');
const { mention, isAdmin } = require('../utils/format');

// Admin command: /addtask Title Here | https://t.me/PartnerBot?start=abc | 10
async function handleAddTask(ctx) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply('🚫 Only admins can add tasks.');
  }

  const raw = ctx.message.text.replace(/^\/addtask(@\w+)?\s*/, '');
  const parts = raw.split('|').map((p) => p.trim());

  if (parts.length !== 3 || !parts[0] || !parts[1] || isNaN(parseInt(parts[2], 10))) {
    return ctx.reply(
      'Usage:\n`/addtask Title | https://t.me/PartnerBot?start=xyz | 10`\n\n' +
        '(Title, then the bot link, then the $MYT reward — separated by `|`)',
      { parse_mode: 'Markdown' }
    );
  }

  const [title, botLink, rewardStr] = parts;
  const reward = parseInt(rewardStr, 10);

  const task = await db.createTask(title, botLink, reward, ctx.from.id);
  await postTaskMessage(ctx, task);
}

async function postTaskMessage(ctx, task) {
  const text = `🆕 *New Task: ${task.title}*\n\nReward: *${task.reward} $MYT*\n\nPress START BOT, complete it, then come back and press CLAIM.`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '🚀 START BOT', url: task.bot_link }],
      [{ text: '✅ CLAIM REWARD', callback_data: `claim_${task.id}` }],
    ],
  };

  const targetChat = process.env.MAIN_GROUP_ID || ctx.chat.id;
  await ctx.telegram.sendMessage(targetChat, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });

  if (String(targetChat) !== String(ctx.chat.id)) {
    await ctx.reply(`✅ Task #${task.id} posted to the main group.`);
  }
}

// Lists all currently active tasks, anywhere a user types /tasks
async function handleListTasks(ctx) {
  const tasks = await db.getActiveTasks();
  if (tasks.length === 0) {
    return ctx.reply('No active tasks right now — check back later!');
  }

  for (const task of tasks) {
    await ctx.reply(`*${task.title}* — ${task.reward} $MYT`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 START BOT', url: task.bot_link }],
          [{ text: '✅ CLAIM REWARD', callback_data: `claim_${task.id}` }],
        ],
      },
    });
  }
}

// Admin command: /removetask 3
async function handleRemoveTask(ctx) {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply('🚫 Only admins can remove tasks.');
  }

  const arg = ctx.message.text.split(/\s+/)[1];
  const taskId = parseInt(arg, 10);
  if (isNaN(taskId)) {
    return ctx.reply('Usage: `/removetask 3`', { parse_mode: 'Markdown' });
  }

  const task = await db.deactivateTask(taskId);
  if (!task) return ctx.reply(`No task found with ID ${taskId}.`);
  await ctx.reply(`🗑️ Task #${taskId} ("${task.title}") deactivated.`);
}

// Callback: claim_<taskId>
async function onClaimTask(ctx) {
  const taskId = parseInt(ctx.match[1], 10);
  const task = await db.getTask(taskId);

  if (!task || !task.active) {
    await ctx.answerCbQuery('This task is no longer active.', { show_alert: true });
    return;
  }

  const isNewClaim = await db.claimTask(taskId, ctx.from.id);
  if (!isNewClaim) {
    await ctx.answerCbQuery('You already claimed this task.', { show_alert: true });
    return;
  }

  await db.upsertUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  await db.addBalance(ctx.from.id, task.reward);
  await ctx.answerCbQuery(`✅ +${task.reward} $MYT credited!`, { show_alert: true });

  const who = mention(ctx.from.id, ctx.from.username, ctx.from.first_name);
  if (process.env.MVG_CHAT_ID) {
    ctx.telegram
      .sendMessage(process.env.MVG_CHAT_ID, `${who} completed the task (${task.title})`, {
        parse_mode: 'Markdown',
      })
      .catch((err) => console.error('[tasks] failed to post to MVG:', err.message));
  }
}

module.exports = { handleAddTask, handleListTasks, handleRemoveTask, onClaimTask };
