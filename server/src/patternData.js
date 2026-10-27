// The Personal Agent Pattern: who talks to whom, and which part of the Ping Agentic Control Plane decides at each hop.
// Static, mock only. Hosts are .example. Each step is one arrow, walked in order by Simulate.
const json = (obj) => JSON.stringify(obj, null, 2);

const node = (id, label, kind, x, y) => ({ id, label, kind, x, y });
const common = (gatewayLabel) => [
  node('user', 'User', 'actor', 0, 330), node('agent', 'Personal Agent', 'actor', 200, 330), node('llm', 'LLM', 'resource', 200, 520),
  node('gateway', gatewayLabel, 'gateway', 470, 330), node('mcp', 'MCP', 'actor', 740, 330), node('apigw', 'API GW', 'actor', 940, 330),
  node('resource', 'Resource', 'resource', 1140, 330),
  node('iam', 'Agent IAM Core', 'lane-iam', 40, 20), node('authz', 'Agent Authorize', 'lane-authz', 900, 20),
];
const step = (from, to, label, say, payload = null) => ({ from, to, label, say, payload });
const front = [
  step('user', 'agent', 'asks', 'The user asks their personal agent for something. The agent is theirs; it acts for one person.'),
  step('agent', 'llm', 'prompt', 'The agent uses a language model to decide which tool to call. The model never holds a credential.'),
  step('agent', 'iam', 'User authenticates', 'The user signs in through Agent IAM Core. The agent receives a token whose audience is the MCP gateway and whose subject is the user.', json({ aud: 'https://aigateway.example', sub: 'user' })),
];
const back = [
  step('mcp', 'apigw', 'API call', 'The MCP server calls the backend through the API gateway.'),
  step('apigw', 'authz', 'Fine grained', 'Agent Authorize applies finer-grained, business-level rules to this request and data.'),
  step('apigw', 'resource', 'allowed call', 'Only a request that passed both layers reaches the resource.'),
];
const OBO = json({ aud: 'https://mcpserver.example', sub: 'user' });

export const PATHS = [{ id: 'privilege', label: 'Agent Privilege' }, { id: 'ig', label: 'Agent Gateway (IG)' }];

export function buildPattern(path = 'privilege') {
  if (path === 'ig') {
    return {
      title: 'Personal Agent Pattern: Agent Gateway (IG) path',
      intro: 'The same pattern with Agent Gateway (IG) as the MCP gateway. On this path the token exchange (OBO) is shown as available, through Agent IAM Core. UNVERIFIED: what IG enforces at each step has not been confirmed, so only the OBO difference is drawn.',
      paths: PATHS, nodes: common('Agent Gateway (IG)'),
      steps: [...front,
        step('agent', 'gateway', 'MCP / OIDC', 'The agent calls Agent Gateway (IG) over MCP with that token.'),
        step('gateway', 'iam', 'Token exchange (OBO)', 'Agent Gateway (IG) swaps the token through Agent IAM Core for an on-behalf-of token for the MCP server, same subject. It depends on MCP support.', OBO),
        step('gateway', 'mcp', 'MCP', 'Agent Gateway (IG) calls the MCP server with the exchanged token.'), ...back],
    };
  }
  return {
    title: 'Personal Agent Pattern: Agent Privilege path',
    intro: 'One person, one agent. The Ping Agentic Control Plane decides at three points: who the user is (Agent IAM Core), which tools the agent may use (Agent Privilege, which is also the MCP front door) and what the business rules allow (Agent Authorize).',
    paths: PATHS, nodes: common('Agent Privilege'),
    steps: [...front,
      step('agent', 'gateway', 'MCP / OIDC, tool check', 'The agent calls Agent Privilege over MCP with that token. Agent Privilege applies tool-level (coarse to medium grained) authorization: may this user, through this agent, call this tool at all?'),
      step('gateway', 'iam', 'OBO (coming soon)', 'Not available yet. When it is, Agent Privilege will swap the token for an on-behalf-of token for the MCP server (same subject), and it depends on MCP support. Until then the next call uses the credential the MCP server accepts.'),
      step('gateway', 'mcp', 'MCP', 'Agent Privilege uses the credential that server needs: OIDC, a static token or an API key.'), ...back],
  };
}
