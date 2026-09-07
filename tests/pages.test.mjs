import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../docs/',import.meta.url);
test('Pages shell and manifest resolve every asset under a repository subpath',async()=>{
  const html=await readFile(new URL('index.html',root),'utf8'), manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.start_url,'./'); assert.equal(manifest.scope,'./');
  const paths=[...Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g),m=>m[1]),...manifest.icons.map(i=>i.src)];
  for(const path of paths){ assert.ok(path.startsWith('./'),path); assert.ok((await stat(new URL(path,root))).isFile()); assert.ok(new URL(path,'https://example.com/heatsink-sizing/').pathname.startsWith('/heatsink-sizing/')); }
  await stat(new URL('.nojekyll',root));
});
test('Service Worker installs actual assets, serves offline shell and ignores other scopes',async()=>{
  const source=await readFile(new URL('sw.js',root),'utf8'), handlers={}, cached=new Map(), scope='https://example.com/heatsink-sizing/';
  const storage={put:async(k,v)=>cached.set(k,v),match:async k=>cached.get(typeof k==='string'?k:k.url)};
  const ctx={URL,console,caches:{open:async()=>storage,keys:async()=>[],delete:async()=>true},self:{registration:{scope},location:{origin:'https://example.com'},clients:{claim:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn},fetch:async url=>{const rel=new URL(url).pathname.slice('/heatsink-sizing/'.length),bytes=await readFile(new URL(rel,root));return new Response(bytes);}};
  vm.runInNewContext(source,ctx);
  let pending;handlers.install({waitUntil:x=>pending=x});await pending;
  assert.ok(cached.has(scope+'index.html'));assert.ok(cached.size>=9);
  ctx.fetch=()=>{throw new Error('offline');};
  let response;handlers.fetch({request:{method:'GET',url:scope,mode:'navigate'},respondWith:x=>response=x});
  assert.ok((await (await response).text()).includes('散熱片計算'));
  let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://example.com/other/',mode:'navigate'},respondWith:()=>intercepted=true}); assert.equal(intercepted,false);
});
