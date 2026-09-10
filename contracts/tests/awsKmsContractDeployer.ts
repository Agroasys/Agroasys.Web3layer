// SPDX-License-Identifier: Apache-2.0
import { expect } from 'chai';
import { Wallet } from 'ethers';
import {
  assertNoRawDeploymentAccounts,
  loadAwsKmsContractDeployerConfig,
} from '../scripts/lib/awsKmsContractDeployer';

describe('AWS KMS contract deployer', function () {
  it('requires both the KMS key and its independently reviewed address', function () {
    expect(() => loadAwsKmsContractDeployerConfig({})).to.throw('DEPLOY_KMS_KEY_ID is required');
    expect(() =>
      loadAwsKmsContractDeployerConfig({ DEPLOY_KMS_KEY_ID: 'alias/deployer' }),
    ).to.throw('DEPLOY_KMS_EXPECTED_ADDRESS is required');
  });

  it('normalizes the reviewed deployer address', function () {
    const config = loadAwsKmsContractDeployerConfig({
      DEPLOY_KMS_KEY_ID: 'alias/cotsel-staging-deployer-signer',
      DEPLOY_KMS_EXPECTED_ADDRESS: '0x1111111111111111111111111111111111111111',
    });

    expect(config).to.deep.equal({
      keyId: 'alias/cotsel-staging-deployer-signer',
      expectedAddress: '0x1111111111111111111111111111111111111111',
    });
  });

  it('rejects an invalid reviewed deployer address', function () {
    expect(() =>
      loadAwsKmsContractDeployerConfig({
        DEPLOY_KMS_KEY_ID: 'alias/cotsel-staging-deployer-signer',
        DEPLOY_KMS_EXPECTED_ADDRESS: 'not-an-address',
      }),
    ).to.throw('DEPLOY_KMS_EXPECTED_ADDRESS must be a valid EVM address');
  });

  it('rejects any configured raw Hardhat deployment account', function () {
    expect(() => assertNoRawDeploymentAccounts([Wallet.createRandom()])).to.throw(
      'PRIVATE_KEY and PRIVATE_KEY2 must not be configured',
    );
    expect(() => assertNoRawDeploymentAccounts([])).not.to.throw();
  });
});
