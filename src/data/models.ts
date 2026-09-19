import type { ModelDefinition } from '@/types/factory';

// Product specifications stay unclaimed until an authoritative catalog is connected.
export const models: ModelDefinition[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek V4 Flash',
    category: 'SPEED FACTORY',
    color: '#3689e8',
    position: [-8, 0, -5],
    context: 'Pending catalog verification',
    description:
      'A compact production line for fast-moving ideas. Explore a model route built around responsive, high-throughput workloads.',
  },
  {
    id: 'glm',
    name: 'GLM 5.3',
    category: 'AGENT TOWER',
    color: '#9264df',
    position: [0, 0, -7],
    context: 'Pending catalog verification',
    description:
      "The city's vertical workspace for code and agents. A dedicated route for exploring multi-step, tool-driven workflows.",
  },
  {
    id: 'qwen',
    name: 'Qwen3.6-27B',
    category: 'MODULAR WORKS',
    color: '#e59b24',
    position: [8, 0, -5],
    context: 'Pending catalog verification',
    description:
      'Connected modules, shared possibilities. A flexible model district for building across languages and everyday tasks.',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    category: 'CONTEXT COMPLEX',
    color: '#e16b83',
    position: [-8, 0, 4],
    context: 'Pending catalog verification',
    description:
      'Room for the bigger picture. This expansive factory represents workflows that bring more documents and context together.',
  },
  {
    id: 'llama',
    name: 'Llama',
    category: 'RESEARCH LAB',
    color: '#2aab89',
    position: [0, 0, 7],
    context: 'Varies by model version',
    description:
      'An open space for experimentation. Discover a research district for adapting open models to your own ideas.',
  },
  {
    id: 'gpt-oss',
    name: 'GPT-OSS',
    category: 'COMPUTE PLANT',
    color: '#587887',
    position: [8, 0, 4],
    context: 'Varies by model version',
    description:
      'Open compute, connected to the city. A purpose-built district for exploring reasoning and configurable inference.',
  },
];
