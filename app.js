// ======================= CONFIGURATION =======================
const TWELVE_DATA_KEY = '2fb822c09c1c42e19c07e94090f18b42';

const ALL_ASSETS = {
  forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'USD/CHF', 'EUR/GBP', 'EUR/AUD', 'GBP/JPY'],
  crypto: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'LTCUSDT', 'BNBUSDT', 'DOGEUSDT', 'MATICUSDT']
};

let selectedAssets = [];
let channelConfig = { botToken: '', chatId: null, isValid: false };
let lastSignals = {};
let pendingSignals = {};
let isAnalyzing = false;
let heartbeatInterval = null;
let lastHeartbeat = Date.now();

// ======================= HELPER: WAT Timezone =======================
function getWATTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
}

// ======================= HEARTBEAT =======================
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    const now = Date.now();
    if (now - lastHeartbeat > 120000) {
      console.log("Heartbeat: Bot appeared idle, refreshing connection...");
      if (channelConfig.isValid && channelConfig.botToken && channelConfig.chatId) {
        sendToBotChat("🔄 *Heartbeat*: Bot is still active and monitoring markets.", true).catch(e=>console.log);
      }
    }
    lastHeartbeat = now;
  }, 60000);
}

// ======================= UI: Connection Status =======================
function updateConnectionStatus(status) {
  const statusLed = document.getElementById('statusLed');
  const statusText = document.getElementById('statusText');
  switch(status) {
    case 'online':
      statusLed.className = 'status-led online';
      statusText.className = 'status-text online';
      statusText.innerHTML = 'ONLINE (Bot Chat)';
      break;
    case 'offline':
      statusLed.className = 'status-led offline';
      statusText.className = 'status-text offline';
      statusText.innerHTML = 'OFFLINE';
      break;
    case 'checking':
      statusLed.className = 'status-led checking';
      statusText.className = 'status-text checking';
      statusText.innerHTML = 'CHECKING...';
      break;
  }
}

// ======================= Telegram: Fetch ChatId =======================
async function fetchBotChatId(token) {
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok && data.result && data.result.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const update = data.result[i];
        if (update.message && update.message.chat && update.message.chat.type === 'private') {
          return update.message.chat.id;
        }
        if (update.callback_query && update.callback_query.message && update.callback_query.message.chat && update.callback_query.message.chat.type === 'private') {
          return update.callback_query.message.chat.id;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("getUpdates error:", error);
    return null;
  }
}

// ======================= Telegram: Connect Bot =======================
async function connectBotAndTest() {
  const token = document.getElementById('botToken').value.trim();
  if (!token) {
    showTelegramResult('❌ Bot Token required', 'error');
    return false;
  }
  
  updateConnectionStatus('checking');
  showTelegramResult('🔍 Finding your chat with bot... Send any message to bot first (e.g., /start)', 'success');
  
  let chatId = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    chatId = await fetchBotChatId(token);
    if (chatId) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  if (!chatId) {
    updateConnectionStatus('offline');
    showTelegramResult('❌ Could not find your private chat. Please open Telegram, search for your bot, send "/start" or any message, then click Connect again.', 'error');
    channelConfig.isValid = false;
    return false;
  }
  
  channelConfig.botToken = token;
  channelConfig.chatId = chatId;
  channelConfig.isValid = true;
  
  // TEST MESSAGE: DO NOT CHANGE
  const testSent = await sendToBotChat('✅ *Active*', true);
  if (testSent) {
    localStorage.setItem('bot_token', token);
    localStorage.setItem('bot_chat_id', chatId.toString());
    updateConnectionStatus('online');
    showTelegramResult('✅ Bot connected! Signals + Win/Loss results will be sent to YOUR BOT CHAT.', 'success');
    return true;
  } else {
    channelConfig.isValid = false;
    updateConnectionStatus('offline');
    showTelegramResult('❌ Failed to send test message. Check token and ensure you started a chat with bot.', 'error');
    return false;
  }
}

// ======================= Telegram: Send Message =======================
async function sendToBotChat(message, isMarkdown = true) {
  if (!channelConfig.isValid || !channelConfig.botToken || !channelConfig.chatId) return false;
  const url = `https://api.telegram.org/bot${channelConfig.botToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelConfig.chatId,
        text: message,
        parse_mode: isMarkdown ? 'Markdown' : undefined,
        disable_web_page_preview: true
      })
    });
    const data = await response.json();
    if (!data.ok) console.error('Telegram error:', data);
    return data.ok;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

function disconnectBot() {
  channelConfig.isValid = false;
  channelConfig.botToken = '';
  channelConfig.chatId = null;
  localStorage.removeItem('bot_token');
  localStorage.removeItem('bot_chat_id');
  document.getElementById('botToken').value = '';
  updateConnectionStatus('offline');
  showTelegramResult('🔌 Bot disconnected.', 'success');
}

function showTelegramResult(message, type) {
  const div = document.getElementById('telegramTestResult');
  div.innerHTML = message;
  div.style.color = type === 'success' ? '#00e599' : '#ff4d6d';
  setTimeout(() => { if (div.innerHTML === message) div.innerHTML = ''; }, 5000);
}

function loadSavedBotConfig() {
  const savedToken = localStorage.getItem('bot_token');
  const savedChatId = localStorage.getItem('bot_chat_id');
  if (savedToken && savedChatId) {
    channelConfig.botToken = savedToken;
    channelConfig.chatId = savedChatId;
    channelConfig.isValid = true;
    document.getElementById('botToken').value = savedToken;
    updateConnectionStatus('online');
    showTelegramResult('✅ Bot reconnected! Messages go to your bot chat.', 'success');
  } else {
    channelConfig.isValid = false;
    updateConnectionStatus('offline');
  }
}

// ======================= WIN/LOSS VERIFICATION =======================
async function verifyAndSendResult(signalData) {
  if (!channelConfig.isValid) return;
  const { asset, direction, entryPrice, expiryTime, displayName } = signalData;
  const isForex = ALL_ASSETS.forex.includes(asset);
  
  try {
    const closes = isForex ? await fetchForexData(asset) : await fetchCryptoData(asset);
    if (!closes || closes.length === 0) return;
    const expiryPrice = closes[closes.length - 1];
    
    let result = null;
    if (direction === 'BUY') {
      result = expiryPrice > entryPrice ? 'Win ✅' : 'Loss ❌';
    } else {
      result = expiryPrice < entryPrice ? 'Win ✅' : 'Loss ❌';
    }
    
    // DO NOT CHANGE RESULT MSG
    const resultMsg = `📊 *RESULT UPDATE* 📊\n\n${direction === 'BUY' ? '🟢' : '🔴'} *${direction} SIGNAL* for *${displayName}*\n🎯: *${result}*`;
    
    await sendToBotChat(resultMsg, true);
    console.log(`Result sent for ${asset}: ${result}`);
  } catch (err) {
    console.error(`Verification error for ${asset}:`, err);
  }
}

function checkExpiredSignals() {
  const now = getWATTime();
  for (const key in pendingSignals) {
    const signal = pendingSignals[key];
    if (now >= signal.expiryTime) {
      verifyAndSendResult(signal);
      delete pendingSignals[key];
    }
  }
}

// ======================= TRADE WINDOW & TIMER =======================
function getTradeWindowInfo() {
  const now = getWATTime();
  const minutes = now.getMinutes();
  const nextFiveMin = Math.ceil(minutes / 5) * 5;
  const nextSignalTime = new Date(now);
  nextSignalTime.setMinutes(nextFiveMin, 0, 0);
  const entryEnd = new Date(nextSignalTime);
  entryEnd.setMinutes(entryEnd.getMinutes() + 2);
  const tradeExpiry = new Date(nextSignalTime);
  tradeExpiry.setMinutes(tradeExpiry.getMinutes() + 7);
  const timeUntilSignal = Math.max(0, (nextSignalTime - now) / 1000);
  const isInEntryWindow = now >= nextSignalTime && now < entryEnd;
  return { nextSignalTime, entryEnd, tradeExpiry, timeUntilSignal, isInEntryWindow };
}

function updateTimerDisplay() {
  const windowInfo = getTradeWindowInfo();
  const now = getWATTime();
  const timerEl = document.getElementById('tradeTimer');
  if (windowInfo.isInEntryWindow) {
    const remainingEntry = Math.max(0, (windowInfo.entryEnd - now) / 1000);
    const mins = Math.floor(remainingEntry / 60);
    const secs = Math.floor(remainingEntry % 60);
    timerEl.innerHTML = `🎯 ENTRY OPEN: ${mins}:${secs.toString().padStart(2,'0')}`;
    timerEl.style.color = '#00e599';
  } else if (windowInfo.timeUntilSignal <= 60) {
    const secs = Math.floor(windowInfo.timeUntilSignal);
    timerEl.innerHTML = `⏰ NEXT SIGNAL: ${secs}s`;
    timerEl.style.color = '#ffaa00';
  } else {
    const mins = Math.floor(windowInfo.timeUntilSignal / 60);
    const secs = Math.floor(windowInfo.timeUntilSignal % 60);
    timerEl.innerHTML = `📡 Next signal: ${mins}:${secs.toString().padStart(2,'0')}`;
    timerEl.style.color = '#26A5E4';
  }
  checkExpiredSignals();
}

// ======================= ASSET SELECTION =======================
function loadSavedSelections() {
  const saved = localStorage.getItem('trendpulse_channel_selected_assets');
  if (saved) selectedAssets = JSON.parse(saved);
  else selectedAssets = ['EUR/USD', 'GBP/USD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  renderAssetGrid();
}

function renderAssetGrid() {
  const grid = document.getElementById('assetGrid');
  const allAssetsList = [...ALL_ASSETS.forex, ...ALL_ASSETS.crypto];
  grid.innerHTML = '';
  allAssetsList.forEach(asset => {
    const isSelected = selectedAssets.includes(asset);
    const displayName = asset.includes('USDT') ? asset.replace('USDT', '/USDT') : asset;
    const icon = asset.includes('USDT') ? '🪙' : '📈';
    const div = document.createElement('div');
    div.className = 'asset-checkbox';
    div.innerHTML = `<input type="checkbox" id="chk_${asset.replace(/\//g, '_')}" ${isSelected ? 'checked' : ''}>
                     <label for="chk_${asset.replace(/\//g, '_')}">${icon} ${displayName}</label>`;
    const checkbox = div.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) { if (!selectedAssets.includes(asset)) selectedAssets.push(asset); }
      else { selectedAssets = selectedAssets.filter(a => a !== asset); }
      localStorage.setItem('trendpulse_channel_selected_assets', JSON.stringify(selectedAssets));
      document.getElementById('selectedCount').innerHTML = `✓ ${selectedAssets.length} assets selected`;
    });
    grid.appendChild(div);
  });
  document.getElementById('selectedCount').innerHTML = `✓ ${selectedAssets.length} assets selected`;
}

// ======================= API & TECHNICAL ANALYSIS =======================
function isForexAsset(asset) { return ALL_ASSETS.forex.includes(asset); }

async function fetchForexData(symbol) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=5min&outputsize=55&apikey=${TWELVE_DATA_KEY}`;
  const resp = await fetch(url);
  const json = await resp.json();
  if (json.status === 'error' || !json.values) throw new Error(json.message);
  const values = json.values.reverse();
  return values.map(v => parseFloat(v.close));
}

async function fetchCryptoData(symbol) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=5m&limit=55`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Binance error`);
  const data = await resp.json();
  return data.map(c => parseFloat(c[4]));
}

function calculateEMA(prices, period) {
  if (!prices.length) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period - 1; i < prices.length - 1; i++) {
    let diff = prices[i+1] - prices[i];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  let rs = gains / losses;
  return Math.min(100, Math.max(0, 100 - (100 / (1 + rs))));
}

function detectTrend(prices) {
  if (!prices || prices.length < 25) return { trend: 'NEUTRAL', confidence: 40, rsi: 50 };
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const ema50 = calculateEMA(prices, 50);
  const rsi = calculateRSI(prices, 14);
  const currentPrice = prices[prices.length-1];
  const price5Ago = prices[prices.length-6];
  const momentumPercent = ((currentPrice - price5Ago) / price5Ago) * 100;
  let bullishScore = 0, bearishScore = 0;
  if (ema9 > ema21) bullishScore += 30;
  else if (ema9 < ema21) bearishScore += 30;
  if (ema21 > ema50) bullishScore += 20;
  else if (ema21 < ema50) bearishScore += 20;
  if (rsi > 58) bullishScore += 22;
  else if (rsi < 42) bearishScore += 22;
  if (momentumPercent > 0) bullishScore += Math.min(28, momentumPercent * 1.8);
  else if (momentumPercent < 0) bearishScore += Math.min(28, Math.abs(momentumPercent) * 1.8);
  let trend = 'NEUTRAL';
  let confidence = 55;
  if (bullishScore > bearishScore + 14) { trend = 'BULLISH'; confidence = 70 + Math.min(22, (bullishScore - bearishScore) / 2.5); }
  else if (bearishScore > bullishScore + 14) { trend = 'BEARISH'; confidence = 70 + Math.min(22, (bearishScore - bullishScore) / 2.5); }
  confidence = Math.min(94, Math.max(48, Math.floor(confidence)));
  return { trend, confidence, rsi: rsi.toFixed(1), ema9: ema9.toFixed(5), ema21: ema21.toFixed(5), momentumPercent: momentumPercent.toFixed(3), currentPrice };
}

async function analyzeSingleAsset(asset) {
  const isForex = isForexAsset(asset);
  let displayName = asset.includes('USDT') ? asset.replace('USDT', '/USDT') : asset;
  try {
    const closes = isForex ? await fetchForexData(asset) : await fetchCryptoData(asset);
    if (!closes || closes.length < 25) return null;
    const result = detectTrend(closes);
    const currentPrice = result.currentPrice || closes[closes.length-1];
    const prevPrice = closes[closes.length-2] || currentPrice;
    const changePercent = ((currentPrice - prevPrice) / prevPrice * 100).toFixed(4);
    const finalSignal = result.trend === 'BULLISH' ? 'BUY' : (result.trend === 'BEARISH' ? 'SELL' : 'NEUTRAL');
    const signalKey = `${asset}_signal`;
    const lastSignal = lastSignals[signalKey];
    
    if (finalSignal !== 'NEUTRAL' && lastSignal !== finalSignal && channelConfig.isValid) {
      const windowInfo = getTradeWindowInfo();
      if (windowInfo.isInEntryWindow) {
        // SIGNAL MESSAGE: DO NOT CHANGE
        const signalMsg = `${finalSignal === 'BUY' ? '🟢' : '🔴'} *${finalSignal} SIGNAL* 🔔\n\n📊 *Asset:* ${displayName}\n💰 *Price:* ${formatPrice(currentPrice, asset)}\n📈 *Expiry time: 5 mins* (${changePercent}%)\n🎯 *Confidence:* ${result.confidence}%\n\n⏰ *Entry window closes at:* ${windowInfo.entryEnd.toLocaleTimeString('en-GB')}\n⏱ *Trade expires at:* ${windowInfo.tradeExpiry.toLocaleTimeString('en-GB')}`;
        const sent = await sendToBotChat(signalMsg, true);
        if (sent) {
          lastSignals[signalKey] = finalSignal;
          pendingSignals[`${asset}_${Date.now()}`] = {
            asset, direction: finalSignal, entryPrice: currentPrice, entryTime: getWATTime(),
            expiryTime: windowInfo.tradeExpiry, displayName
          };
        }
      }
    } else if (finalSignal === 'NEUTRAL') {
      lastSignals[signalKey] = null;
    }
    return { asset, displayName, result, currentPrice, changePercent, finalSignal };
  } catch (err) {
    console.error(`Error on ${asset}:`, err.message);
    return null;
  }
}

async function runFullAnalysis(updateUI = true) {
  if (isAnalyzing) return;
  isAnalyzing = true;
  lastHeartbeat = Date.now();
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (updateUI) { analyzeBtn.disabled = true; analyzeBtn.innerHTML = '⏳ Analyzing...'; }
  
  let firstAssetResult = null;
  for (const asset of selectedAssets) {
    const res = await analyzeSingleAsset(asset);
    if (res && updateUI && firstAssetResult === null) firstAssetResult = res;
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  
  if (updateUI && firstAssetResult) {
    document.getElementById('priceVal').innerHTML = formatPrice(firstAssetResult.currentPrice, firstAssetResult.asset);
    document.getElementById('changeVal').innerHTML = `${firstAssetResult.changePercent}%`;
    document.getElementById('strengthVal').innerHTML = `${firstAssetResult.result.confidence}%`;
    document.getElementById('emaSpan').innerHTML = `${firstAssetResult.result.ema9}/${firstAssetResult.result.ema21}`;
    document.getElementById('rsiSpan').innerHTML = firstAssetResult.result.rsi;
    document.getElementById('momSpan').innerHTML = firstAssetResult.result.momentumPercent + '%';
    const signalDiv = document.getElementById('signalDisplay');
    if (firstAssetResult.finalSignal === 'BUY') signalDiv.innerHTML = `<div class="signal-big bullish">🔺 BULLISH · BUY 🔺</div><div style="font-size:0.7rem;">Confidence ${firstAssetResult.result.confidence}%</div>`;
    else if (firstAssetResult.finalSignal === 'SELL') signalDiv.innerHTML = `<div class="signal-big bearish">🔻 BEARISH · SELL 🔻</div><div style="font-size:0.7rem;">Confidence ${firstAssetResult.result.confidence}%</div>`;
    else signalDiv.innerHTML = `<div class="signal-big neutral">⚪ NEUTRAL · HOLD ⚪</div>`;
  }
  document.getElementById('timestampMsg').innerHTML = `🕒 Last scan: ${new Date().toLocaleTimeString()} · Monitoring ${selectedAssets.length} assets · Active signals: ${Object.keys(pendingSignals).length}`;
  if (updateUI) { analyzeBtn.disabled = false; analyzeBtn.innerHTML = '🔍 Manual Analysis Now'; }
  isAnalyzing = false;
}

function formatPrice(price, asset) {
  if (!price) return '—';
  const isCrypto = asset.includes('USDT');
  if (isCrypto) { if (price > 1000) return price.toFixed(2); if (price > 0.1) return price.toFixed(4); return price.toFixed(6); }
  return price.toFixed(5);
}

function startAutoRefresh() {
  const scheduleNextRun = () => {
    const now = getWATTime();
    const minutes = now.getMinutes();
    const nextFiveMin = Math.ceil((minutes + 0.1) / 5) * 5;
    let nextRun = new Date(now);
    nextRun.setMinutes(nextFiveMin, 0, 0);
    const delay = nextRun - now;
    setTimeout(() => {
      runFullAnalysis(true);
      scheduleNextRun();
    }, Math.max(1000, delay));
  };
  scheduleNextRun();
  setInterval(updateTimerDisplay, 1000);
}

// ======================= INITIALIZATION =======================
window.addEventListener('DOMContentLoaded', async () => {
  loadSavedSelections();
  loadSavedBotConfig();
  updateTimerDisplay();
  await runFullAnalysis(true);
  startAutoRefresh();
  startHeartbeat();
  document.getElementById('analyzeBtn').addEventListener('click', () => runFullAnalysis(true));
  document.getElementById('saveTelegramBtn').addEventListener('click', connectBotAndTest);
  document.getElementById('disconnectBtn').addEventListener('click', disconnectBot);
});
