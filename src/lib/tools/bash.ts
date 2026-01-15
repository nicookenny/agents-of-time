import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /mkfs/,
  /dd\s+if=/,
  />\s*\/dev\//,
  /chmod\s+777\s+\//,
  /curl.*\|\s*bash/,
  /wget.*\|\s*bash/,
];

function isSafeCommand(command: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return false;
    }
  }
  return true;
}

export const bashTools = {
  executeCommand: tool({
    description: 'Execute a bash command and return the output',
    inputSchema: z.object({
      command: z.string().describe('The bash command to execute'),
      workingDirectory: z.string().optional().describe('Working directory for the command'),
      timeoutSeconds: z.number().default(30).describe('Timeout in seconds'),
    }),
    execute: async ({ command, workingDirectory, timeoutSeconds }) => {
      if (!isSafeCommand(command)) {
        return {
          success: false,
          error: 'Command blocked: potentially dangerous operation detected',
          stdout: '',
          stderr: '',
        };
      }

      const cwd = workingDirectory || process.cwd();
      const timeout = (timeoutSeconds || 30) * 1000;

      try {
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024,
        });

        return {
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
        };
      } catch (error: any) {
        return {
          success: false,
          stdout: error.stdout?.trim() || '',
          stderr: error.stderr?.trim() || error.message,
          exitCode: error.code || 1,
          error: error.message,
        };
      }
    },
  }),

  listDirectory: tool({
    description: 'List contents of a directory',
    inputSchema: z.object({
      path: z.string().default('.').describe('Directory path'),
      showHidden: z.boolean().default(false).describe('Show hidden files'),
      longFormat: z.boolean().default(false).describe('Use long listing format'),
    }),
    execute: async ({ path, showHidden, longFormat }) => {
      const flags = [showHidden ? '-a' : '', longFormat ? '-l' : ''].filter(Boolean).join('');
      const command = `ls ${flags} "${path}"`;

      try {
        const { stdout } = await execAsync(command, { timeout: 10000 });
        const items = stdout.trim().split('\n').filter(Boolean);

        return {
          success: true,
          path,
          items,
          count: items.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          path,
          items: [],
          count: 0,
        };
      }
    },
  }),

  getProcessList: tool({
    description: 'Get list of running processes',
    inputSchema: z.object({
      filter: z.string().optional().describe('Filter processes by name'),
    }),
    execute: async ({ filter }) => {
      const command = filter ? `ps aux | grep "${filter}" | grep -v grep` : 'ps aux | head -20';

      try {
        const { stdout } = await execAsync(command, { timeout: 10000 });
        const lines = stdout.trim().split('\n');

        return {
          success: true,
          processes: lines,
          count: lines.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
          processes: [],
          count: 0,
        };
      }
    },
  }),

  checkDiskSpace: tool({
    description: 'Check disk space usage',
    inputSchema: z.object({
      path: z.string().default('/').describe('Path to check'),
    }),
    execute: async ({ path }) => {
      try {
        const { stdout } = await execAsync(`df -h "${path}"`, { timeout: 10000 });
        const lines = stdout.trim().split('\n');
        const header = lines[0];
        const data = lines[1];

        return {
          success: true,
          raw: stdout.trim(),
          header,
          data,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  }),

  gitStatus: tool({
    description: 'Get git repository status',
    inputSchema: z.object({
      path: z.string().default('.').describe('Repository path'),
    }),
    execute: async ({ path }) => {
      try {
        const { stdout: status } = await execAsync('git status --porcelain', {
          cwd: path,
          timeout: 10000,
        });

        const { stdout: branch } = await execAsync('git branch --show-current', {
          cwd: path,
          timeout: 10000,
        });

        const files = status
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => ({
            status: line.substring(0, 2).trim(),
            file: line.substring(3),
          }));

        return {
          success: true,
          branch: branch.trim(),
          files,
          hasChanges: files.length > 0,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  }),
};
