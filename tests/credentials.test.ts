import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteStoredCredential,
  getCredentialPath,
  readStoredCredential,
  writeStoredCredential,
} from '../src/credentials.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('saved FinCobra login', () => {
  it('writes, reads, and deletes a private credential file', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'fincobra-mcp-test-'));
    temporaryDirectories.push(directory);
    const env = { FINCOBRA_CONFIG_DIR: directory };
    const credential = {
      version: 1 as const,
      authBaseUrl: 'https://watch.fincobra.com',
      accessToken: 'fcm_test',
      expiresAt: '2026-12-01T00:00:00.000Z',
      accountLabel: 'user@example.com',
    };

    expect(await readStoredCredential(env)).toBeNull();
    await writeStoredCredential(credential, env);
    expect(await readStoredCredential(env)).toEqual(credential);
    if (process.platform !== 'win32') {
      expect((await stat(getCredentialPath(env))).mode & 0o777).toBe(0o600);
    }
    await deleteStoredCredential(env);
    expect(await readStoredCredential(env)).toBeNull();
  });
});
