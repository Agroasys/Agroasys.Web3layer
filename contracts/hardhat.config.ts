import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from 'hardhat/config';

const config: HardhatUserConfig = {
  solidity: {
    version:"0.8.28",
    settings: {
      viaIR:true,
      optimizer: {
        enabled: true
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
      accounts: [vars.get('PRIVATE_KEY')],
    },
  },
};

export default config;
