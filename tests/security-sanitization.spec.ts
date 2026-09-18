import { describe, it, expect } from 'vitest';
import { securitySanitizer } from '../src/middleware';
import { ValidationError } from '../src/shared/errors';

describe('Security Hardening & Input Sanitizer Subsystem', () => {
  it('should strip XSS script tags and HTML elements from text strings', () => {
    const maliciousInput = {
      message: 'Hello <script>alert("XSS")</script> World!',
      details: '<iframe src="http://evil.com"></iframe><b>Bold Text</b>',
    };

    const clean = securitySanitizer.sanitize(maliciousInput);

    expect(clean.message).toBe('Hello  World!');
    expect(clean.details).toBe('Bold Text');
  });

  it('should throw ValidationError on Prototype Pollution key attempts', () => {
    const pollutionAttempt = JSON.parse('{"__proto__": {"admin": true}, "roomId": "call-101"}');

    expect(() => securitySanitizer.sanitize(pollutionAttempt)).toThrow(ValidationError);
    expect(() => securitySanitizer.sanitize(pollutionAttempt)).toThrow(/Dangerous prototype key/);
  });

  it('should throw ValidationError if object nesting depth exceeds 10 levels', () => {
    // Create an object with 12 nested levels
    let deepObject: any = { data: 'deep' };
    for (let i = 0; i < 12; i++) {
      deepObject = { child: deepObject };
    }

    expect(() => securitySanitizer.sanitize(deepObject)).toThrow(ValidationError);
    expect(() => securitySanitizer.sanitize(deepObject)).toThrow(/exceeds maximum allowed limit/);
  });

  it('should preserve clean numbers, booleans, and valid text unchanged', () => {
    const validPayload = {
      roomId: 'call-101',
      participantCount: 4,
      isMuted: false,
      nested: {
        status: 'active',
      },
    };

    const clean = securitySanitizer.sanitize(validPayload);
    expect(clean).toEqual(validPayload);
  });
});
