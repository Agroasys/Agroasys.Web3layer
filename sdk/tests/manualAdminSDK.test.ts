/**
 * SPDX-License-Identifier: Apache-2.0
 */
import { AdminSDK } from '../src/modules/adminSDK';
import { DisputeStatus } from '../src/types/dispute';
import { TEST_CONFIG, assertRequiredEnv, getAdminSigner, hasRequiredEnv } from './setup';
import type { Signer } from 'ethers';

const isManualE2ERequested = process.env.RUN_E2E === 'true';
const shouldRunManualE2E = isManualE2ERequested && hasRequiredEnv;
const describeIntegration = shouldRunManualE2E ? describe : describe.skip;

function getOptionalEnv(name: string): string | undefined {
    const value = process.env[name];
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function requireManualE2EEnv(name: string): string {
    const value = getOptionalEnv(name);
    if (!value) {
        throw new Error(`Missing required manual E2E environment variable: ${name}`);
    }
    return value;
}

function requireManualE2EBigIntEnv(name: string): bigint {
    const value = requireManualE2EEnv(name);
    try {
        return BigInt(value);
    } catch {
        throw new Error(`Invalid bigint in manual E2E environment variable ${name}: ${value}`);
    }
}

const TEST_TRADE_ID = shouldRunManualE2E ? requireManualE2EBigIntEnv('TEST_TRADE_ID') : 0n;
const TEST_DISPUTE_PROPOSAL_ID = shouldRunManualE2E ? requireManualE2EBigIntEnv('TEST_DISPUTE_PROPOSAL_ID') : 0n;
const TEST_ORACLE_PROPOSAL_ID = shouldRunManualE2E ? requireManualE2EBigIntEnv('TEST_ORACLE_PROPOSAL_ID') : 0n;
const TEST_ADMIN_ADD_PROPOSAL_ID = shouldRunManualE2E ? requireManualE2EBigIntEnv('TEST_ADMIN_ADD_PROPOSAL_ID') : 0n;
const TEST_NEW_ORACLE_ADDRESS = shouldRunManualE2E
    ? requireManualE2EEnv('NEW_ORACLE_ADDRESS')
    : '0x0000000000000000000000000000000000000000';
const TEST_NEW_ADMIN_ADDRESS = shouldRunManualE2E
    ? requireManualE2EEnv('NEW_ADMIN_ADDRESS')
    : '0x0000000000000000000000000000000000000000';

describeIntegration('AdminSDK', () => {
    let adminSDK: AdminSDK;
    let adminSigner1: Signer;
    let adminSigner2: Signer;

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
    });

    test.skip('should pause protocol', async () => {
        const result = await adminSDK.pause(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should propose unpause', async () => {
        const result = await adminSDK.proposeUnpause(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should approve unpause', async () => {
        const result = await adminSDK.approveUnpause(adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should cancel unpause proposal', async () => {
        const result = await adminSDK.cancelUnpauseProposal(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should disable oracle emergency', async () => {
        const result = await adminSDK.disableOracleEmergency(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should propose dispute solution', async () => {
        const result = await adminSDK.proposeDisputeSolution(TEST_TRADE_ID, DisputeStatus.REFUND, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should approve dispute solution', async () => {
        const result = await adminSDK.approveDisputeSolution(TEST_DISPUTE_PROPOSAL_ID, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should cancel expired dispute proposal', async () => {
        const result = await adminSDK.cancelExpiredDisputeProposal(TEST_DISPUTE_PROPOSAL_ID, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should propose oracle update', async () => {
        const result = await adminSDK.proposeOracleUpdate(TEST_NEW_ORACLE_ADDRESS, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should approve oracle update', async () => {
        const result = await adminSDK.approveOracleUpdate(TEST_ORACLE_PROPOSAL_ID, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should execute oracle update', async () => {
        const result = await adminSDK.executeOracleUpdate(TEST_ORACLE_PROPOSAL_ID, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should cancel expired oracle update proposal', async () => {
        const result = await adminSDK.cancelExpiredOracleUpdateProposal(TEST_ORACLE_PROPOSAL_ID, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should propose add admin', async () => {
        const result = await adminSDK.proposeAddAdmin(TEST_NEW_ADMIN_ADDRESS, adminSigner1);

        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should approve add admin', async () => {
        const result = await adminSDK.approveAddAdmin(TEST_ADMIN_ADD_PROPOSAL_ID, adminSigner2);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should execute add admin', async () => {
        const result = await adminSDK.executeAddAdmin(TEST_ADMIN_ADD_PROPOSAL_ID, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should cancel expired add admin proposal', async () => {
        const result = await adminSDK.cancelExpiredAddAdminProposal(TEST_ADMIN_ADD_PROPOSAL_ID, adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    test.skip('should claim', async () => {
        const result = await adminSDK.claim(adminSigner1);
        
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
});
