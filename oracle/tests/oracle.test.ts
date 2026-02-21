import axios from 'axios';
import { generateRequestHash, verifyRequestSignature, deriveRequestNonce } from '../src/utils/crypto';

const runManualE2E = process.env.RUN_E2E === 'true' || process.env.RUN_MANUAL_E2E === 'true';
const describeManual = runManualE2E ? describe : describe.skip;


describe('Oracle request signing', () => {
    test('should generate and verify a valid request signature', () => {
        const timestamp = Date.now().toString();
        const body = JSON.stringify({ tradeId: '7', requestId: 'req-1' });
        const secret = 'test-secret';

        const signature = generateRequestHash(timestamp, body, secret);
        expect(signature).toMatch(/^[a-f0-9]{64}$/);

        const result = verifyRequestSignature(timestamp, body, signature, secret);
        expect(result).toBe(true);
    });

    test('should reject tampered body signatures', () => {
        const timestamp = Date.now().toString();
        const body = JSON.stringify({ tradeId: '7', requestId: 'req-1' });
        const tamperedBody = JSON.stringify({ tradeId: '8', requestId: 'req-1' });
        const secret = 'test-secret';

        const signature = generateRequestHash(timestamp, body, secret);

        expect(() =>
            verifyRequestSignature(timestamp, tamperedBody, signature, secret)
        ).toThrow('Invalid HMAC signature');
    });

    test('should reject expired timestamp', () => {
        const timestamp = (Date.now() - 10 * 60 * 1000).toString();
        const body = JSON.stringify({ tradeId: '7', requestId: 'req-1' });
        const secret = 'test-secret';

        const signature = generateRequestHash(timestamp, body, secret);

        expect(() =>
            verifyRequestSignature(timestamp, body, signature, secret)
        ).toThrow('Request timestamp too old');
    });

    test('should derive deterministic nonce from request data', () => {
        const timestamp = '1700000000000';
        const body = JSON.stringify({ tradeId: '1', requestId: 'req-abc' });
        const signature = generateRequestHash(timestamp, body, 'secret');

        const nonce1 = deriveRequestNonce(timestamp, body, signature);
        const nonce2 = deriveRequestNonce(timestamp, body, signature);

        expect(nonce1).toMatch(/^[a-f0-9]{64}$/);
        expect(nonce1).toBe(nonce2);
    });
});


describeManual('Oracle API integration (manual)', () => {
    const API_URL = process.env.ORACLE_API_URL || 'http://localhost:3001/api/oracle';
    const API_KEY = process.env.API_KEY || '';
    const HMAC_SECRET = process.env.HMAC_SECRET || '';


    function signedHeaders(body: Record<string, unknown>) {
        const timestamp = Date.now().toString();
        const bodyStr = JSON.stringify(body);
        const signature = generateRequestHash(timestamp, bodyStr, HMAC_SECRET);
        const nonce = deriveRequestNonce(timestamp, bodyStr, signature);

        return {
            Authorization: `Bearer ${API_KEY}`,
            'X-Timestamp': timestamp,
            'X-Signature': signature,
            'X-Nonce': nonce,
            'Content-Type': 'application/json',
        };
    }


    test('GET /health returns ok', async () => {
        const response = await axios.get(`${API_URL}/health`);
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.status).toBe('ok');
    });

    test('GET /ready returns ready', async () => {
        const response = await axios.get(`${API_URL}/ready`);
        expect(response.status).toBe(200);
        expect(response.data.ready).toBe(true);
    });


    test('rejects request without Authorization header', async () => {
        const payload = { tradeId: '1', requestId: `test-${Date.now()}` };
        await expect(
            axios.post(`${API_URL}/release-stage1`, payload, {
                headers: { 'Content-Type': 'application/json' },
            })
        ).rejects.toMatchObject({ response: { status: 401 } });
    });

    test('rejects request with invalid API key', async () => {
        const payload = { tradeId: '1', requestId: `test-${Date.now()}` };
        const timestamp = Date.now().toString();
        const bodyStr = JSON.stringify(payload);
        const signature = generateRequestHash(timestamp, bodyStr, HMAC_SECRET);
        const nonce = deriveRequestNonce(timestamp, bodyStr, signature);

        await expect(
            axios.post(`${API_URL}/release-stage1`, payload, {
                headers: {
                    Authorization: 'Bearer wrong-api-key',
                    'X-Timestamp': timestamp,
                    'X-Signature': signature,
                    'X-Nonce': nonce,
                    'Content-Type': 'application/json',
                },
            })
        ).rejects.toMatchObject({ response: { status: 401 } });
    });

    test('rejects request without HMAC headers', async () => {
        const payload = { tradeId: '1', requestId: `test-${Date.now()}` };
        await expect(
            axios.post(`${API_URL}/release-stage1`, payload, {
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                },
            })
        ).rejects.toMatchObject({ response: { status: 401 } });
    });


    test.skip('POST /release-stage1 accepts signed request', async () => {
        const payload = { tradeId: '99', requestId: `test-${Date.now()}` };

        const response = await axios.post(
            `${API_URL}/release-stage1`,
            payload,
            { headers: signedHeaders(payload) }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data).toMatchObject({
            success: true,
            idempotencyKey: expect.any(String),
            actionKey: expect.stringContaining('RELEASE_STAGE1'),
            status: expect.any(String),
            timestamp: expect.any(String),
        });
    });

    test('POST /confirm-arrival accepts signed request', async () => {
        const payload = { tradeId: '2', requestId: `test-${Date.now()}` };

        const response = await axios.post(
            `${API_URL}/confirm-arrival`,
            payload,
            { headers: signedHeaders(payload) }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data).toMatchObject({
            success: true,
            idempotencyKey: expect.any(String),
            actionKey: expect.stringContaining('CONFIRM_ARRIVAL'),
            status: expect.any(String),
            timestamp: expect.any(String),
        });
    });

    test.skip('POST /finalize-trade accepts signed request', async () => {
        const payload = { tradeId: '0', requestId: `test-${Date.now()}` };

        const response = await axios.post(
            `${API_URL}/finalize-trade`,
            payload,
            { headers: signedHeaders(payload) }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data).toMatchObject({
            success: true,
            idempotencyKey: expect.any(String),
            actionKey: expect.stringContaining('FINALIZE_TRADE'),
            status: expect.any(String),
            timestamp: expect.any(String),
        });
    });


    test.skip('POST /redrive accepts signed request', async () => {
        const payload = {
            tradeId: '1',
            triggerType: 'release-stage1',
            requestId: `redrive-${Date.now()}`,
        };

        const response = await axios.post(
            `${API_URL}/redrive`,
            payload,
            { headers: signedHeaders(payload) }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data).toMatchObject({
            success: true,
            idempotencyKey: expect.any(String),
            actionKey: expect.any(String),
            status: expect.any(String),
            timestamp: expect.any(String),
        });
    });

    test('POST /redrive rejects missing triggerType', async () => {
        const payload = { tradeId: '1', requestId: `test-${Date.now()}` };

        await expect(
            axios.post(`${API_URL}/redrive`, payload, { headers: signedHeaders(payload) })
        ).rejects.toMatchObject({ response: { status: 400 } });
    });


    test('rejects missing tradeId', async () => {
        const payload = { requestId: `test-${Date.now()}` } as any;

        await expect(
            axios.post(`${API_URL}/release-stage1`, payload, { headers: signedHeaders(payload) })
        ).rejects.toMatchObject({ response: { status: 400 } });
    });
});