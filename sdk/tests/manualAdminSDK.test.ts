/**
 * SPDX-License-Identifier: Apache-2.0
 */
import { AdminSDK } from '../src/modules/adminSDK';
import { DisputeStatus } from '../src/types/dispute';
import { TEST_CONFIG, assertRequiredEnv, getAdminSigner, hasRequiredEnv } from './setup';

const describeIntegration = hasRequiredEnv ? describe : describe.skip;

describeIntegration('AdminSDK', () => {
    let adminSDK: AdminSDK;
    let adminSigner1: any;
    let adminSigner2: any;

    beforeAll(() => {
        assertRequiredEnv();
        adminSDK = new AdminSDK(TEST_CONFIG);
        adminSigner1 = getAdminSigner(1);
        adminSigner2 = getAdminSigner(2);
    });

    test('should verify admin status', async () => {
        const adminAddress1 = await adminSigner1.getAddress();
        const isAdmin1 = await adminSDK.isAdmin(adminAddress1);

        const adminAddress2 = await adminSigner2.getAddress();
        const isAdmin2 = await adminSDK.isAdmin(adminAddress2);
        
        expect(isAdmin1).toBe(true);
        expect(isAdmin2).toBe(true);
        
        console.log(`admins verified`);
    });

    test.skip('should pause protocol', async () => {
        const result = await adminSDK.pause(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`protocol paused: ${result.txHash}`);
    });

    test.skip('should propose unpause', async () => {
        const result = await adminSDK.proposeUnpause(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`unpause proposed: ${result.txHash}`);
    });

    test.skip('should approve unpause', async () => {
        const result = await adminSDK.approveUnpause(adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`unpause approved: ${result.txHash}`);
    });

    test.skip('should cancel unpause proposal', async () => {
        const result = await adminSDK.cancelUnpauseProposal(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`unpause proposal cancelled: ${result.txHash}`);
    });

    test.skip('should disable oracle emergency', async () => {
        const result = await adminSDK.disableOracleEmergency(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`oracle disabled: ${result.txHash}`);
    });

    test.skip('should propose dispute solution', async () => {
        const tradeId = 0n; // replace
        
        const result = await adminSDK.proposeDisputeSolution(tradeId, DisputeStatus.REFUND, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`dispute solution proposed: ${result.txHash}`);
    });

    test.skip('should approve dispute solution', async () => {
        const proposalId = 0n; // replace
        
        const result = await adminSDK.approveDisputeSolution(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`dispute solution approved: ${result.txHash}`);
    });

    test.skip('should cancel expired dispute proposal', async () => {
        const proposalId = 0n; // replace
        
        const result = await adminSDK.cancelExpiredDisputeProposal(proposalId, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`expired dispute proposal cancelled: ${result.txHash}`);
    });

    test.skip('should propose oracle update', async () => {
        const newOracle = '0x20e7E6fC0905E17De2D28E926Ad56324a6844a1D'; // replace
        
        const result = await adminSDK.proposeOracleUpdate(newOracle, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`oracle update proposed: ${result.txHash}`);
    });

    test.skip('should approve oracle update', async () => {
        const proposalId = 0n; // replace

        const result = await adminSDK.approveOracleUpdate(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`oracle update approved: ${result.txHash}`);
    });

    test.skip('should execute oracle update', async () => {
        const proposalId = 0n; // replace

        const result = await adminSDK.executeOracleUpdate(proposalId, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`oracle update executed: ${result.txHash}`);
    });

    test.skip('should cancel expired oracle update proposal', async () => {
        const proposalId = 0n; // replace
        
        const result = await adminSDK.cancelExpiredOracleUpdateProposal(proposalId, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`expired oracle update proposal cancelled: ${result.txHash}`);
    });

    test.skip('should propose add admin', async () => {
        const newAdmin = '0xc7fFC27f58117f13BEE926dF9821C7da5826ce23'; // replace
        
        const result = await adminSDK.proposeAddAdmin(newAdmin, adminSigner1);

        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`admin add proposed: ${result.txHash}`);
    });

    test.skip('should approve add admin', async () => {
        const proposalId = 0n; // replace

        const result = await adminSDK.approveAddAdmin(proposalId, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`admin add approved: ${result.txHash}`);
    });

    test.skip('should execute add admin', async () => {
        const proposalId = 0n; // replace

        const result = await adminSDK.executeAddAdmin(proposalId, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`admin add executed: ${result.txHash}`);
    });

    test.skip('should cancel expired add admin proposal', async () => {
        const proposalId = 0n; // replace
        
        const result = await adminSDK.cancelExpiredAddAdminProposal(proposalId, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        console.log(`expired admin add proposal cancelled: ${result.txHash}`);
    });
});