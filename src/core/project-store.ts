import {createHash,randomUUID} from "node:crypto";
import {lstat,mkdir,readdir,readFile,rename,unlink,writeFile} from "node:fs/promises";
import path from "node:path";
import {FeatureSchema,ManifestSchema,type Feature,type Manifest} from "./schemas.js";
import {assertPathInside} from "./workspace.js";
import {AGENT_INSTRUCTIONS} from "./instructions.js";
const MAX_SOURCE_CHARS=200000;
export interface ProjectPaths {root:string;state:string;projectFile:string;featuresFile:string;progressFile:string;decisionsFile:string;researchDir:string;sourcesDir:string;snippetFile:string;agentsFile:string}
export function projectPaths(root:string):ProjectPaths {const state=path.join(root,".local-maxxing");return {root,state,projectFile:path.join(state,"project.json"),featuresFile:path.join(state,"features.json"),progressFile:path.join(state,"progress.md"),decisionsFile:path.join(state,"decisions.md"),researchDir:path.join(state,"research"),sourcesDir:path.join(state,"research","sources"),snippetFile:path.join(state,"AGENTS_SNIPPET.md"),agentsFile:path.join(root,"AGENTS.md")};}
async function assertDirectory(dir:string){const st=await lstat(dir).catch(()=>null);if(!st||!st.isDirectory()||st.isSymbolicLink())throw new Error("Unsafe or missing project state directory: "+dir);}
export async function assertSafeLayout(p:ProjectPaths){await assertDirectory(p.root);await assertDirectory(p.state);await assertDirectory(p.researchDir);await assertDirectory(p.sourcesDir);}
async function ensureDirectory(dir:string,parent:string){assertPathInside(parent,dir);const st=await lstat(dir).catch(()=>null);if(st){if(!st.isDirectory()||st.isSymbolicLink())throw new Error("Refusing symlink or non-directory: "+dir);}else await mkdir(dir);}
export async function ensureProjectStateDirectories(root:string){const p=projectPaths(root);await ensureDirectory(p.state,root);await ensureDirectory(p.researchDir,p.state);await ensureDirectory(p.sourcesDir,p.state);return p;}
async function atomicWrite(file:string,content:string,parent:string){assertPathInside(parent,file);await assertDirectory(parent);const tmp=file+"."+randomUUID()+".tmp";try{await writeFile(tmp,content,{encoding:"utf8",flag:"wx"});await rename(tmp,file);}catch(error){await unlink(tmp).catch(()=>undefined);throw error;}}
async function readRegular(file:string,parent:string){assertPathInside(parent,file);const st=await lstat(file).catch(()=>null);if(!st||!st.isFile()||st.isSymbolicLink())throw new Error("Expected a regular project state file: "+file);return readFile(file,"utf8");}
export async function writeProjectManifest(p:ProjectPaths,manifest:Manifest){await assertSafeLayout(p);await atomicWrite(p.projectFile,JSON.stringify(ManifestSchema.parse(manifest),null,2)+"\n",p.state);}
export async function readProjectManifest(p:ProjectPaths){await assertSafeLayout(p);return ManifestSchema.parse(JSON.parse(await readRegular(p.projectFile,p.state)));}
export async function writeFeatures(p:ProjectPaths,features:Feature[]){await assertSafeLayout(p);const parsed=features.map(f=>FeatureSchema.parse(f));await atomicWrite(p.featuresFile,JSON.stringify(parsed,null,2)+"\n",p.state);}
export async function readFeatures(p:ProjectPaths){await assertSafeLayout(p);return FeatureSchema.array().parse(JSON.parse(await readRegular(p.featuresFile,p.state)));}
export async function initializeProjectState(root:string,input:{name:string;goal:string;stack:string[];constraints:string[];commands:Manifest["commands"];features:Feature[];installAgentInstructions:boolean}):Promise<{manifest:Manifest;paths:ProjectPaths;taskCount:number;instructionsInstalled:boolean}>{
 const p=projectPaths(root),stateStat=await lstat(p.state).catch(()=>null);
 if(stateStat){if(!stateStat.isDirectory()||stateStat.isSymbolicLink())throw new Error("Refusing unsafe .local-maxxing path.");if((await readdir(p.state)).length)throw new Error("The .local-maxxing directory already contains files. Refusing to overwrite existing project state.");}
 let oldAgents="";
 if(input.installAgentInstructions){const st=await lstat(p.agentsFile).catch(()=>null);if(st?.isSymbolicLink()||(st&&!st.isFile()))throw new Error("Refusing to modify AGENTS.md because it is not a regular file.");if(st)oldAgents=await readFile(p.agentsFile,"utf8");}
 await ensureProjectStateDirectories(root);
 const now=new Date().toISOString(),manifest=ManifestSchema.parse({schemaVersion:1,name:input.name,goal:input.goal,projectPath:root,stack:input.stack,constraints:input.constraints,commands:input.commands,activeTaskId:null,createdAt:now,updatedAt:now});
 await atomicWrite(p.projectFile,JSON.stringify(manifest,null,2)+"\n",p.state);
 await atomicWrite(p.featuresFile,JSON.stringify(input.features.map(f=>FeatureSchema.parse(f)),null,2)+"\n",p.state);
 await atomicWrite(p.progressFile,"# Session progress\n\nNo sessions recorded yet.\n",p.state);
 await atomicWrite(p.decisionsFile,"# Project decisions\n\nRecord durable technical and product decisions here.\n",p.state);
 await atomicWrite(path.join(p.researchDir,"index.md"),"# Research index\n\nSaved sources are listed here as collected.\n",p.researchDir);
 let installed=false;
 if(input.installAgentInstructions){const start="<!-- BEGIN LOCAL-MAXXING MANAGED SECTION -->",end="<!-- END LOCAL-MAXXING MANAGED SECTION -->",a=oldAgents.indexOf(start),b=oldAgents.indexOf(end);const next=a>=0&&b>a?oldAgents.slice(0,a)+AGENT_INSTRUCTIONS+oldAgents.slice(b+end.length):(oldAgents.trimEnd()?oldAgents.trimEnd()+"\n\n":"")+AGENT_INSTRUCTIONS+"\n";await atomicWrite(p.agentsFile,next,root);installed=true;}
 else await atomicWrite(p.snippetFile,AGENT_INSTRUCTIONS+"\n",p.state);
 return {manifest,paths:p,taskCount:input.features.length,instructionsInstalled:installed};
}
export async function appendHandoff(p:ProjectPaths,section:string){await assertSafeLayout(p);const current=await readRegular(p.progressFile,p.state);await atomicWrite(p.progressFile,current.trimEnd()+"\n\n"+section.trim()+"\n",p.state);}
export async function readBoundedFile(file:string,maxChars:number,parent:string){assertPathInside(parent,file);await assertDirectory(parent);const value=await readRegular(file,parent);return value.length>maxChars?value.slice(0,maxChars)+"\n\n[truncated by Local-Maxxing]":value;}
export async function saveResearchSource(p:ProjectPaths,source:{url:string;title:string;markdown:string}){
 await assertSafeLayout(p);const markdown=source.markdown.slice(0,MAX_SOURCE_CHARS),retrievedAt=new Date().toISOString(),sourceId=createHash("sha256").update(source.url+"|"+retrievedAt+"|"+randomUUID()).digest("hex").slice(0,16),title=source.title.trim()||source.url;
 const body="# "+title+"\n\n- URL: "+source.url+"\n- Retrieved: "+retrievedAt+"\n- Source ID: "+sourceId+"\n\n"+markdown+"\n",file=path.join(p.sourcesDir,sourceId+".md");
 await atomicWrite(file,body,p.sourcesDir);const index=path.join(p.researchDir,"index.md");const current=await readRegular(index,p.researchDir);
 await atomicWrite(index,current.trimEnd()+"\n- ["+title.replace(/[\[\]]/g,"")+"](sources/"+sourceId+".md) — "+source.url+"\n",p.researchDir);
 return {sourceId,path:path.relative(p.root,file),title,url:source.url,characters:markdown.length};
}
export async function readResearchSource(p:ProjectPaths,id:string,maxChars:number){await assertSafeLayout(p);if(!/^[a-f0-9]{16}$/.test(id))throw new Error("Invalid source ID.");return (await readRegular(path.join(p.sourcesDir,id+".md"),p.sourcesDir)).slice(0,Math.min(Math.max(maxChars,1000),20000));}
