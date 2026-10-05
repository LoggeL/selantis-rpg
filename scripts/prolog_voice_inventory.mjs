#!/usr/bin/env node
/** Offline prologue AST inventory. --freeze writes a reviewed snapshot; --check verifies it without mutation. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('../game/node_modules/typescript');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const target = path.join(root, 'docs/voice-production/prolog-lines.json');
const files = ['rat', 'schlacht', 'flucht', 'zuflucht'].map(n => `game/src/chapters/prolog/${n}.ts`);
const freezeFiles = [...files, 'game/src/chapters/prolog/council.ts', 'game/src/chapters/prolog/catalog.ts', 'game/src/chapters/prolog/index.ts', 'game/src/ui/text.ts'];
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const source_hashes = Object.fromEntries(freezeFiles.map(f => [f, sha(fs.readFileSync(path.join(root, f)))]));
const markup = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(root, 'game/src/ui/text.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(markup.exports);
const plain = s => markup.exports.stripMarkup(s).replace(/\s+/gu, ' ').trim();
const aliasMappings = { 'prolog-falke': 'falke', falke: 'falke', 'prolog-axtkaempfer': 'baris-young', baris: 'baris-young', 'prolog-stimme': 'bauer', 'fackel-1': 'fackeltraeger', 'fackel-2': 'fackeltraeger', 'fackel-furt': 'fackeltraeger', 'prolog-fackeltraeger': 'fackeltraeger', 'abtr-r2': 'loyla', 'abtr-r4': 'rikkon', 'rat-l1': 'burm', 'rat-r3': 'gwynn', 'rat-r5': 'samira', aelteste: 'gira', hagere: 'tholoss', wortfuehrer: 'ulfbert' };
const canonical = s => aliasMappings[s] ?? s;
const lines = new Map(), excluded = [];
function fail(n, why) { throw new Error(`${n.getSourceFile().fileName}:${n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1}: ${why}: ${n.getText()}`); }
function source(n) { const sf=n.getSourceFile(); return { file:sf.fileName, line:sf.getLineAndCharacterOfPosition(n.getStart()).line+1, start:n.getStart(), end:n.getEnd(), expression_sha256:sha(n.getText()) }; }
function literals(n) {
  if (ts.isStringLiteralLike(n)) return [n.text];
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) return literals(n.expression);
  if (ts.isConditionalExpression(n)) return [...literals(n.whenTrue), ...literals(n.whenFalse)];
  if (ts.isArrayLiteralExpression(n)) return n.elements.flatMap(literals);
  if (ts.isElementAccessExpression(n) && ts.isArrayLiteralExpression(n.expression)) return literals(n.expression);
  fail(n, 'Unresolved spoken text, explicit review required');
}
function exclude(n, reason, text=n.getText()) { excluded.push({reason,text,sources:[source(n)]}); }
function add(n, kind, runtime, display, mood) {
  const text=plain(display); if(!text) fail(n,'Empty spoken text');
  let speaker=canonical(runtime);
  if(kind==='say' && runtime==='narrator' && ['Wer für das Wächteramt stimmt, hebe die Hand.', 'Wer dafür stimmt, die Urmacht zu nutzen …'].includes(text)) speaker='valentus';
  const key=`${kind}\0${speaker}\0${text}`;
  const id=`prolog-${sha(key).slice(0,24)}`;
  const scene='prolog-'+path.basename(n.getSourceFile().fileName,'.ts');
  const direction_en = kind==='think' ? (scene==='prolog-flucht' ? 'Private inner thought of a wounded old man fleeing pursuit. Breath strained, pain and exhaustion; words clear.' : scene==='prolog-zuflucht' ? 'Private inner thought of a dying old man. Fragile breath, restrained grief and urgency; no theatrical sobbing.' : 'Private inner thought amid a council conflict. Reflective, wary, increasingly troubled.')+' Speak the German text exactly.' : kind==='narrate' ? (scene==='prolog-flucht' ? 'Narrate a night flight with quiet tension and clear pacing.' : 'Narrate the transfer of a dangerous inheritance and its long silence. Grave, measured pacing.')+' Speak the German text exactly.' : kind==='bark' ? (speaker.startsWith('verwundeter-') ? 'Brief call from a badly wounded soldier. Weak breath, physical pain, clear words.' : speaker==='fackeltraeger' ? 'Short outdoor call during a night pursuit. Project the voice, alert and tense.' : speaker==='baris-young' ? 'Aggressive young warrior battle shout.' : scene==='prolog-rat' ? 'Brief interjection during a tense council argument.' : 'Short in-scene call, clear and directed toward another person.')+' Speak the German text exactly.' : kind==='choice' ? (scene==='prolog-rat' ? 'Selected reply of an elderly council leader. Deliberate, firm, questioning or argumentative as the words require.' : 'Selected reply of a wounded elderly guest. Tired, grateful or quietly curious as the words require.')+' Speak the German text exactly.' : ({angry:'Angry, controlled intensity.',worried:'Concerned and cautious.',determined:'Firm determination.',pained:'Wounded, strained by pain.',sad:'Sad, restrained.',happy:'Warm and lightly cheerful.',surprised:'Surprised.',scared:'Frightened.'}[mood] ?? (speaker==='narrator' ? 'Measured story narration. Grave, clear pacing.' : scene==='prolog-flucht'&&speaker==='valentus' ? 'Wounded elderly man fleeing pursuit. Strained breath, pain and exhaustion.' : scene==='prolog-zuflucht'&&speaker==='valentus' ? 'Wounded elderly man near death. Fragile but lucid; restrained urgency.' : scene==='prolog-schlacht' ? 'Tense battlefield dialogue. Project clearly over danger, with urgency.' : 'Natural dialogue. Follow the intention and punctuation of the German words, with restrained emotion.'))+' Speak the German text exactly.';
  if(!lines.has(key)) lines.set(key,{id,scene,speaker,text,display_text:display,kind,direction_en,runtime_speakers:[],sources:[]});
  const row=lines.get(key);if(row.scene!==scene) fail(n,'Cross-scene duplicate needs explicit scene policy');
  if(!row.runtime_speakers.includes(runtime)) row.runtime_speakers.push(runtime);
  const src=source(n);if(!row.sources.some(s=>s.file===src.file&&s.start===src.start))row.sources.push(src);
}
const minor = new Map([
 ['Ihr seid alt geworden, Valentus. Die Welt dreht sich weiter, ob die Tür offen ist oder nicht.','rikkon'],
 ['Der Wortführer spricht für uns vier. Mehr habe ich Euch nicht zu sagen.','loyla'],
 ['Meine Stimme gehört dem Siegel, Großmeister. Wie die meines Vaters vor mir.','burm'],
 ['Vier gegen sechs. Noch. Wenn einer von uns wankt, ist das Siegel verloren.','gwynn'],
 ['Sie reden, als gehöre ihnen die Urmacht schon. Seht nur, wie der Wortführer auf die Tür starrt.','samira']
]);
for(const file of files){
 const sf=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
 const props=o=>Object.fromEntries(o.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text,p.initializer]));
 function visit(n){
  if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
   const method=n.expression.name.text;
   if(['say','think','narrate','choose','bark'].includes(method)){
    const a=n.arguments;
    if(method==='say'&&ts.isTemplateExpression(a[1])){if(!a[1].templateSpans.every(s=>ts.isCallExpression(s.expression)&&ts.isPropertyAccessExpression(s.expression.expression)&&s.expression.expression.name.text==='controlHint'))fail(a[1],'Unexpected dynamic dialogue');exclude(n,'UI-only tutorial containing runtime controls');}
    else if(method==='choose'){
     for(const text of literals(a[0])){
      const quoted=[...text.matchAll(/[„"]([^“”"]+)[“”"]/gu)].map(m=>m[1]);
      if(!quoted.length)fail(a[0],'Unquoted choice requires explicit speech/action classification');
      for(const q of quoted)add(a[0],'choice','valentus',q);
     }
     if(a[1]&&ts.isObjectLiteralExpression(a[1])){const p=props(a[1]);if(p.prompt)exclude(p.prompt,'UI question prompt, even when speaker is Valentus');}
    }else{
     const kind={say:'say',think:'think',narrate:'narrate',bark:'bark'}[method];
     const textNode=a[method==='say'||method==='bark'?1:0];
     if(!textNode)fail(n,'Unsupported actor speech wrapper');
     let runtime=method==='think'?'valentus':method==='narrate'?'narrator':ts.isStringLiteralLike(a[0])?a[0].text:null;
     const mood=a[2]&&ts.isObjectLiteralExpression(a[2])?props(a[2]).mood?.text:undefined;
     for(const text of literals(textNode)){
      if(method==='bark'&&['Wuff! Wuff!'].includes(text)){exclude(textNode,'Dog vocalization belongs to SFX',text);continue;}
      if(!runtime){
       const expr=a[0].getText(sf);
       if(method==='say'&&expr==='seat!.speaker'){const s=minor.get(text);if(!s)fail(n,'Unmapped minor council branch');add(textNode,kind,s,text,mood);continue;}
       if(method==='bark'&&expr==='id'&&text==='Danke, Großmeister …'){for(const s of ['verwundeter-1','verwundeter-2'])add(textNode,kind,s,text);continue;}
       if(method==='bark'&&expr==='guard.id'&&text==='Da ist er! Der Alte!'){for(const s of ['fackel-1','fackel-2','fackel-furt'])add(textNode,kind,s,text);continue;}
       fail(n,'Unresolved speaker');
      }
      add(textNode,kind,runtime,text,mood);
     }
    }
   }else if(['hint','setObjective','caption','chapterCard','hold','plate','emote'].includes(method))exclude(n,'UI/caption/action/emote, not spoken script');
  }
  if(ts.isPropertyAssignment(n)){
   const key=n.name.text;
   if(key==='thought')for(const text of literals(n.initializer))add(n.initializer,'think','valentus',text);
   if(['suspiciousBarks','calmBarks'].includes(key)){
    const p=props(n.parent),actor=p.id?.text;
    if(actor==='spuerhund')exclude(n.initializer,'Dog vocalization belongs to SFX');
    else{if(!p.speaker||!ts.isStringLiteralLike(p.speaker))fail(n,'Guard speaker unresolved');for(const text of literals(n.initializer))add(n.initializer,'bark',p.speaker.text,text);}
   }
   if(['verb','caption'].includes(key))exclude(n,'UI interaction label/caption');
  }
  if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='BARKS'){
   if(!ts.isObjectLiteralExpression(n.initializer))fail(n,'BARKS must remain a static map');
   for(const p of n.initializer.properties){if(!ts.isPropertyAssignment(p))fail(p,'Unsupported BARKS');const actor=p.name.text;if(!aliasMappings[actor])fail(p,'NPC bark actor alias missing');for(const text of literals(p.initializer))add(p.initializer,'bark',actor,text);}
  }
  if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='cries')exclude(n,'Baby vocalizations belong to SFX');
  if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='bubbleAt')exclude(n,'Baby vocalizations belong to SFX');
  ts.forEachChild(n,visit);
 }
 visit(sf);
}
const result={model:'gemini-3.8-flash-tts',language:'de',source_hashes,alias_map:aliasMappings,lines:[...lines.values()].sort((a,b)=>a.id.localeCompare(b.id)),excluded,notes:['All static source branches once; not a single walkthrough. No API or model execution.','Runtime key: kind + NUL + canonicalSpeaker + NUL + stripMarkup(displayText), with whitespace collapsed and trimmed. ID is prolog- plus first24 hex digits of SHA256 of that key.','Choices contain selected quoted player words only; never play them on menu display. Vote choices and subsequent responses are different spoken texts.','Only the two council voting calls presented as narrator are produced as Valentus; runtime_speakers retain narrator for those lines.','Thought speaker is Valentus. Generic prolog-stimme shares Bauer voice. No SFX, lore entries, plate labels or UI tutorials in production lines.','Freeze includes speaker catalogs, chapter registry and actual markup parser. --check fails on source drift, manifest drift, unresolved expressions, duplicate IDs or count drift.']};
result.runtime_lookup=result.lines.flatMap(l=>[...new Set(l.runtime_speakers.map(canonical))].map(speaker=>({kind:l.kind,speaker,text:l.text,asset_id:l.id})));
result.runtime_speaker_overrides=result.lines.filter(l=>l.runtime_speakers.includes('narrator')&&l.speaker!=='narrator').map(l=>({kind:l.kind,runtime_speaker:'narrator',text:l.text,canonical_speaker:l.speaker}));
const ids=new Set(result.lines.map(l=>l.id));if(ids.size!==result.lines.length)throw new Error('Duplicate ID');
if(result.lines.length!==188)throw new Error(`Expected reviewed 188 lines, found ${result.lines.length}`);
const counts={};for(const l of result.lines){counts[l.kind]=(counts[l.kind]??0)+1;}
const speakers={};for(const l of result.lines){speakers[l.speaker]=(speakers[l.speaker]??0)+1;}
const serialized=JSON.stringify(result,null,2)+'\n';
if(process.argv.includes('--freeze')){if(fs.existsSync(target))throw new Error('Existing freeze must be reviewed and explicitly removed before replacement');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,serialized);}
else if(process.argv.includes('--check')){const existing=fs.readFileSync(target,'utf8');if(existing!==serialized)throw new Error('Source or manifest drift: reviewed source freeze does not match current AST');}
else throw new Error('Use --freeze to create snapshot or --check to verify existing snapshot');
console.log(JSON.stringify({lines:result.lines.length,counts,speakers,source_files:freezeFiles.length},null,2));
