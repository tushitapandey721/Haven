import { conversationManager } from "../../artifacts/api-server/src/lib/conversation/conversationManager";
import type { Request } from "express";

async function run() {
  const req = {
    headers: { "x-request-id": "demo-verify" },
    log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  } as unknown as Request;

  const testMessages = [
    "hey i have to set up my best friend for our friendship test",
    "plan something with my friend",
    "test my friend",
    "help my friend prepare for an exam",
    "check whether my friend knows me",
    "find something fun to do with my friend",
  ];

  console.log("================================================================================");
  console.log("HAVEN ACTION-CENTRIC SEMANTIC INTENT VERIFICATION");
  console.log("================================================================================");

  for (const msg of testMessages) {
    const res = await conversationManager.handleTurn(req, `verify-${Date.now()}`, [], msg);
    console.log(`\nInput: "${msg}"`);
    console.log(`  -> Action:  ${res.understanding.action ?? "(none)"}`);
    console.log(`  -> Target:  ${res.understanding.target ?? "(none)"}`);
    console.log(`  -> Purpose: ${res.understanding.purpose ?? "(none)"}`);
    console.log(`  -> Goal:    ${res.understanding.currentGoal}`);
    console.log(`  -> Intent:  ${res.understanding.userIntent}`);
    console.log(`  -> Topic:   ${res.understanding.currentTopic}`);
    console.log(`  -> Plan:    [Mode: ${res.plan.mode}, Approach: ${res.plan.approach}]`);
    console.log(`  -> Haven:   "${res.content.slice(0, 160)}..."`);
  }
}

run().catch(console.error);
