import { tool } from 'ai';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { getToolContext } from './context';

export interface FileSystemContext {
  allowedPaths?: string[];
  maxFileSize?: number;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

function isPathAllowed(filePath: string, allowedPaths?: string[]): boolean {
  if (!allowedPaths || allowedPaths.length === 0) return true;

  const absolutePath = path.resolve(filePath);

  return allowedPaths.some((allowed) => {
    const absoluteAllowed = path.resolve(allowed);
    return absolutePath.startsWith(absoluteAllowed);
  });
}

export const fileSystemTools = {
  readFile: tool({
    description: 'Read the contents of a file',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the file'),
      encoding: z.enum(['utf-8', 'base64', 'hex']).default('utf-8'),
    }),
    execute: async ({ filePath, encoding }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(filePath, ctx.allowedPaths)) {
        return {
          success: false,
          error: `Access denied: ${filePath} is not in allowed paths`,
        };
      }

      try {
        const stats = await fs.stat(filePath);

        if (stats.size > (ctx.maxFileSize || DEFAULT_MAX_FILE_SIZE)) {
          return {
            success: false,
            error: `File too large: ${stats.size} bytes exceeds limit`,
          };
        }

        const content = await fs.readFile(filePath, encoding as BufferEncoding);

        return {
          success: true,
          filePath,
          content,
          size: stats.size,
          encoding,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          filePath,
        };
      }
    },
  }),

  writeFile: tool({
    description: 'Write content to a file',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the file'),
      content: z.string().describe('Content to write'),
      createDirectories: z.boolean().default(true).describe('Create parent directories if needed'),
      append: z.boolean().default(false).describe('Append instead of overwrite'),
    }),
    execute: async ({ filePath, content, createDirectories, append }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(filePath, ctx.allowedPaths)) {
        return {
          success: false,
          error: `Access denied: ${filePath} is not in allowed paths`,
        };
      }

      try {
        if (createDirectories) {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
        }

        if (append) {
          await fs.appendFile(filePath, content, 'utf-8');
        } else {
          await fs.writeFile(filePath, content, 'utf-8');
        }

        const stats = await fs.stat(filePath);

        return {
          success: true,
          filePath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          totalSize: stats.size,
          appended: append,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          filePath,
        };
      }
    },
  }),

  listFiles: tool({
    description: 'List files in a directory',
    inputSchema: z.object({
      dirPath: z.string().describe('Directory path'),
      recursive: z.boolean().default(false).describe('List recursively'),
      pattern: z.string().optional().describe('Glob pattern to filter files'),
    }),
    execute: async ({ dirPath, recursive, pattern }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(dirPath, ctx.allowedPaths)) {
        return {
          success: false,
          error: `Access denied: ${dirPath} is not in allowed paths`,
        };
      }

      async function readDir(dir: string): Promise<any[]> {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const results: any[] = [];

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(dirPath, fullPath);

          if (pattern && !entry.name.includes(pattern.replace('*', ''))) {
            continue;
          }

          const item = {
            name: entry.name,
            path: relativePath,
            fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
          };

          results.push(item);

          if (recursive && entry.isDirectory()) {
            const subItems = await readDir(fullPath);
            results.push(...subItems);
          }
        }

        return results;
      }

      try {
        const files = await readDir(dirPath);

        return {
          success: true,
          dirPath,
          files,
          count: files.length,
          recursive,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          dirPath,
        };
      }
    },
  }),

  fileInfo: tool({
    description: 'Get information about a file or directory',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the file or directory'),
    }),
    execute: async ({ filePath }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(filePath, ctx.allowedPaths)) {
        return {
          success: false,
          error: `Access denied: ${filePath} is not in allowed paths`,
        };
      }

      try {
        const stats = await fs.stat(filePath);

        return {
          success: true,
          filePath,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          accessed: stats.atime.toISOString(),
          permissions: stats.mode.toString(8),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          filePath,
        };
      }
    },
  }),

  deleteFile: tool({
    description: 'Delete a file',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the file'),
    }),
    execute: async ({ filePath }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(filePath, ctx.allowedPaths)) {
        return {
          success: false,
          error: `Access denied: ${filePath} is not in allowed paths`,
        };
      }

      try {
        await fs.unlink(filePath);

        return {
          success: true,
          deletedPath: filePath,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          filePath,
        };
      }
    },
  }),

  copyFile: tool({
    description: 'Copy a file to a new location',
    inputSchema: z.object({
      sourcePath: z.string().describe('Source file path'),
      destPath: z.string().describe('Destination file path'),
      overwrite: z.boolean().default(false).describe('Overwrite if exists'),
    }),
    execute: async ({ sourcePath, destPath, overwrite }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(sourcePath, ctx.allowedPaths) || !isPathAllowed(destPath, ctx.allowedPaths)) {
        return {
          success: false,
          error: 'Access denied: path not in allowed paths',
        };
      }

      try {
        if (!overwrite) {
          try {
            await fs.access(destPath);
            return {
              success: false,
              error: 'Destination file already exists',
            };
          } catch {
          }
        }

        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(sourcePath, destPath);

        return {
          success: true,
          sourcePath,
          destPath,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  }),

  createDirectory: tool({
    description: 'Create a directory',
    inputSchema: z.object({
      dirPath: z.string().describe('Directory path to create'),
      recursive: z.boolean().default(true).describe('Create parent directories'),
    }),
    execute: async ({ dirPath, recursive }) => {
      const ctx = getToolContext<FileSystemContext>();

      if (!isPathAllowed(dirPath, ctx.allowedPaths)) {
        return {
          success: false,
          error: `Access denied: ${dirPath} is not in allowed paths`,
        };
      }

      try {
        await fs.mkdir(dirPath, { recursive });

        return {
          success: true,
          createdPath: dirPath,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          dirPath,
        };
      }
    },
  }),
};
