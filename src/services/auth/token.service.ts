import crypto from 'crypto';
import { config } from '../../config/env';
import { UnauthorizedError, ValidationError, ERROR_MESSAGES } from '../../shared/errors';
import {
  CONNECTION_TYPE,
  ClientTokenPayload,
  MintClientTokenInput,
  MintClientTokenResult,
} from './IAuth';

export class TokenService {
  private DEFAULT_TTL = 900;

  private get secret(): string {
    return config.TOKEN_SIGNING_SECRET;
  }

  /**
   * Helper to encode an object to base64url string.
   */
  private base64UrlEncode(obj: Record<string, any>): string {
    return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  }

  /**
   * Helper to decode a base64url string to an object.
   */
  private base64UrlDecode<T>(str: string): T {
    const jsonStr = Buffer.from(str, 'base64url').toString('utf8');
    return JSON.parse(jsonStr) as T;
  }

  /**
   * Generates a signed HMAC-SHA256 signature for base64url header and payload.
   */
  private sign(headerB64: string, payloadB64: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
  }

  /**
   * Mints an ephemeral client connection token (JWT format) signed with HMAC-SHA256.
   */
  public mintClientToken(input: MintClientTokenInput): MintClientTokenResult {
    if (!input.applicationId || typeof input.applicationId !== 'string') {
      throw new ValidationError('Invalid applicationId: must be a non-empty string');
    }
    if (!input.userId || typeof input.userId !== 'string') {
      throw new ValidationError('Invalid userId: must be a non-empty string');
    }

    const ttlSeconds = typeof input.ttlSeconds === 'number' ? input.ttlSeconds : this.DEFAULT_TTL; // Default 15 minutes
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttlSeconds;

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload: ClientTokenPayload = {
      sub: input.userId.trim(),
      appId: input.applicationId.trim(),
      type: CONNECTION_TYPE.CLIENT,
      ...(input.grants ? { grants: input.grants } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      iat: now,
      exp,
    };

    const headerB64 = this.base64UrlEncode(header);
    const payloadB64 = this.base64UrlEncode(payload);
    const signature = this.sign(headerB64, payloadB64, this.secret);

    const token = `${headerB64}.${payloadB64}.${signature}`;

    return {
      token,
      tokenType: 'Bearer',
      expiresAt: new Date(exp * 1000).toISOString(),
      expiresInSeconds: ttlSeconds,
    };
  }

  /**
   * Verifies an ephemeral client connection token's signature, expiry, and payload structure.
   */
  public verifyClientToken(token: string): ClientTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError(ERROR_MESSAGES.MISSING_TOKEN);
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN);
    }

    const [headerB64, payloadB64, signature] = parts;

    // 1. Verify cryptographic signature
    const expectedSignature = this.sign(headerB64, payloadB64, this.secret);
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN);
    }

    // 2. Decode and validate payload structure
    let payload: ClientTokenPayload;
    try {
      payload = this.base64UrlDecode<ClientTokenPayload>(payloadB64);
    } catch {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN);
    }

    if (
      !payload ||
      payload.type !== CONNECTION_TYPE.CLIENT ||
      !payload.sub ||
      !payload.appId ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN);
    }

    // 3. Verify expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new UnauthorizedError(ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN);
    }

    return payload;
  }
}

export const tokenService = new TokenService();
