import { keyManager } from './keyManager.js';

export interface StreamOptions {
  systemInstruction: string;
  chatHistory: { role: string; content: string }[];
  contextText: string;
  prompt: string;
}

export async function* streamFromGemini(opts: StreamOptions, model: string = 'gemini-2.5-flash'): AsyncGenerator<string> {
  const key = keyManager.getGeminiKey();
  if (!key) throw new Error('No Gemini API key');

  const geminiHistory = opts.chatHistory.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: opts.systemInstruction }] },
        contents: [
          ...geminiHistory,
          { role: 'user', parts: [{ text: `${opts.contextText}\n\nВОПРОС: ${opts.prompt}` }] },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!response.ok) {
    const status = response.status;
    if (status === 429 || status === 503) {
      keyManager.rotateGemini();
      throw new Error(`RETRYABLE:${status}`);
    }
    throw new Error(`Gemini ${status}: ${await response.text()}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch { /* skip invalid JSON */ }
    }
  }
}

export async function* streamFromOpenAI(opts: StreamOptions, model: string = 'gpt-4o-mini'): AsyncGenerator<string> {
  const key = keyManager.getOpenAIKey();
  if (!key) throw new Error('No OpenAI API key');

  const messages = [
    { role: 'system', content: opts.systemInstruction },
    ...opts.chatHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: `${opts.contextText}\n\nВОПРОС: ${opts.prompt}` },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: 8192,
      temperature: 0.3,
      stream: true,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429 || status === 503) {
      keyManager.rotateOpenAI();
      throw new Error(`RETRYABLE:${status}`);
    }
    throw new Error(`OpenAI ${status}: ${await response.text()}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const text = parsed?.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch { /* skip */ }
    }
  }
}

export async function* streamLLM(opts: StreamOptions): AsyncGenerator<string> {
  const models = [
    { provider: 'openai' as const, name: 'gpt-5-2025-08-07' },
    { provider: 'gemini' as const, name: 'gemini-2.5-flash' },
    { provider: 'openai' as const, name: 'gpt-4o-mini' },
    { provider: 'gemini' as const, name: 'gemini-2.0-flash' },
  ];

  for (const model of models) {
    if (model.provider === 'gemini' && !keyManager.hasGemini()) continue;
    if (model.provider === 'openai' && !keyManager.hasOpenAI()) continue;

    try {
      console.log(`Trying ${model.provider}/${model.name}...`);
      const stream = model.provider === 'gemini'
        ? streamFromGemini(opts, model.name)
        : streamFromOpenAI(opts, model.name);

      for await (const chunk of stream) {
        yield chunk;
      }
      console.log(`Success with ${model.provider}/${model.name}`);
      return;
    } catch (err: any) {
      console.warn(`Failed ${model.provider}/${model.name}: ${err.message}`);
      if (err.message?.startsWith('RETRYABLE')) continue;
      // Non-retryable — try next model
      continue;
    }
  }

  throw new Error('All LLM providers failed');
}
