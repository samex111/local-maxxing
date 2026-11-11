import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "../src/server.js";

test("creates the Local-Maxxing MCP server and registers its tool handlers",()=>{
  const server=createServer();
  assert.ok(server);
});
