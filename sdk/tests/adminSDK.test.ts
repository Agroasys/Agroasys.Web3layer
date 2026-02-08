import { AdminSDK } from '../src/modules/adminSDK';
import { DisputeStatus } from '../src/types/dispute';
import { TEST_CONFIG, getAdminSigner } from './setup';

describe('AdminSDK', () => {
    let adminSDK: AdminSDK;
    let adminSigner1: any;
    let adminSigner2: any;

    beforeAll(() => {
        adminSDK = new AdminSDK(TEST_CONFIG);
        adminSigner1 = getAdminSigner(1);
        adminSigner2 = getAdminSigner(2);
    });

    test('should verify admin status', async () => {
        const adminAddress1 = await adminSigner1.getAddress();
        const isAdmin1 = await adminSDK.isAdmin(adminAddress1);

        const adminAddress2 = await adminSigner1.getAddress();
        const isAdmin2 = await adminSDK.isAdmin(adminAddress2);
        
        expect(isAdmin1).toBe(true);
        expect(isAdmin2).toBe(true);
        
        console.log(`admins verified`);
    });

    // DISPUTE
    test.skip('should propose dispute solution', async () => {
        const tradeId = 2n; // replace
        
        const result = await adminSDK.proposeDisputeSolution(tradeId,DisputeStatus.REFUND,adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`dispute solution proposed:`, result);
    });

    test.skip('should approve dispute solution', async () => {
        const proposalId = 1n; // replace
        
        const result = await adminSDK.approveDisputeSolution(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`dispute solution approved: ${result.txHash}`);
    });

    // ORALCE UPDATES
    test.skip('should propose oracle update', async () => {
        const newOracle = '0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D';
        
        const result = await adminSDK.proposeOracleUpdate(newOracle, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`oracle update proposed:`, result);
    });

    test.skip('should approve oracle update', async () => {
        const proposalId = 1n; // replace

        const result = await adminSDK.approveOracleUpdate(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`oracle update proposed:`, result);
    });

    test.skip('should execute oracle update', async () => {
        const proposalId = 0n; // replace

        const result = await adminSDK.executeOracleUpdate(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`oracle update executed:`, result);
    });



    // ADMIN ADD
    test.skip('should propose add admin', async () => {
        const newAdmin = '0xc7fFC27f58117f13BEE926dF9821C7da5826ce23';
        
        const result = await adminSDK.proposeAddAdmin(newAdmin, adminSigner1);

        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`admin add proposed:`, result);
    });

    test.skip('should approve  add admin', async () => {
        const proposalId = 1n; // replace

        const result = await adminSDK.approveAddAdmin(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`admin add approved:`, result);
    });

    test.skip('should execute add admin', async () => {
        const proposalId = 0n; // replace

        const result = await adminSDK.executeAddAdmin(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`admin add execute:`, result);
    });
});