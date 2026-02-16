const DEFAULT_RPC_TIMEOUT_MS = 3000;

interface JsonRpcSuccess {
  jsonrpc: string;
  result?: string;
  error?: {
    code?: number;
    message?: string;
  };
}

function formatRpcFailureMessage(rpcUrl: string, reason: string): string {
  return `RPC endpoint is not reachable at startup (RPC_URL=${rpcUrl}). Start a JSON-RPC node or update RPC_URL. Reason: ${reason}`;
}

export async function assertRpcEndpointReachable(
  rpcUrl: string,
  timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let payload: JsonRpcSuccess | null = null;

    try {
      payload = (await response.json()) as JsonRpcSuccess;
    } catch {
      throw new Error('Invalid JSON response');
    }

    if (!payload || payload.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC payload');
    }

    if (payload.error) {
      throw new Error(`RPC error ${payload.error.code ?? 'UNKNOWN'}: ${payload.error.message ?? 'Unknown error'}`);
    }

    if (!payload.result) {
      throw new Error('Missing eth_chainId result');
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(formatRpcFailureMessage(rpcUrl, `Timeout after ${timeoutMs}ms`));
    }

    throw new Error(formatRpcFailureMessage(rpcUrl, error?.message || 'Unknown RPC connection error'));
  } finally {
    clearTimeout(timeout);
  }
}
