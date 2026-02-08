import { BuyerSDK } from '../src/modules/buyerSDK';
import { TEST_CONFIG, getBuyerSigner, generateTestRicardianHash, parseUSDC } from './setup';


describe('BuyerSDK', () => {
    let buyerSDK: BuyerSDK;
    let buyerSigner: any;

    beforeAll(() => {
        buyerSDK = new BuyerSDK(TEST_CONFIG);
        buyerSigner = getBuyerSigner();
    });

    test('should get buyer nonce', async () => {
        const buyerAddress = await buyerSigner.getAddress();
        const nonce = await buyerSDK.getBuyerNonce(buyerAddress);
        
        expect(typeof nonce).toBe('bigint');
        expect(nonce).toBeGreaterThanOrEqual(0n);
        
        console.log(`buyer nonce: ${nonce}`);
    });
    
    test('should check USDC balance and allowance', async () => {
        const buyerAddress = await buyerSigner.getAddress();
        
        const balance = await buyerSDK.getUSDCBalance(buyerAddress);
        const allowance = await buyerSDK.getUSDCAllowance(buyerAddress);
        
        expect(typeof balance).toBe('bigint');
        expect(typeof allowance).toBe('bigint');
        
        console.log(`USDC balance: ${balance}`);
        console.log(`USDC allowance: ${allowance}`);
    });

    test('should create a trade (with auto-approve)', async () => {
        const tradeParams = {
            supplier: '0x4aF052cB4B3eC7b58322548021bF254Cc4c80b2c',
            totalAmount: parseUSDC('10000'),
            logisticsAmount: parseUSDC('1000'),
            platformFeesAmount: parseUSDC('500'),
            supplierFirstTranche: parseUSDC('4000'),
            supplierSecondTranche: parseUSDC('4500'),
            ricardianHash: generateTestRicardianHash('test1')
        };

        const result = await buyerSDK.createTrade(tradeParams, buyerSigner);
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`Trade created:`, result.txHash);
    });


    test.skip('should open dispute', async () => {
        const tradeId = 2n; // replace with the trade Id to dispute
        const txHash = await buyerSDK.openDispute(tradeId, buyerSigner);
        console.log(`Dispute opened: ${txHash.txHash}`);
    });
});