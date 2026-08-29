import { spawn } from 'node:child_process';

export async function openBrowser(url: string): Promise<boolean> {
  const command =
    process.platform === 'darwin'
      ? { executable: 'open', args: [url] }
      : process.platform === 'win32'
        ? { executable: 'cmd', args: ['/c', 'start', '', url] }
        : { executable: 'xdg-open', args: [url] };

  return new Promise((resolve) => {
    const child = spawn(command.executable, command.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child.unref();
      resolve(true);
    });
  });
}
