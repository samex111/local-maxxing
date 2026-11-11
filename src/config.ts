import {config as loadEnv} from "dotenv";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";

const moduleDir=path.dirname(fileURLToPath(import.meta.url));
const envCandidates=[
  path.resolve(moduleDir,"../../.env"),
  path.resolve(moduleDir,"../.env"),
  path.resolve(process.cwd(),".env")
];
const envPath=envCandidates.find(existsSync);
if(envPath) loadEnv({path:envPath,override:false});

function positive(value:string|undefined,fallback:number):number {
  const parsed=Number.parseInt(value??"",10);
  return Number.isInteger(parsed)&&parsed>0?parsed:fallback;
}
function service(value:string|undefined,fallback:string):string {
  const url=new URL((value??fallback).trim());
  if(url.protocol!=="http:"&&url.protocol!=="https:") throw new Error("Service URLs must use HTTP or HTTPS.");
  return url.toString().replace(/\/+$/,"");
}
const allowedRoots=(process.env.LOCAL_MAXXING_ALLOWED_ROOTS??process.cwd())
  .split(path.delimiter).map(value=>value.trim()).filter(Boolean).map(value=>path.resolve(value));

export const config={
  searxngUrl:service(process.env.SEARXNG_URL,"http://127.0.0.1:8080"),
  crawl4aiUrl:service(process.env.CRAWL4AI_URL,"http://127.0.0.1:11235"),
  crawl4aiApiToken:process.env.CRAWL4AI_API_TOKEN?.trim()||undefined,
  allowedRoots,
  requestTimeoutMs:positive(process.env.LOCAL_MAXXING_REQUEST_TIMEOUT_MS,120000),
  maxCrawlUrls:Math.min(10,positive(process.env.LOCAL_MAXXING_MAX_CRAWL_URLS,5))
};
