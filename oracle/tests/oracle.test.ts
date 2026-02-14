import axios from 'axios';
import { generateRequestHash, verifyRequestSignature } from '../src/utils/crypto';

describe('Oracle request signing', () => {
    test('should generate and verify a valid request signature', () => {
        const timestamp = Date.now().toString();
        const body = JSON.stringify({ tradeId: '7', requestId: 'req-1' });
        const secret = 'test-secret';

        const signature = generateRequestHash(timestamp, body, secret);
        expect(signature).toMatch(/^[a-f0-9]{64}$/);

        expect(() => verifyRequestSignature(timestamp, body, signature, secret)).not.toThrow();
    });

    test('should reject tampered body signatures', () => {
        const timestamp = Date.now().toString();
        const body = JSON.stringify({ tradeId: '7', requestId: 'req-1' });
        const tamperedBody = JSON.stringify({ tradeId: '8', requestId: 'req-1' });
        const secret = 'test-secret';

        const signature = generateRequestHash(timestamp, body, secret);

        expect(() => verifyRequestSignature(timestamp, tamperedBody, signature, secret)).toThrow(
            'Invalid HMAC signature'
        );
    });
});

describe.skip('Oracle API integration (manual)', () => {
    const API_URL = process.env.ORACLE_API_URL || 'http://localhost:3001/api/oracle';
    const API_KEY = process.env.API_KEY || '';
    const HMAC_SECRET = process.env.HMAC_SECRET || '';

    function signedHeaders(payload: Record<string, string>) {
        const timestamp = Date.now().toString();
        const body = JSON.stringify(payload);
        const signature = generateRequestHash(timestamp, body, HMAC_SECRET);

        return {
            Authorization: `Bearer ${API_KEY}`,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'Content-Type': 'application/json',
        };
    }

    test('confirm-arrival endpoint accepts signed request', async () => {
        const payload = { tradeId: '7', requestId: `test-${Date.now()}` };

        const response = await axios.post(
            `${API_URL}/confirm-arrival`,
            payload,
            {
                headers: signedHeaders(payload),
            }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
    });
});
