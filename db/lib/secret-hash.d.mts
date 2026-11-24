export function hashSecret(value: string): Promise<string>;
export function verifySecret(value: string, encoded: string | null | undefined): Promise<boolean>;
export const DUMMY_HASH: string;
