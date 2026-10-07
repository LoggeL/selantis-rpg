#!/usr/bin/env node
/** Independent regressions run the actual AST evaluator and the real current-source scanner. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ts=createRequire(import.meta.url)('../game/node_modules/typescript');
const scanner=fs.readFileSync(path.join(root,'scripts/part2_voice_inventory.mjs'),'utf8');
const evaluatorSource=scanner.slice(scanner.indexOf('function exactBound('),scanner.indexOf('\nfunction strings('));
const fixture=source=>{
 const sf=ts.createSourceFile('fixture.ts',source,ts.ScriptTarget.ES2022,true),declarations=new Map();
 function gather(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))declarations.set(n.name.text,n);if(ts.isParameter(n)&&ts.isIdentifier(n.name))declarations.set(n.name.text,n);ts.forEachChild(n,gather);}gather(sf);
 const decl=n=>ts.isIdentifier(n)?declarations.get(n.text):undefined;
 const evaluate=new Function('ts','decl','propName','evaluatingSpeech','issue','program','root',`${evaluatorSource}; function strings(v){return v.flatMap(x=>typeof x==='string'?[x]:Array.isArray(x)?strings(x):[]);} return {evalNode,exactBound};`)(ts,decl,n=>n.text,false,()=>assert.fail('Fixture unexpectedly required a text binding'),{},root);
 return{sf,declarations,...evaluate};
};
const expression=f=>f.sf.statements.at(-1).expression;
let f=fixture("const counter=0; counter++; counter>0?'later':'first';");
assert.deepEqual(f.evalNode(expression(f)),['later','first'],'Mutable initializer must not suppress later runtime branches');
f=fixture("const v=G.state.flag('tried'); const done=typeof v==='string'&&v?v.split(','):[]; done.length>=3?'exhausted':'try';");
assert.deepEqual(f.evalNode(expression(f)),['exhausted','try'],'Partial fallback evaluation does not prove an empty current state');
f=fixture("const n=Number(G.state.flag('conversation')); ['one','two','three','four','five','six'][n%6];");
for(let n=0;n<12;n++)assert.deepEqual(f.evalNode(expression(f),new Map([[f.declarations.get('n'),[n]]])),[['one','two','three','four','five','six'][n%6]],'Actual modulo counter binds exactly one source text');
f=fixture("const n=Number(G.state.flag('conversation')); ['one','two','three','four','five'][Math.min(n,4)];");
for(let n=0;n<7;n++)assert.deepEqual(f.evalNode(expression(f),new Map([[f.declarations.get('n'),[n]]])),[['one','two','three','four','five'][Math.min(n,4)]],'Clamped repeat keeps its real final line');
f=fixture("const selected={correct:false,wrong:{by:'lia',text:'my words'}}; selected.wrong.by==='lia'?'lia':'mentor';");
assert.deepEqual(f.evalNode(expression(f),new Map([[f.declarations.get('selected'),[{correct:false,wrong:{by:'lia',text:'my words'}}]]])),['lia'],'Selected quiz row retains its authored speaker');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'selantis-part2-inventory-test-'));
try{
 const guardSource=scanner.slice(scanner.indexOf('function verifySourceSnapshot('),scanner.indexOf('\nconst allowArchive='));
 const crypto=await import('node:crypto'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
 const verify=new Function('sha','fs','path',guardSource+';return verifySourceSnapshot;')(sha,fs,path);
 const snapshot=path.join(temp,'snapshot'),workspace=path.join(temp,'workspace');fs.mkdirSync(snapshot);fs.mkdirSync(workspace);
 const sample=path.join(snapshot,'source.ts');fs.writeFileSync(sample,'actual Source');fs.writeFileSync(path.join(workspace,'source.ts'),'actual Source');
 const pins={source_file_sha256:{'source.ts':sha('actual Source')}};
 assert.equal(verify([sample],snapshot,workspace,pins).current_source_matches_snapshot,true);
 fs.writeFileSync(path.join(workspace,'source.ts'),'new Source');assert.throws(()=>verify([sample],snapshot,workspace,pins),/Current Source differs/);
 assert.equal(verify([sample],snapshot,workspace,pins,true).current_source_matches_snapshot,false,'Archived evidence can be inspected but is not current Source');
 fs.writeFileSync(sample,'tampered Source');assert.throws(()=>verify([sample],snapshot,workspace,pins,true),/Frozen Source hash mismatch/);
 assert.throws(()=>execFileSync(process.execPath,[path.join(root,'scripts/part2_voice_inventory.mjs'),'--freeze','--snapshot-only'],{cwd:root,encoding:'utf8',stdio:'pipe'}),/Archived inspection cannot freeze/);
 const proposed=path.join(temp,'current.json');
 execFileSync(process.execPath,[path.join(root,'scripts/part2_voice_inventory.mjs'),'--propose','--output',proposed],{cwd:root,encoding:'utf8'});
 const d=JSON.parse(fs.readFileSync(proposed,'utf8'));
 assert.equal(Object.keys(d.scene_players).length,17,'18th scene has an actual mixed world player instead of one static fallback');
 assert.equal(d.scene_players['e2-kontrolle'],'elnon');
 assert.equal(d.scene_players['e2-kyras-widerstand'],'kyra');
 for(const s of ['e2-gefangene','e2-flicks-verhoer','e2-flicks-erinnerungen','e2-zellengespraeche','e2-flick-entkommt'])assert.equal(d.scene_players[s],'flick');
 assert.ok(!('e2-aufbruch' in d.scene_players));
 assert.deepEqual(d.mixed_scene_players['e2-aufbruch'].flickScript,'flick');
 assert.equal(d.aliases['e2-flick-gefangen'],'flick');assert.equal(d.aliases['e2-lia-stab'],'lia');assert.equal(d.aliases['e2-elnon-gefangen'],'elnon');
 assert.equal(new Set(d.lines.map(l=>l.id)).size,d.lines.length);
 const sourceLine=text=>d.lines.filter(l=>l.text===text);
 assert.ok(sourceLine('Da ist nichts mehr, wo ich anklopfen kann. Nur noch er.').every(l=>l.speaker==='elnon'));
 assert.ok(sourceLine('Da ist nichts mehr, wo ich anklopfen kann. Nur noch er.').length,'Actual exhausted-contact thought survives source census');
 for(const l of d.lines)assert.match(l.id,/^part2-[0-9a-f]{24}$/);
 const dream=d.lines.filter(l=>l.classification==='dream_voice');
 assert.equal(dream.length,5);for(const line of dream)for(const route of line.runtime_keys)assert.equal(route.mood,'neutral','Dream exact sink has no authored runtime mood');assert.equal(dream.filter(l=>l.text==='Lia …!').length,2);
 assert.deepEqual(dream.filter(l=>l.text==='Lia …!').map(l=>l.speaker).sort(),['flick','kyra']);
 const calls=d.lines.filter(l=>l.classification==='staff_practice_call');assert.equal(calls.length,4);for(const l of calls){assert.equal(l.kind,'bark');assert.equal(l.speaker,'ignatius');assert.ok(l.voice_sink.expression.includes("'bark'"));}
 assert.ok(!d.lines.some(l=>['ghul-a','ghul-b','leichenfresser'].includes(l.speaker)),'Creature growls never acquire human profiles');
 assert.ok(!d.lines.some(l=>l.classification==='item_inspection_comment'));
 const seb=d.lines.filter(l=>l.speaker==='sebastian'&&l.sources.some(s=>s.file.endsWith('/logge.ts')&&s.expression.includes('SEB[')));
 assert.equal(seb.length,6);assert.equal(seb.filter(l=>l.mood==='happy').length,3);assert.equal(seb.filter(l=>l.mood==='smirk').length,3);
 const verdict=d.lines.filter(l=>l.sources.some(s=>s.expression.includes('xenoviaVerdict(firstTry)')));assert.equal(verdict.length,3);assert.equal(verdict.filter(l=>l.mood==='happy').length,2);assert.equal(verdict.filter(l=>l.mood==='neutral').length,1);
 const routeKeys=d.runtime_lookup.map(r=>JSON.stringify([r.kind,r.speaker,r.text,r.scene,r.mood]));assert.equal(new Set(routeKeys).size,routeKeys.length,'One actual recording owns a reachable runtime selector');
 assert.equal(d.source_validation.current_source_matches_snapshot,true);assert.equal(d.source_validation.all_snapshot_files_match,true);
 assert.ok(d.lines.some(l=>l.kind==='say'&&l.speaker==='kyra'&&l.text==='Grrr!'),'Authored human vocal is preserved separately from monster SFX');
 if(fs.existsSync(path.join(root,'docs/voice-production/teil-2/lines.json'))){assert.equal(d.unresolved.length,0);assert.ok(d.lines.every(l=>l.review));}
 console.log(JSON.stringify({regressions_passed:true,lines:d.lines.length,routes:d.runtime_lookup.length,unresolved:d.unresolved.length,dream_voice_pairs:dream.length,practice_calls:calls.length,current_source_hashes_verified:true},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
