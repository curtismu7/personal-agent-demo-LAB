// The Personal Agent Pattern: who talks to whom, and which part of the Ping Agentic Control Plane decides at each hop.
// Static, mock only. Hosts are .example. Each step is one arrow, walked in order by Simulate.
const json = (obj) => JSON.stringify(obj, null, 2);

export const NODES = [
  { id: 'user', label: 'User', kind: 'actor', x: 0, y: 330 },
  { id: 'agent', label: 'Personal Agent', kind: 'actor', x: 200, y: 330 },
  { id: 'llm', label: 'LLM', kind: 'resource', x: 200, y: 520 },
  { id: 'gateway', label: 'PingOne Privilege AI Gateway (MCP)', kind: 'gateway', x: 470, y: 330 },
  { id: 'mcp', label: 'MCP', kind: 'actor', x: 740, y: 330 },
  { id: 'apigw', label: 'API GW', kind: 'actor', x: 940, y: 330 },
  { id: 'resource', label: 'Resource', kind: 'resource', x: 1140, y: 330 },
  { id: 'iam', label: 'Agent IAM Core', kind: 'lane-iam', x: 170, y: 20 },
  { id: 'priv', label: 'Agent Privilege', kind: 'lane-priv', x: 560, y: 20 },
  { id: 'authz', label: 'Agent Authorize', kind: 'lane-authz', x: 950, y: 20 },
];

export const STEPS = [
  { from: 'user', to: 'agent', label: 'asks', say: 'The user asks their personal agent for something. The agent is theirs; it acts for one person.', payload: null },
  { from: 'agent', to: 'llm', label: 'prompt', say: 'The agent uses a language model to decide which tool to call. The model never holds a credential.', payload: null },
  { from: 'agent', to: 'iam', label: 'User authenticates', say: 'The user signs in through Agent IAM Core. The agent receives a token whose audience is the AI gateway and whose subject is the user.', payload: json({ aud: 'https://aigateway.example', sub: 'user' }) },
  { from: 'agent', to: 'gateway', label: 'MCP / OIDC', say: 'The agent calls the gateway over MCP, presenting that token.', payload: null },
  { from: 'gateway', to: 'iam', label: 'Token exchange (optional)', say: 'Optional, and it depends on what the MCP server supports: the gateway swaps the token for an on-behalf-of token for the MCP server, same subject, new audience.', payload: json({ aud: 'https://mcpserver.example', sub: 'user' }) },
  { from: 'gateway', to: 'priv', label: 'Coarse to medium grained', say: 'Agent Privilege applies tool-level authorization: may this user, through this agent, call this tool at all?', payload: null },
  { from: 'gateway', to: 'mcp', label: 'MCP', say: 'The gateway calls the MCP server using whichever credential that server needs: OIDC, a static token or an API key.', payload: null },
  { from: 'mcp', to: 'apigw', label: 'API call', say: 'The MCP server calls the backend through the API gateway.', payload: null },
  { from: 'apigw', to: 'authz', label: 'Fine grained', say: 'Agent Authorize applies finer-grained, business-level rules to the specific request and data.', payload: null },
  { from: 'apigw', to: 'resource', label: 'allowed call', say: 'Only a request that passed both layers reaches the resource.', payload: null },
];

export const PATTERN = {
  title: 'Personal Agent Pattern',
  intro: 'One person, one agent. The Ping Agentic Control Plane decides at three points: who the user is (Agent IAM Core), which tools the agent may use (Agent Privilege) and what the business rules allow (Agent Authorize).',
  nodes: NODES,
  steps: STEPS,
};
