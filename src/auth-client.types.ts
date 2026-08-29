export type McpAccessScope =
  | 'watchlist:read'
  | 'checkout:read'
  | 'checkout:write';

export interface FincobraAccount {
  id: string;
  email: string | null;
  walletAddress: string | null;
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export interface FincobraLoginSession {
  accessToken: string;
  expiresAt: string;
  scopes: McpAccessScope[];
  account: FincobraAccount;
}

export interface FincobraSessionStatus {
  expiresAt: string;
  scopes: McpAccessScope[];
  account: FincobraAccount;
}
