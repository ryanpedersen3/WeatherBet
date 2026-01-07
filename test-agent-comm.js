/**
 * Test script for agent-to-agent communication
 * Run with: node test-agent-comm.js <agent-url> [target-agent-url]
 * 
 * Example:
 *   node test-agent-comm.js http://localhost:8787
 *   node test-agent-comm.js http://localhost:8787 http://other-agent.example.com
 */

const AGENT_URL = process.argv[2] || 'http://localhost:8787';
const TARGET_AGENT_URL = process.argv[3];

async function testAgentCommunication() {
  console.log('🧪 Testing WeatherBet Agent Communication\n');
  console.log(`Agent URL: ${AGENT_URL}`);
  if (TARGET_AGENT_URL) {
    console.log(`Target Agent URL: ${TARGET_AGENT_URL}\n`);
  } else {
    console.log('(No target agent URL provided - skipping agent-to-agent tests)\n');
  }

  // Helper function to send requests
  async function request(endpoint, method = 'GET', body = null) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${AGENT_URL}${endpoint}`, options);
      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  // Test 1: Health check
  console.log('1️⃣  Testing health check...');
  const health = await request('/api/health');
  console.log(health.ok ? '✅ Health check passed' : '❌ Health check failed');
  console.log(JSON.stringify(health.data, null, 2));
  console.log('');

  // Test 2: Handshake
  console.log('2️⃣  Testing agent handshake...');
  const handshake = await request('/api/agent/handshake');
  console.log(handshake.ok ? '✅ Handshake successful' : '❌ Handshake failed');
  console.log(`Agent: ${handshake.data?.agent || 'N/A'}`);
  console.log(`Capabilities: ${JSON.stringify(handshake.data?.capabilities?.provides || [], null, 2)}`);
  console.log('');

  // Test 3: Chat message
  console.log('3️⃣  Testing chat message...');
  const chatMessage = {
    message_id: `test_chat_${Date.now()}`,
    from: 'test-script',
    to: 'weatherbet',
    type: 'chat',
    timestamp: Date.now(),
    payload: {
      text: 'What is the weather for upcoming NFL games?',
    },
  };
  const chatResponse = await request('/api/agent/message', 'POST', chatMessage);
  console.log(chatResponse.ok ? '✅ Chat message processed' : '❌ Chat message failed');
  if (chatResponse.data?.reply) {
    console.log('Reply:', chatResponse.data.reply.substring(0, 200) + '...');
  }
  console.log('');

  // Test 4: Task message - get NFL weather
  console.log('4️⃣  Testing task: get_nfl_weather...');
  const taskMessage = {
    message_id: `test_task_${Date.now()}`,
    from: 'test-script',
    to: 'weatherbet',
    type: 'task',
    timestamp: Date.now(),
    payload: {
      task: 'get_nfl_weather',
      parameters: {
        weekOffset: 0,
      },
    },
  };
  const taskResponse = await request('/api/agent/message', 'POST', taskMessage);
  console.log(taskResponse.ok ? '✅ Task executed successfully' : '❌ Task execution failed');
  if (taskResponse.data?.result?.success) {
    console.log(`Found ${taskResponse.data.result.games?.length || 0} games with weather`);
  }
  console.log('');

  // Test 5: Handshake with target agent (if provided)
  if (TARGET_AGENT_URL) {
    console.log('5️⃣  Testing handshake with target agent...');
    const handshakeTask = {
      message_id: `test_handshake_${Date.now()}`,
      from: 'weatherbet',
      to: 'weatherbet',
      type: 'task',
      timestamp: Date.now(),
      payload: {
        task: 'handshake_with_agent',
        parameters: {
          targetAgentUrl: TARGET_AGENT_URL,
        },
      },
    };
    const handshakeTaskResponse = await request('/api/agent/message', 'POST', handshakeTask);
    console.log(handshakeTaskResponse.ok ? '✅ Handshake task executed' : '❌ Handshake task failed');
    if (handshakeTaskResponse.data?.result?.handshake) {
      console.log(`Target agent: ${handshakeTaskResponse.data.result.handshake.agent}`);
      console.log(`Description: ${handshakeTaskResponse.data.result.handshake.description}`);
    }
    console.log('');
  }

  // Test 6: Send message to target agent (if provided)
  if (TARGET_AGENT_URL) {
    console.log('6️⃣  Testing send message to target agent...');
    const sendMessageTask = {
      message_id: `test_send_${Date.now()}`,
      from: 'weatherbet',
      to: 'weatherbet',
      type: 'task',
      timestamp: Date.now(),
      payload: {
        task: 'send_message_to_agent',
        parameters: {
          targetAgentUrl: TARGET_AGENT_URL,
          messageText: 'Hello from WeatherBet agent! This is a test message.',
          messageType: 'chat',
        },
      },
    };
    const sendMessageResponse = await request('/api/agent/message', 'POST', sendMessageTask);
    console.log(sendMessageResponse.ok ? '✅ Message sent to target agent' : '❌ Failed to send message');
    if (sendMessageResponse.data?.result?.response) {
      console.log('Target agent response:', JSON.stringify(sendMessageResponse.data.result.response, null, 2));
    }
    console.log('');
  }

  console.log('✅ All tests completed!');
}

// Run tests
testAgentCommunication().catch(console.error);
