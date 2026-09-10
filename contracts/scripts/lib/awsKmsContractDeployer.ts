// SPDX-License-Identifier: Apache-2.0
import {
  GetPublicKeyCommand,
  KMSClient,
  KeySpec,
  KeyUsageType,
  MessageType,
  SignCommand,
  SigningAlgorithmSpec,
} from '@aws-sdk/client-kms';
import { KmsEvmSigner, type KmsSigningClient } from '@agroasys/sdk';
import { getAddress, isAddress } from 'ethers';
import type { Provider, Signer } from 'ethers';

export interface AwsKmsContractDeployerConfig {
  keyId: string;
  expectedAddress: string;
}

function requiredEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the canonical Base deployment path`);
  }
  return value;
}

function requiredBytes(value: Uint8Array | undefined, operation: string): Uint8Array {
  if (!value?.length) {
    throw new Error(`AWS KMS ${operation} returned no bytes`);
  }
  return value;
}

export function loadAwsKmsContractDeployerConfig(
  env: NodeJS.ProcessEnv = process.env,
): AwsKmsContractDeployerConfig {
  const keyId = requiredEnv('DEPLOY_KMS_KEY_ID', env);
  const rawExpectedAddress = requiredEnv('DEPLOY_KMS_EXPECTED_ADDRESS', env);
  if (!isAddress(rawExpectedAddress)) {
    throw new Error('DEPLOY_KMS_EXPECTED_ADDRESS must be a valid EVM address');
  }

  return { keyId, expectedAddress: getAddress(rawExpectedAddress) };
}

export function assertNoRawDeploymentAccounts(signers: readonly Signer[]): void {
  if (signers.length > 0) {
    throw new Error(
      'PRIVATE_KEY and PRIVATE_KEY2 must not be configured for the canonical KMS deployment path',
    );
  }
}

export function createAwsKmsContractDeployer(
  config: AwsKmsContractDeployerConfig,
  provider: Provider,
  kms = new KMSClient({}),
): KmsEvmSigner {
  const client: KmsSigningClient = {
    async getPublicKey(keyId) {
      const result = await kms.send(new GetPublicKeyCommand({ KeyId: keyId }));
      if (
        result.KeySpec !== KeySpec.ECC_SECG_P256K1 ||
        result.KeyUsage !== KeyUsageType.SIGN_VERIFY
      ) {
        throw new Error('Contract deployer KMS key must be ECC_SECG_P256K1 with SIGN_VERIFY usage');
      }
      return requiredBytes(result.PublicKey, 'GetPublicKey');
    },
    async signDigest(keyId, digest) {
      const result = await kms.send(
        new SignCommand({
          KeyId: keyId,
          Message: digest,
          MessageType: MessageType.DIGEST,
          SigningAlgorithm: SigningAlgorithmSpec.ECDSA_SHA_256,
        }),
      );
      return requiredBytes(result.Signature, 'Sign');
    },
  };

  return new KmsEvmSigner(client, config, provider);
}

export async function resolveAwsKmsContractDeployer(input: {
  provider: Provider;
  hardhatSigners: readonly Signer[];
  env?: NodeJS.ProcessEnv;
  kms?: KMSClient;
}): Promise<{ signer: KmsEvmSigner; address: string; keyId: string }> {
  assertNoRawDeploymentAccounts(input.hardhatSigners);
  const config = loadAwsKmsContractDeployerConfig(input.env);
  const signer = createAwsKmsContractDeployer(config, input.provider, input.kms);
  const address = await signer.getAddress();
  return { signer, address, keyId: config.keyId };
}
