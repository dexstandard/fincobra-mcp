import {
  chmod,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'node:path';
import type { StoredCredential } from './credentials.types.js';

const CREDENTIAL_FILE_NAME = 'credentials.json';

export function getCredentialPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicitDirectory = env.FINCOBRA_CONFIG_DIR?.trim();
  const configDirectory = explicitDirectory
    ? explicitDirectory
    : process.platform === 'win32'
      ? path.join(env.APPDATA?.trim() || homedir(), 'FinCobra')
      : path.join(
          env.XDG_CONFIG_HOME?.trim() || path.join(homedir(), '.config'),
          'fincobra',
        );
  return path.join(configDirectory, CREDENTIAL_FILE_NAME);
}

export async function readStoredCredential(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StoredCredential | null> {
  try {
    const payload = JSON.parse(
      await readFile(getCredentialPath(env), 'utf8'),
    ) as unknown;
    return isStoredCredential(payload) ? payload : null;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null;
    }
    throw error;
  }
}

export async function writeStoredCredential(
  credential: StoredCredential,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const credentialPath = getCredentialPath(env);
  const directory = path.dirname(credentialPath);
  const temporaryPath = `${credentialPath}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, `${JSON.stringify(credential, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, credentialPath);
  await chmod(credentialPath, 0o600);
}

export async function deleteStoredCredential(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    await unlink(getCredentialPath(env));
  } catch (error: unknown) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

function isStoredCredential(value: unknown): value is StoredCredential {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === 1 &&
    'authBaseUrl' in value &&
    typeof value.authBaseUrl === 'string' &&
    'accessToken' in value &&
    typeof value.accessToken === 'string' &&
    value.accessToken.length > 0 &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'string' &&
    'accountLabel' in value &&
    typeof value.accountLabel === 'string'
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code?: string }).code === 'ENOENT'
  );
}
