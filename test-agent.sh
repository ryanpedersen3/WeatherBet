#!/bin/bash

# Test script for WeatherBet Agent
# This script tests various agent endpoints and communication

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default agent URL (change if testing deployed agent)
AGENT_URL="${AGENT_URL:-http://localhost:8787}"

echo -e "${BLUE}=== WeatherBet Agent Test Script ===${NC}\n"

# Test 1: Health check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s "${AGENT_URL}/api/health" | jq '.'
echo -e "\n"

# Test 2: Agent handshake
echo -e "${YELLOW}Test 2: Agent Handshake${NC}"
curl -s "${AGENT_URL}/api/agent/handshake" | jq '.'
echo -e "\n"

# Test 3: Get NFL games
echo -e "${YELLOW}Test 3: Get NFL Games${NC}"
curl -s "${AGENT_URL}/api/nfl/games" | jq '.'
echo -e "\n"

# Test 4: Get NFL games with weather
echo -e "${YELLOW}Test 4: Get NFL Games with Weather${NC}"
curl -s "${AGENT_URL}/api/nfl/weather" | jq '.'
echo -e "\n"

# Test 5: Chat message - request NFL weather
echo -e "${YELLOW}Test 5: Chat Message - Request NFL Weather${NC}"
MESSAGE_ID="test_$(date +%s)"
curl -s -X POST "${AGENT_URL}/api/agent/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"message_id\": \"${MESSAGE_ID}\",
    \"from\": \"test-client\",
    \"to\": \"weatherbet\",
    \"type\": \"chat\",
    \"timestamp\": $(date +%s)000,
    \"payload\": {
      \"text\": \"What's the weather for upcoming NFL games?\"
    }
  }" | jq '.'
echo -e "\n"

# Test 6: Task message - get NFL weather
echo -e "${YELLOW}Test 6: Task Message - Get NFL Weather${NC}"
MESSAGE_ID="task_$(date +%s)"
curl -s -X POST "${AGENT_URL}/api/agent/message" \
  -H "Content-Type: application/json" \
  -d "{
    \"message_id\": \"${MESSAGE_ID}\",
    \"from\": \"test-client\",
    \"to\": \"weatherbet\",
    \"type\": \"task\",
    \"timestamp\": $(date +%s)000,
    \"payload\": {
      \"task\": \"get_nfl_weather\",
      \"parameters\": {
        \"weekOffset\": 0
      }
    }
  }" | jq '.'
echo -e "\n"

# Test 7: Respond endpoint
echo -e "${YELLOW}Test 7: Respond Endpoint${NC}"
MESSAGE_ID="respond_$(date +%s)"
curl -s -X POST "${AGENT_URL}/api/agent/respond" \
  -H "Content-Type: application/json" \
  -d "{
    \"message_id\": \"${MESSAGE_ID}\",
    \"from\": \"test-client\",
    \"to\": \"weatherbet\",
    \"type\": \"chat\",
    \"timestamp\": $(date +%s)000,
    \"payload\": {
      \"text\": \"Tell me about NFL games this week\"
    }
  }" | jq '.'
echo -e "\n"

echo -e "${GREEN}=== All Tests Complete ===${NC}"
echo -e "${BLUE}Note: To test agent-to-agent communication, deploy another agent instance${NC}"
echo -e "${BLUE}and use the 'send_message_to_agent' task with the target agent's URL.${NC}"
