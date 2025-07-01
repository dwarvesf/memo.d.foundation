COPY processing_metadata FROM '../../db/processing_metadata.parquet' (FORMAT 'parquet');
COPY processing_metadata_backup FROM '../../db/processing_metadata_backup.parquet' (FORMAT 'parquet');
COPY vault FROM '../../db/vault.parquet' (FORMAT 'parquet');
