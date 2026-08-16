import crypto from 'crypto';

export class CryptoService {
  /**
   * Hashes a raw string (e.g. API key) using SHA-256.
   */
  public hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Safely compares a raw input against a target hash string using timingSafeEqual.
   * Protects against side-channel timing attacks.
   */
  public verifyHash(rawData: string, targetHash: string): boolean {
    const computedHash = this.hash(rawData);

    try {
      const a = Buffer.from(computedHash, 'hex');
      const b = Buffer.from(targetHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Generates a cryptographically secure random token or key.
   */
  public generateSecureToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }
}

export const cryptoService = new CryptoService();
