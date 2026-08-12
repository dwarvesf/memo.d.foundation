import { Storage } from '@google-cloud/storage';

// Credentials used to come from HashiCorp Vault. That instance is
// decommissioned, so the bucket name and the GCS credentials are read from the
// environment instead. Credentials follow Google's standard Application
// Default Credentials chain (GOOGLE_APPLICATION_CREDENTIALS, gcloud login, or
// the workload identity of the host).
class StorageUtil {
  private bucketName: string;
  private gcsClient: Storage | null;

  constructor() {
    this.bucketName = process.env.LANDING_ZONE_GCS_BUCKET || 'df-landing-zone';
    this.gcsClient = null;
  }

  private _initGcsClient(): Storage {
    if (!this.gcsClient) {
      this.gcsClient = new Storage();
    }
    return this.gcsClient;
  }

  async readData(filePath: string) {
    const gcsClient = this._initGcsClient();
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
