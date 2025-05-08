COPY processing_metadata FROM '../../db/processing_metadata.parquet' (FORMAT 'parquet');
COPY vault FROM '../../db/vault.parquet' (FORMAT 'parquet');
