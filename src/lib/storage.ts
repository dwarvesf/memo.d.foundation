import { Storage } from '@google-cloud/storage';
import Vault from 'node-vault';
import { Buffer } from 'buffer';

class StorageUtil {
  private bucketName: string;
  private vaultClient: any;
  private gcsClient: Storage | null;

  constructor() {
    this.bucketName = 'df-landing-zone';
    this.vaultClient = this._initVaultClient();
    this.gcsClient = null;
  }

  private _initVaultClient(): any {
    const vaultToken = process.env.VAULT_TOKEN;
    let vaultUrl = process.env.VAULT_ADDR;
    if (vaultUrl?.endsWith('/')) {
      vaultUrl = vaultUrl.slice(0, -1);
    }
    if (!vaultToken || !vaultUrl) {
      throw new Error(
        'Vault token or Vault address is not set in environment variables',
      );
    }
    return Vault({
      apiVersion: 'v1',
      endpoint: vaultUrl,
      token: vaultToken,
    });
  }

  private async _initGcsClient(): Promise<Storage> {
    if (this.gcsClient) {
      return this.gcsClient;
    }
    const vaultPath = process.env.VAULT_PATH;
    if (!vaultPath) {
      throw new Error('VAULT_PATH environment variable is not set');
    }
    let secret;
    try {
      secret = await this.vaultClient.read(vaultPath);
    } catch (error) {
      console.error(
        `Failed to read Vault secret at path ${vaultPath}: ${(error as Error).message}`,
      );
      throw error;
    }
    const bucketName = secret.data.data.BUCKET_NAME;
    if (bucketName) {
      this.bucketName = bucketName;
    }
    const gcpCredsBase64 = secret.data.data.GCP_SERVICE_ACCOUNT;
    let credsJson;
    try {
      const decoded = Buffer.from(gcpCredsBase64, 'base64').toString('utf-8');
      credsJson = JSON.parse(decoded);
    } catch {
      credsJson = JSON.parse(gcpCredsBase64);
    }
    this.gcsClient = new Storage({ credentials: credsJson });
    return this.gcsClient;
  }

  async readData(filePath: string) {
    const gcsClient = await this._initGcsClient();
    const bucket = gcsClient.bucket(this.bucketName);
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(
        `File ${filePath} does not exist in bucket ${this.bucketName}`,
      );
    }
    const [fileData] = await file.download();
    return fileData;
  }
}

export default StorageUtil;
