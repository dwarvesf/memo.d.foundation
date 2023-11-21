import * as params from '@params';

window.docsearch({
  container: '#docsearch',
  appId: params.application_id.trim(),
  indexName: 'note.d.foundation',
  apiKey: params.api_key.trim(),
});