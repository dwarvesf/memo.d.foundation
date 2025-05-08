/**
 * Tag Normalization System
 * 
 * This system processes a list of tags, normalizes them into groups,
 * and marks deprecated tags according to specific rules.
 * It uses a step-by-step AI-assisted approach to ensure accuracy.
 */

import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();
// Load environment variables from .env file

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: API_KEY,
});


const wordDict = {
  ogif: 'OGIF',
  llm: 'LLM',
  ai: 'AI',
  nda: 'NDA',
  aarrr: 'AARRR',
  wala: 'WALA',
  ui: 'UI',
  ux: 'UX',
  rag: 'RAG',
  rfc: 'RFC',
  seo: 'SEO',
  mcp: 'MCP',
  defi: 'DeFi',
  dapp: 'DApp',
  mma: 'MMA',
  saas: 'SaaS',
  web3: 'Web3',
  pm: 'PM',
  qa: 'QA',
  qc: 'QC',
  mbti: 'MBTI',
  dx: 'DX',
  etl: 'ETL',
  evm: 'EVM',
  iot: 'IoT',
  sql: 'SQL',
  nosql: 'NoSQL',
  api: 'API',
  sdk: 'SDK',
};

// Function to make AI API calls
async function callAI(prompt) {
  // Create a system prompt that forces JSON output
  const systemPrompt = `
      You are an AI assistant specialized in tag normalization and categorization.
      You will analyze tags according to specific rules and return your results in valid JSON format.
      Always structure your entire response as a valid JSON object.
      Do not include any explanatory text outside the JSON structure.
    `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    if (!completion.choices[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    // Parse the JSON from the response
    try {
      const jsonResult = JSON.parse(completion.choices[0].message.content);

      return jsonResult;
    } catch (parseError) {
      console.error('Failed to parse JSON from AI response:', parseError);
      // Attempt to extract JSON using regex as fallback
      try {
        const jsonMatch = completion.choices[0].message.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = JSON.parse(jsonMatch[0]);
          console.log('Extracted JSON using regex fallback');

          return extractedJson;
        }
      } catch (regexError) {
        console.error('Regex extraction also failed:', regexError);
      }

      throw new Error('Could not parse JSON from AI response');
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error calling AI service:', errorMessage);
    throw error
  }
}

/**
 * Process a single batch of tags
 * @param {Array<string>} tags - Batch of tags to process
 * @returns {Object} - Normalized and deprecated tags for this batch
 */
export async function processTags(tags) {
  // Step 1: Initial Tag Analysis
  const step1Prompt = `
    Analyze the following list of tags and identify potential groupings based on:
    1. Exact spelling/formatting variants (hyphenation, case, singular/plural)
    2. Minor wording variations (word order, filler words)
    
    The tags to process are: ${JSON.stringify(tags, null, 2)}
    
    For each potential group, note:
    - The most common variant
    - Any misspellings or unclear forms
    - Standalone tags that don't fit into groups
    
    Please provide initial groupings without making modifications to the original tags.
    
    Return your response as a valid JSON object with a "groupings" property containing
    the initial tag groupings.
  `;
  
  console.log("Step 1: Initial tag analysis");
  const step1Result = await callAI(step1Prompt);
  
  // Step 2: Apply Normalization Rules
  const step2Prompt = `
    Based on the initial tag analysis, apply these normalization rules:
    
    1. For each group of related tags:
       a) Use the most common variant as the key
       b) For groups with misspellings, use the most correct variant
       c) All keys and values must exist exactly in the input list
       d) Do NOT modify casing or format
       e) DO NOT create new variants
    
    2. Only group tags that are exact matches in these ways:
       a) Spelling/formatting variants:
          - Different hyphenation ("workflow" vs "work-flow")
          - Letter case differences ("api" vs "API")
          - Singular/plural ("guideline" vs "guidelines")
       b) Same concept, minor wording:
          - Word order ("remote-work" vs "work-remote")
          - Filler words ("guide" vs "quick-guide")
          - Similar concept ("api" vs "api-usage")
    
    3. DO NOT group tags if:
       - They are related but conceptually distinct
       - They just share a common theme
       - You're uncertain about their equivalence
    
    The tags to process are: ${JSON.stringify(tags, null, 2)}

    The initial groupings input are: ${JSON.stringify(step1Result.groupings, null, 2)}
    
    Please refine these groupings according to the rules above.
    
    Return your response as a valid JSON object with a "groupings" property containing
    the refined tag groupings.
  `;
  
  console.log("Step 2: Normalization rules applied");
  const step2Result = await callAI(step2Prompt);
  
  // Step 3: Identify Deprecated Tags
  const step3Prompt = `
    Identify tags that should be marked as deprecated based on these criteria:
    
    1. Low usage:
       - Tags that appear in only 1 file
       - Rarely used variations of common tags
       - One-off or experimental tags
    
    2. Outdated terminology:
       - Legacy technology terms
       - Obsolete methodologies
       - Superseded frameworks or tools
       - Historical project names
    
    3. Unclear or problematic:
       - Single letters or numbers
       - Organization-specific shortcuts
       - Ambiguous acronyms
       - Version numbers or temporary markers
       - Duplicate meanings
      
    The tags to process are: ${JSON.stringify(tags, null, 2)}
    
    The normalized groupings from step 2 are: ${JSON.stringify(step2Result.groupings, null, 2)}
    
    Note: Every tag from the input list must appear exactly once, either in the normalized groups or in the deprecated list.
    
    Return your response as a valid JSON object with a "deprecated" property containing
    an array of tags that should be deprecated.
  `;
  
  console.log("Step 3: Deprecated tags identified");
  const step3Result = await callAI(step3Prompt);
  
  // Step 4: Apply Technical Terms Reference
  const step4Prompt = `
    Reference this list of special technical terms:
    ${JSON.stringify(wordDict, null, 2)}
    
    When normalizing tags:
    - DO NOT automatically convert to dictionary casing
    - Only use forms that exist in the input list
    - The dictionary is for reference only
    - DO NOT create new variants based on the dictionary
    
    The tags to process are: ${JSON.stringify(tags, null, 2)}
    
    The current normalized groupings are: ${JSON.stringify(step2Result.groupings, null, 2)}
    
    The current deprecated tags are: ${JSON.stringify(step3Result.deprecated, null, 2)}
    
    Review and adjust your normalized and deprecated lists to ensure technical terms are handled correctly.
    
    Return your response as a valid JSON object with:
    - A "groupings" property containing the revised normalized groupings
    - A "deprecated" property containing the revised deprecated tags list
  `;
  
  console.log("Step 4: Technical terms reference applied");
  const step4Result = await callAI(step4Prompt);
  
  // Step 5: Format Final Output
  const step5Prompt = `
    Create a JSON object with two properties:
    
    1. "normalized": An object where:
       - Each key is a normalized tag from the input list
       - Each value is an array of related tags (including the key itself)
       - All tags maintain their original casing and formatting
       - Keyed tags are the most common variant from the input list and must be in lowercase
       - If keyed tag is a misspelling, use the most correct variant as the key or correct the keyed tag
    
    2. "deprecated": An array of tags that should be deprecated
    
    The tags to process are: ${JSON.stringify(tags, null, 2)}
    
    The previous analysis normalized groupings are: ${JSON.stringify(step4Result.groupings, null, 2)}
    
    The previous analysis deprecated tags are: ${JSON.stringify(step4Result.deprecated, null, 2)}
    
    Please ensure:
    - Every input tag appears exactly once in either normalized (as key or in array) or deprecated
    - No tag appears in both normalized and deprecated
    - No tag is missing from the output
    - All tags use the exact spelling and format as in the input list
    
    Return your response as a valid JSON object with "normalized" and "deprecated" properties.
  `;
  
  console.log("Step 5: Final output formatted");
  const step5Result = await callAI(step5Prompt);
  
  // Step 6: Verify Final Output
  const step6Prompt = `
    Based on the previous analysis steps, verify the final output:
    
    1. Review the normalized tag groupings:
       - Ensure groups only contain true variations (spelling, casing, hyphenation)
       - Confirm each group represents a single concept
       - Verify the most appropriate variant is used as the key
    
    2. Review the deprecated tags:
       - Confirm they meet at least one deprecation criterion
       - Ensure no valuable tags are incorrectly deprecated
    
    3. Verify the final output:
       - Every input tag appears exactly once
       - All spellings and formats match the input
       - The structure follows the required JSON format

    The tags to process are: ${JSON.stringify(tags, null, 2)}

    The previous analysis step output is: ${JSON.stringify(step5Result, null, 2)}
    
    Please correct any issues found and provide the verified final JSON output.
  `;
  
  console.log("Step 6: Final verification");
  const finalResult = await callAI(step6Prompt);
  
  return {
    normalized: finalResult?.normalized || {},
    deprecated: finalResult?.deprecated || []
  };
}


/**
 * Generate priority categories using OpenAI
 */
export async function generatePriorityCategories(normalizedTags) {
  const tags = [
    ...Object.keys(normalizedTags),
    ...Object.values(normalizedTags).flat(),
  ];

  const priorityPrompt = `
Given these normalized tags, group them into the following priority categories:

AI: Tags related to artificial intelligence, machine learning, neural networks, and AI algorithms
Agent: Tags about autonomous agents, intelligent systems, and agent-based architectures
Data: Tags about data processing, datasets, databases, and data structures
LLM: Tags specifically about language models, transformers, and text generation systems

Tags to categorize: ${JSON.stringify(tags, null, 2)}

RULES:

Only include tags that actually exist in the input list
Each tag should appear in exactly one category (no duplicates across categories)
Omit tags that don't clearly fit into any of the defined categories
When a tag could belong to multiple categories, place it in the more specific category (e.g., "llm-fine-tuning" belongs in "llm" not "ai")

CATEGORY ASSIGNMENT GUIDE:

AI: General AI concepts, machine learning methods, neural networks, optimization algorithms, etc.
Agent: Autonomous systems, agency, multi-agent systems, reinforcement learning agents, embodied AI, etc.
Data: Datasets, databases, data processing, data structures, feature engineering, data visualization, etc.
LLM: Language models, transformers, text generation, embeddings, tokenization, prompt engineering, etc.

Return a JSON object with category keys (ai, agent, data, llm) where each key contains an array of related tags.
Example input: ["machine-learning", "llm", "dataset", "autonomous-agent", "neural-network", "transformer", "reinforcement-learning"]
Example output:
{
  "ai": ["machine-learning", "neural-network", "reinforcement-learning"],
  "agent": ["autonomous-agent"],
  "data": ["dataset"],
  "llm": ["llm", "transformer"]
}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a technical assistant that categorizes tags into priority groups. Only use tags that exist in the input list. Respond with valid JSON only.',
        },
        { role: 'user', content: priorityPrompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    if (!completion.choices[0]?.message?.content) {
      throw new Error('No content in OpenAI response');
    }

    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Error parsing priority categories:', errorMessage);
    return {
      ai: [],
      agent: [],
      data: [],
      llm: [],
    };
  }
}
