type TelegramButton = { text: string; callback_data: string };

export async function sendTelegramMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
  buttons?: TelegramButton[][];
}) {
  const response = await fetch(
    `https://api.telegram.org/bot${input.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        parse_mode: "HTML",
        reply_markup: input.buttons
          ? { inline_keyboard: input.buttons }
          : undefined,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`TELEGRAM_SEND_FAILED:${response.status}`);
  }
  return response.json() as Promise<{
    ok: boolean;
    result?: { message_id: number };
  }>;
}

export async function answerTelegramCallback(input: {
  botToken: string;
  callbackQueryId: string;
  text: string;
}) {
  await fetch(
    `https://api.telegram.org/bot${input.botToken}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: input.callbackQueryId,
        text: input.text,
      }),
    }
  );
}
