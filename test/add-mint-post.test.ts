/**
 * @file add-mint-post.test.ts
 * @description Coverage for scripts/add-mint-post.ts, rewritten from ethers to viem.
 * The frontmatter-only suite runs unconditionally. The mint-flow suite spins up a real
 * local anvil chain (skipped if `anvil` is not on PATH), deploys a minimal mock of the
 * mint contract (test/fixtures/mock-mint-contract), and drives processFile()'s actual
 * writeContract -> waitForTransactionReceipt -> parseEventLogs path. The only private
 * key used is anvil's own default account #0, parsed from its stdout banner at
 * startup rather than hardcoded here, it's the well-known, publicly-documented test
 * key behind the "test test test ... junk" mnemonic every Foundry/Hardhat tutorial
 * ships with, zero real value, never valid off a local anvil chain. No real RPC is
 * ever contacted.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawn, type ChildProcess } from 'child_process';
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  extractFrontmatter,
  processFile,
  contractAbi,
  type MintClients,
} from '../scripts/add-mint-post';

const ANVIL_PORT = 8547;
const ANVIL_RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

function hasAnvil(): boolean {
  try {
    execFileSync('anvil', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

let tmpDir: string;

function writeFixtureFile(
  name: string,
  frontmatter: Record<string, unknown>,
): string {
  const filePath = path.join(tmpDir, name);
  const fm = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');
  fs.writeFileSync(filePath, `---\n${fm}\n---\nbody\n`);
  return filePath;
}

describe('processFile frontmatter gates (no chain involved)', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-mint-post-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('a file with no perma_storage_id returns early, never touches the clients', async () => {
    const filePath = writeFixtureFile('no-id.md', {});
    await expect(
      processFile(filePath, null as unknown as MintClients),
    ).resolves.toBeUndefined();
  });

  test('an already-minted file returns early, never touches the clients', async () => {
    const filePath = writeFixtureFile('already-minted.md', {
      perma_storage_id: 'tx123',
      minted_at: '2026-01-01',
      token_id: '5',
    });
    await expect(
      processFile(filePath, null as unknown as MintClients),
    ).resolves.toBeUndefined();
  });
});

describe.skipIf(!hasAnvil())(
  'processFile mint flow (real writeContract on a local anvil chain)',
  () => {
    let anvilProcess: ChildProcess;
    let publicClient: PublicClient;
    let walletClient: WalletClient;
    let account: PrivateKeyAccount;
    let contractAddress: Address;

    beforeAll(async () => {
      let anvilOutput = '';
      anvilProcess = spawn('anvil', ['--port', String(ANVIL_PORT)]);
      anvilProcess.stdout?.on('data', chunk => {
        anvilOutput += chunk.toString();
      });

      // Poll until anvil accepts RPC calls, rather than racing its stdout banner.
      const deadline = Date.now() + 15000;
      const probeClient = createPublicClient({
        transport: http(ANVIL_RPC_URL),
      });
      while (true) {
        try {
          await probeClient.getBlockNumber();
          break;
        } catch (error) {
          if (Date.now() > deadline) throw error;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Anvil's own default account #0 private key, read back from its
      // startup banner (never hardcoded here), see file header.
      const keyMatch = anvilOutput.match(/\(0\) (0x[0-9a-fA-F]{64})/);
      if (!keyMatch) {
        throw new Error(
          "could not find anvil's default account #0 private key in its stdout",
        );
      }
      account = privateKeyToAccount(keyMatch[1] as Hex);

      const transport = http(ANVIL_RPC_URL);
      publicClient = createPublicClient({ transport });
      walletClient = createWalletClient({ account, transport });

      const artifact = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, 'fixtures/mock-mint-contract/artifact.json'),
          'utf8',
        ),
      );
      const deployHash = await walletClient.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        account,
        chain: null,
      });
      const deployReceipt = await publicClient.waitForTransactionReceipt({
        hash: deployHash,
      });
      if (!deployReceipt.contractAddress) {
        throw new Error('mock contract deploy produced no contract address');
      }
      contractAddress = deployReceipt.contractAddress;
    }, 30000);

    afterAll(() => {
      anvilProcess?.kill();
    });

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'add-mint-post-'));
    });
    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('mints a fresh token: writeContract -> receipt -> event decode -> frontmatter update', async () => {
      const filePath = writeFixtureFile('fresh.md', {
        perma_storage_id: 'arweave-tx-fresh',
      });
      const clients: MintClients = {
        publicClient,
        walletClient,
        account,
        contractAddress,
      };

      await processFile(filePath, clients);

      const { data } = extractFrontmatter(filePath);
      expect(data.token_id).toBe('1');
      expect(data.minted_at).toBe(new Date().toISOString().split('T')[0]);

      // Confirm the write actually landed on-chain, not just in the frontmatter.
      const onChainTokenId = await publicClient.readContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getTokenId',
        args: ['arweave-tx-fresh'],
      });
      expect(onChainTokenId).toBe(BigInt(1));
    });

    test('resumed run: token already exists on-chain, frontmatter catches up without minting again', async () => {
      const arweaveTxId = 'arweave-tx-preexisting';
      // Simulate a prior run whose transaction landed but whose frontmatter
      // write was interrupted: the token exists on-chain, the file doesn't
      // know it yet.
      const preMintHash = await walletClient.writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'createTokenType',
        args: [arweaveTxId],
        account,
        chain: null,
      });
      await publicClient.waitForTransactionReceipt({ hash: preMintHash });

      const filePath = writeFixtureFile('resumed.md', {
        perma_storage_id: arweaveTxId,
      });
      const clients: MintClients = {
        publicClient,
        walletClient,
        account,
        contractAddress,
      };

      await processFile(filePath, clients);

      const { data } = extractFrontmatter(filePath);
      // Token 1 was taken by the previous test's fresh mint; this run must
      // pick up the pre-existing token via getTokenId, not mint a new one.
      expect(data.token_id).toBe('2');
      expect(data.minted_at).toBe(new Date().toISOString().split('T')[0]);
    });
  },
);
