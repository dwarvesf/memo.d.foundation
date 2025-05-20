import { Prompt } from '@/types';

/**
 * Gets the list of available prompts
 * TODO: Implement this function to fetch prompts from a source
 * @returns Array of prompts
 */
export function getPrompts(): Prompt[] {
  // TODO: Implement this function to fetch prompts from a source
  const dummyPrompts: Prompt[] = [
    {
      title: 'Example Prompt 1',
      description: 'This is an example prompt description.',
      prompt: 'What is the capital of France?',
      tags: ['General Knowledge', 'Geography'],
      category: 'General Knowledge',
    },
    {
      title: 'Example Prompt 2',
      description: `This is another example prompt description.`,
      prompt: `Explain the theory of relativity.\n\`\`\`sql
  SHOW DATABASES;\n
  SELECT * FROM users WHERE age > 30;\n
  SELECT * FROM orders WHERE total > 100;
  \`\`\``,
      tags: ['Science', 'Physics'],
      category: 'General Knowledge',
      models: ['OpenAI'],
    },
    {
      title: 'Example Prompt 3',
      description: `This is another example prompt description.`,
      prompt: `Explain \n{hello} \n {{how}} \n {{{hello}}} the theory of relativity.`,
      tags: ['Science', 'Physics'],
      category: 'Physics',
      models: ['OpenAI', 'Claude'],
    },
    {
      title: 'Example Prompt 4',
      description: `This is another example prompt description.`,
      prompt: `Explain the theory of relativity.\n\`\`\`sql
  SHOW DATABASES;\n
  SELECT * FROM users WHERE age > 30;\n
  SELECT * FROM orders WHERE total > 100;
  \`\`\``,
      tags: ['Science', 'Physics', 'Technology'],
      category: 'General Knowledge',
    },
    {
      title: 'Example Prompt 5',
      description: `This is another example prompt description.`,
      prompt: `Explain the theory of relativity.\n\`\`\`sql
  SHOW DATABASES;\n
  SELECT * FROM users WHERE age > 30;\n
  SELECT * FROM orders WHERE total > 100;\n
  \`\`\``,
      tags: ['Science', 'Physics', 'Technology'],
      category: 'Technologies',
    },
  ];
  return dummyPrompts;
}
