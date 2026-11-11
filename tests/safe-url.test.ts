import test from "node:test";import assert from "node:assert/strict";import {assertPublicHttpUrl} from "../src/adapters/safe-url.js";
test("rejects file protocol",async()=>assert.rejects(()=>assertPublicHttpUrl("file:///etc/passwd"),/HTTP and HTTPS/i));
test("rejects localhost",async()=>assert.rejects(()=>assertPublicHttpUrl("http://localhost:8080"),/Local/i));
test("rejects private IPs",async()=>assert.rejects(()=>assertPublicHttpUrl("http://192.168.1.10"),/Private/i));
test("rejects loopback IPs",async()=>assert.rejects(()=>assertPublicHttpUrl("http://127.0.0.1"),/Private/i));
