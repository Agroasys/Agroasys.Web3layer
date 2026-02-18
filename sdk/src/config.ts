/**
 * SPDX-License-Identifier: Apache-2.0
 */
export interface Config {
    // network
    rpc: string;
    chainId: number;

    // contracts
    escrowAddress: string;
    usdcAddress: string;
}