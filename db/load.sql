COPY commit_history FROM 'db/commit_history.parquet' (FORMAT 'parquet');
COPY vault FROM 'db/vault.parquet' (FORMAT 'parquet');
