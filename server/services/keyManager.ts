import { config } from '../config.js';

class KeyManager {
  private geminiKeys: string[];
  private openaiKeys: string[];
  private geminiIdx = 0;
  private openaiIdx = 0;

  constructor() {
    this.geminiKeys = config.geminiApiKeys;
    this.openaiKeys = config.openaiApiKeys;
  }

  getGeminiKey(): string | null {
    if (this.geminiKeys.length === 0) return null;
    const key = this.geminiKeys[this.geminiIdx % this.geminiKeys.length];
    return key.trim();
  }

  getOpenAIKey(): string | null {
    if (this.openaiKeys.length === 0) return null;
    const key = this.openaiKeys[this.openaiIdx % this.openaiKeys.length];
    return key.trim();
  }

  rotateGemini() {
    this.geminiIdx++;
    console.log(`Rotated Gemini key to index ${this.geminiIdx % this.geminiKeys.length}`);
  }

  rotateOpenAI() {
    this.openaiIdx++;
    console.log(`Rotated OpenAI key to index ${this.openaiIdx % this.openaiKeys.length}`);
  }

  hasGemini(): boolean { return this.geminiKeys.length > 0; }
  hasOpenAI(): boolean { return this.openaiKeys.length > 0; }
}

export const keyManager = new KeyManager();
