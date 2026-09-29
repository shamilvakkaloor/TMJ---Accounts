import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspace } from '../lib/load-state.js';
import { collections } from '../domain/types.js';
import { emptyState } from '../domain/seed.js';
function source(revisions=[7]) {
 let index=0;
 const calls=[], saved=[];
 const state=emptyState();
 state.members=Array.from({length:1357},(_,i)=>({id:`MEMBER${i}`}));
 return {state,calls,saved,
  readRevision: async()=>{calls.push('revision');return revisions[Math.min(index++,revisions.length-1)];},
  readCollection:async name=>{calls.push(name);return state[name];},
  readCache:async()=>null,
  saveCache:snapshot=>saved.push(snapshot),
 };
}
describe('workspace startup',()=>{
 it('loads every record once per collection and checks a consistent revision',async()=>{
  const api=source();const result=await loadWorkspace(api);
  assert.equal(result.state.members.length,1357);
  assert.equal(api.calls.filter(c=>c==='revision').length,2);
  for(const name of collections)assert.equal(api.calls.filter(c=>c===name).length,1);
  assert.equal(api.saved.length,1);
 });
 it('reuses a matching complete snapshot only after a server check',async()=>{
  const api=source();api.readCache=async()=>({state:api.state,revision:7});
  const result=await loadWorkspace(api);assert.equal(result.state,api.state);
  assert.deepEqual(api.calls,['revision']);
 });
 it('reloads stale, incomplete, unavailable or explicitly refreshed snapshots',async()=>{
  for(const mode of ['stale','incomplete','unavailable','force']){
   const api=source();api.readCache=async()=>{
    if(mode==='unavailable')throw Error('Storage blocked');
    return {state:mode==='incomplete'?{}:api.state,revision:mode==='stale'?6:7};
   };
   const result=await loadWorkspace(api,mode==='force');
   assert.equal(result.state.members.length,1357);assert.equal(api.saved.length,1);
  }
 });
 it('never uses a snapshot when the server rejects or cannot verify access',async()=>{
  const api=source();api.readCache=async()=>({state:api.state,revision:7});
  api.readRevision=async()=>{throw Error('Permission denied or offline');};
  await assert.rejects(loadWorkspace(api),/Permission denied/);assert.equal(api.saved.length,0);
 });
 it('retries a concurrent write and refuses perpetually changing snapshots',async()=>{
  const api=source([7,8,8]);const result=await loadWorkspace(api);
  assert.equal(result.revision,8);assert.equal(api.calls.filter(c=>c==='members').length,2);
  assert.equal(api.saved.length,1);
  const changing=source([7,8,9,10]);await assert.rejects(loadWorkspace(changing),/Records changed/);
  assert.equal(changing.saved.length,0);
 });
 it('does not restore old records when the server workspace is empty',async()=>{
  const api=source([-1]);api.readCache=async()=>({state:api.state,revision:7});
  const result=await loadWorkspace(api);assert.equal(result.revision,-1);assert.equal(result.state.members.length,0);
 });
});
