// Telegram Bot API notification channel (optional). Free, instant, perfect
// for a personal alert pipeline. Configure via .deploy.env → PM2 env:
//   TELEGRAM_BOT_TOKEN  from @BotFather
//   TELEGRAM_CHAT_ID    your chat/group id (e.g. via @userinfobot)

export function isTelegramConfigured(): boolean {
  return Boolean((process.env.TELEGRAM_BOT_TOKEN || '').trim() && (process.env.TELEGRAM_CHAT_ID || '').trim());
}

/** Send one text message. Never throws — returns { ok:false, error }. */
export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return { ok: false, error: 'Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)' };
  try {
    await $fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: chatId, text }
    });
    return { ok: true };
  } catch (err: any) {
    console.error('[telegram] send failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
