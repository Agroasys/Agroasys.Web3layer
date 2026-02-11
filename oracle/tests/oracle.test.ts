import axios from 'axios';

describe('Oracle Test', () => {
    const API_URL = 'http://localhost:3001/api/oracle';
    const API_KEY = process.env.API_KEY;
    
    const TEST_TRADE_ID = '7';

    test.skip('should release stage 1 funds', async () => {
        const idempotencyKey = `test-${Date.now()}`;

        const response = await axios.post(
            `${API_URL}/release-stage1`,
            { tradeId: TEST_TRADE_ID },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Idempotency-Key': idempotencyKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

        console.log('Success!');
        console.log(`TxHash: ${response.data.txHash}`);
        console.log(`Block: ${response.data.blockNumber}`);
    });

    test('should confirm arrival', async () => {
        const idempotencyKey = `test-${Date.now()}`;

        const response = await axios.post(
            `${API_URL}/confirm-arrival`,
            { tradeId: TEST_TRADE_ID },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Idempotency-Key': idempotencyKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

        console.log('Success!');
        console.log(`TxHash: ${response.data.txHash}`);
        console.log(`Block: ${response.data.blockNumber}`);
    });
});