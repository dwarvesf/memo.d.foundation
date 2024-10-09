import { pipeline, env } from 'https://fastly.jsdelivr.net/npm/@xenova/transformers@2.17.1';

const transformersEmbeddingsModel = 'Snowflake/snowflake-arctic-embed-l';

class EventQueue {
  constructor(delay, event) {
    this.queue = [];
    this.isProcessing = false;
    this.delay = delay;
    this.event = event
  }

  add(text) {
    this.queue.push(text);
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  async processQueue() {
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const text = this.queue.shift();
      this.dispatchEvent(text);
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    this.isProcessing = false;
  }

  dispatchEvent(text) {
    const event = new CustomEvent(this.event, { detail: { text } });
    window.dispatchEvent(event);
  }
}

queueMicrotask(async () => {
  // Don't load these models on mobile
  if (window.innerWidth <= 768) {
    return;
  }

  // Load transformers.js otherwise
  try {
    console.time(`Initializing transformers.js pipeline with ${transformersEmbeddingsModel}`);

    env.backends.onnx.wasm.wasmPaths = "https://fastly.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/";
    window.pipe = await pipeline('feature-extraction', transformersEmbeddingsModel);

    console.timeEnd(`Initializing transformers.js pipeline with ${transformersEmbeddingsModel}`);
  } catch (error) {
    console.warn('Failed to initialize pipeline:', error);
  }
})

const eventQueue = new EventQueue(500, 'command-palette-search-initialize');
const dispatchSearchPlaceholder = (text) => {
  eventQueue.add(text)
}

const queryAPI = async (sql) => {
  try {
    const response = await fetch('https://dwarvesf--quack-serve.modal.run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error querying API:', error);
    throw error;
  }
};

window.queryAPI = queryAPI;

const parseDuckDBData = (data) => data;

window.parseDuckDBData = parseDuckDBData;

const getEmbeddings = async (query) => {
  console.time('Embedding query')
  const res = window.pipe ? await window.pipe(query, { pooling: 'mean', normalize: true }) : [];
  console.timeEnd('Embedding query')
  return res;
}

window.getEmbeddings = getEmbeddings;

// Initialize search
dispatchSearchPlaceholder('Initializing Search...');
queryAPI('SELECT 1')
  .then(() => {
    console.log('API connection successful');
    dispatchSearchPlaceholder('Search');
  })
  .catch((error) => {
    console.error('Failed to initialize API connection:', error);
    dispatchSearchPlaceholder('Search (Offline)');
  });
