import { describe, it, expect } from 'vitest';
import { tokenService } from '../src/services/auth/token.service';
import { CONNECTION_TYPE } from '../src/services/auth/IAuth';
import { UnauthorizedError, ValidationError } from '../src/shared/errors';

describe('TokenService (Client Ephemeral Connection Tokens)', () => {
  it('should mint a valid signed token with expected payload', () => {
    const result = tokenService.mintClientToken({
      applicationId: 'test-app',
      userId: 'user-alice',
      ttlSeconds: 300,
      grants: {
        allowedRooms: ['room-1', 'room-2'],
        canPublish: true,
      },
      metadata: {
        username: 'Alice',
        role: 'moderator',
      },
    });

    expect(result).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresInSeconds).toBe(300);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Verify token payload
    const payload = tokenService.verifyClientToken(result.token);
    expect(payload.sub).toBe('user-alice');
    expect(payload.appId).toBe('test-app');
    expect(payload.type).toBe(CONNECTION_TYPE.CLIENT);
    expect(payload.grants?.allowedRooms).toEqual(['room-1', 'room-2']);
    expect(payload.grants?.canPublish).toBe(true);
    expect(payload.metadata).toEqual({ username: 'Alice', role: 'moderator' });
  });

  it('should reject minting when applicationId or userId is missing', () => {
    expect(() =>
      tokenService.mintClientToken({
        applicationId: '',
        userId: 'user-1',
      })
    ).toThrow(ValidationError);

    expect(() =>
      tokenService.mintClientToken({
        applicationId: 'test-app',
        userId: '',
      })
    ).toThrow(ValidationError);
  });

  it('should reject verifying malformed token strings', () => {
    expect(() => tokenService.verifyClientToken('')).toThrow(UnauthorizedError);
    expect(() => tokenService.verifyClientToken('invalid.token')).toThrow(UnauthorizedError);
    expect(() => tokenService.verifyClientToken('part1.part2.part3.part4')).toThrow(UnauthorizedError);
  });

  it('should reject tampered token payloads or signatures', () => {
    const result = tokenService.mintClientToken({
      applicationId: 'test-app',
      userId: 'user-alice',
    });

    const [header, payloadB64, signature] = result.token.split('.');

    // Tamper with payload (change userId)
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    decoded.sub = 'impersonated-hacker';
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const tamperedToken = `${header}.${tamperedPayloadB64}.${signature}`;
    expect(() => tokenService.verifyClientToken(tamperedToken)).toThrow(UnauthorizedError);

    // Tamper with signature
    const badSigToken = `${header}.${payloadB64}.invalidsignature123`;
    expect(() => tokenService.verifyClientToken(badSigToken)).toThrow(UnauthorizedError);
  });

  it('should reject expired tokens', () => {
    // Mint token with negative or 0-second TTL
    const expiredResult = tokenService.mintClientToken({
      applicationId: 'test-app',
      userId: 'user-alice',
      ttlSeconds: -10, // already in the past
    });

    expect(() => tokenService.verifyClientToken(expiredResult.token)).toThrow(UnauthorizedError);
  });
});
