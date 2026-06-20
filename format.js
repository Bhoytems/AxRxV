// Returns a clickable mention for a user, falling back to first name
// (as a text mention link) when they have no @username set.
function mention(telegramId, username, firstName) {
  if (username) return `@${username}`;
  const name = firstName || 'User';
  return `[${escapeMarkdown(name)}](tg://user?id=${telegramId})`;
}

function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Basic EVM/Polygon address validation: 0x followed by 40 hex characters.
function isValidMaticAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

function isAdmin(telegramId) {
  const ids = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(telegramId));
}

module.exports = { mention, escapeMarkdown, isValidMaticAddress, isAdmin };
