/**
 * Agent-to-Agent Communication utility
 * Handles sending messages to other agents
 */

export interface A2AMessage {
  message_id: string;
  from: string;
  to: string;
  type: "chat" | "task" | "event";
  timestamp: number;
  payload: unknown;
}

export interface AgentHandshake {
  agent: string;
  version: string;
  description: string;
  capabilities: {
    accepts: string[];
    routes: {
      handshake: string;
      message: string;
    };
  };
  time: string;
}

/**
 * Sends a message to another agent
 */
export async function sendMessageToAgent(
  targetAgentUrl: string,
  message: Omit<A2AMessage, "timestamp">,
  _env: { [key: string]: any } = {}
): Promise<{ ok: boolean; response?: any; error?: string }> {
  try {
    const fullMessage: A2AMessage = {
      ...message,
      timestamp: Date.now(),
    };

    const response = await fetch(`${targetAgentUrl}/api/agent/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fullMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      response: data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Performs a handshake with another agent to discover capabilities
 */
export async function handshakeWithAgent(
  targetAgentUrl: string,
  _env: { [key: string]: any } = {}
): Promise<{ ok: boolean; handshake?: AgentHandshake; error?: string }> {
  try {
    const response = await fetch(`${targetAgentUrl}/api/agent/handshake`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const handshake = await response.json() as AgentHandshake;
    return {
      ok: true,
      handshake,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generates a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a chat message payload
 */
export function createChatPayload(text: string, metadata?: Record<string, any>) {
  return {
    text,
    ...metadata,
  };
}

/**
 * Creates a task message payload
 */
export function createTaskPayload(task: string, parameters?: Record<string, any>) {
  return {
    task,
    parameters: parameters || {},
  };
}
