/**
 * SPDX-License-Identifier: Apache-2.0
 */
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from 'hardhat/config';

const config: HardhatUserConfig = {
  solidity: {
    version:"0.8.28",
    settings: {
      viaIR:true,
      optimizer: {
        enabled: true,
        runs: 200,
      }
    }
  },
  paths: {
    sources: "./src",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    polkadotTestnet: {
      url: 'https://services.polkadothub-rpc.com/testnet',
      chainId: 420420417,
      accounts: (() => {
        const accounts = [vars.get('PRIVATE_KEY')];
        try {
          const secondKey = vars.get('PRIVATE_KEY2');
          if (secondKey) accounts.push(secondKey);
        } catch {
          // PRIVATE_KEY2 is optional
        }
        return accounts;
      })(),
    },
  },
};

export default config;
