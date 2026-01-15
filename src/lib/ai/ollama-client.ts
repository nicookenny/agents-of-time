import Ollama from 'ollama';
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

    try {
      // Check if model is available
      await this.ensureModelExists(model);

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

      const response = await this.client.chat({
        model,
        messages,
        format: 'json', // Force JSON output
        options: {
          temperature: options?.temperature ?? 0.3, // Lower temp for more consistent extraction
        },
      });

      const jsonContent = response.message.content;
      const parsed = JSON.parse(jsonContent);
      const validated = schema.parse(parsed);

      return {
        data: validated,
        timeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      throw new Error(`Ollama processing failed: ${error.message}`);
    }
  }

  private async ensureModelExists(model: string): Promise<void> {
    try {
      const models = await this.client.list();
      const exists = models.models.some((m) => m.name === model);

      if (!exists) {
        throw new Error(
          `Model ${model} not found. Please run: ollama pull ${model}`
        );
      }
    } catch (error: any) {
      throw new Error(`Failed to check Ollama models: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }
}

export const ollamaClient = new OllamaClient();
