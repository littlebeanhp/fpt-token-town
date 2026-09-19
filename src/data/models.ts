import type { ModelDefinition, StopDefinition } from '@/types/factory';

// Districts sit on a 10-unit block grid around the FPT Core. The order below is also the
// tour order: the back row runs left to right, and the front row returns right to left, so
// every Next/Previous step moves to a neighbouring block. Buildings sit 0.9 units behind
// their block centre, which leaves a front plaza for the visitor queue.
// Product specifications stay unclaimed until an authoritative catalog is connected.
export const models: ModelDefinition[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek V4 Flash',
    category: 'SPEED FACTORY',
    color: '#3689e8',
    position: [-10, 0, -10.9],
    context: 'Pending catalog verification',
    description:
      'A compact production line for fast-moving ideas. Explore a model route built around responsive, high-throughput workloads.',
  },
  {
    id: 'glm',
    name: 'GLM 5.3',
    category: 'AGENT TOWER',
    color: '#9264df',
    position: [0, 0, -10.9],
    context: 'Pending catalog verification',
    description:
      "The city's vertical workspace for code and agents. A dedicated route for exploring multi-step, tool-driven workflows.",
  },
  {
    id: 'qwen',
    name: 'Qwen3.6-27B',
    category: 'MODULAR WORKS',
    color: '#e59b24',
    position: [10, 0, -10.9],
    context: 'Pending catalog verification',
    description:
      'Connected modules, shared possibilities. A flexible model district for building across languages and everyday tasks.',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    category: 'CONTEXT COMPLEX',
    color: '#e16b83',
    position: [10, 0, 9.1],
    context: 'Pending catalog verification',
    description:
      'Room for the bigger picture. This expansive factory represents workflows that bring more documents and context together.',
  },
  {
    id: 'llama',
    name: 'Llama',
    category: 'RESEARCH LAB',
    color: '#2aab89',
    position: [0, 0, 9.1],
    context: 'Varies by model version',
    description:
      'An open space for experimentation. Discover a research district for adapting open models to your own ideas.',
  },
  {
    id: 'gpt-oss',
    name: 'GPT-OSS',
    category: 'COMPUTE PLANT',
    color: '#587887',
    position: [-10, 0, 9.1],
    context: 'Varies by model version',
    description:
      'Open compute, connected to the city. A purpose-built district for exploring reasoning and configurable inference.',
  },
];

export const coreStop: StopDefinition = {
  id: 'core',
  name: 'FPT Core',
  category: 'TOKEN ROUTER',
  color: '#f47836',
  position: [0, 0, -0.8],
  description:
    'The heart of the city. Every request arrives here and is routed as tokens to the model districts.',
};

/** Tour order for the locked camera. The FPT Core is the default and home stop. */
export const stops: StopDefinition[] = [coreStop, ...models];
