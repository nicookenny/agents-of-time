import { Ollama } from 'ollama';
import { z } from 'zod';

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export class OllamaClient {
  private client: Ollama;
  private defaultModel: string;

  constructor(model: string = 'llama3.2:3b') {
    this.client = new Ollama({ host: ollamaBaseUrl });
    this.defaultModel = model;
  }

  async generateStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    options?: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    }
  ): Promise<{ data: T; timeMs: number }> {
    const startTime = Date.now();
    const model = options?.model || this.defaultModel;

    console.log(`[Ollama] Starting structured generation with model: ${model}`);
    console.log(`[Ollama] Base URL: ${ollamaBaseUrl}`);

    try {
      console.log(`[Ollama] Checking model availability...`);
      await this.ensureModelExists(model);
      console.log(`[Ollama] Model ${model} is available`);

      const messages = [];
      if (options?.systemPrompt) {
        messages.push({
          role: 'system',
          content: options.systemPrompt,
        });
      }
      messages.push({
        role: 'user',
        content: prompt,
      });

      console.log(`[Ollama] Generating response...`);
      const response = await this.client.chat({
        model,
        messages,
        format: 'json',
        options: {
          temperature: options?.temperature ?? 0.3,
        },
      });

      console.log(`[Ollama] Response received, parsing JSON...`);
      const jsonContent = response.message.content;
      const parsed = JSON.parse(jsonContent);
      const validated = schema.parse(parsed);

      const timeMs = Date.now() - startTime;
      console.log(`[Ollama] Generation completed in ${timeMs}ms`);

      return {
        data: validated,
        timeMs,
      };
    } catch (error: any) {
      console.error(`[Ollama] Error: ${error.message}`);
      throw new Error(`Ollama processing failed: ${error.message}`);
    }
  }

  private async ensureModelExists(model: string): Promise<void> {
    try {
      const models = await this.client.list();
      const availableModels = models.models.map((m) => m.name);
      console.log(`[Ollama] Available models: ${availableModels.join(', ') || 'none'}`);

      const exists = availableModels.some((name) => name === model);
      if (!exists) {
        throw new Error(
          `Model ${model} not found. Available: [${availableModels.join(', ')}]. Run: ollama pull ${model}`
        );
      }
    } catch (error: any) {
      if (error.message.includes('not found')) throw error;
      console.error(`[Ollama] Connection failed: ${error.message}`);
      throw new Error(`Failed to connect to Ollama at ${ollamaBaseUrl}: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      console.log(`[Ollama] Connection check: available at ${ollamaBaseUrl}`);
      return true;
    } catch (error: any) {
      console.log(`[Ollama] Connection check: unavailable - ${error.message}`);
      return false;
    }
  }
}

export const ollamaClient = new OllamaClient();
