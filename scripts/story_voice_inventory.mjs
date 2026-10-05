#!/usr/bin/env node
/** Offline AST census. --propose emits private candidates/audit. --freeze requires zero unresolved. --check verifies the reviewed snapshot. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), ts=require('../game/node_modules/typescript');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const all=walk(path.join(root,'game/src')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts'));
const files=all.filter(f=>/chapters\/(kapitel-[1-5]|common)\//.test(f));
const program=ts.createProgram(all,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true}),checker=program.getTypeChecker();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const markup={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(path.join(root,'game/src/ui/text.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(markup.exports);
const plain=s=>markup.exports.stripMarkup(s).replace(/\s+/gu,' ').trim();
const outputArg=process.argv.indexOf('--output');
const proposed=outputArg>=0?path.resolve(process.argv[outputArg+1]):path.join(root,'output/audio/story-voice/preparation/inventory.private.proposed.json');
const target=path.join(root,'docs/voice-production/story-lines.json');
const decisionArg=process.argv.indexOf('--decisions');
const decisions=decisionArg>=0?JSON.parse(fs.readFileSync(process.argv[decisionArg+1],'utf8')):{};
const raw=[], excluded=[],audit=new Map(), resolved=new Set();let evaluatingSpeech=false;
const keyFor=n=>{const s=source(n);return `${s.file}:${s.start}:${s.expression_sha256}`;};
function source(n){const sf=n.getSourceFile(),p=sf.getLineAndCharacterOfPosition(n.getStart());const anchors=[];let ancestor=n;while(ancestor&&!ts.isFunctionLike(ancestor)&&!ts.isSourceFile(ancestor)){anchors.push(sha(ancestor.getText()));ancestor=ancestor.parent;}let scope=n.parent;while(scope&&!ts.isFunctionDeclaration(scope)&&!ts.isArrowFunction(scope)&&!ts.isFunctionExpression(scope))scope=scope.parent;return {file:path.relative(root,sf.fileName),line:p.line+1,column:p.character+1,start:n.getStart(),end:n.getEnd(),expression:n.getText(),expression_sha256:sha(n.getText()),review_anchor_hashes:anchors,function:scope?.name?.getText()??(scope?'callback':null),chapter:path.relative(root,sf.fileName).match(/chapters\/([^/]+)/)?.[1]??'shared',scene:sceneFor(sf),runtime_scenes:scenesFor(sf)};}
const sceneBindings=new Map();
function bindScene(file,scene,seen=new Set()){
 if(!file||seen.has(file)||!files.includes(file))return;seen=new Set(seen).add(file);
 if(!sceneBindings.has(file))sceneBindings.set(file,new Set());sceneBindings.get(file).add(scene);
 const sf=program.getSourceFile(file);for(const n of sf.statements){if(ts.isImportDeclaration(n)&&ts.isStringLiteralLike(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('./')){let f=path.resolve(path.dirname(file),n.moduleSpecifier.text)+'.ts';if(fs.existsSync(f)&&!f.endsWith('/index.ts')&&!f.endsWith('/catalog.ts'))bindScene(f,scene,seen);}}
}
for(const file of files.filter(f=>f.endsWith('/index.ts'))){const sf=program.getSourceFile(file);function scenes(n){if(ts.isPropertyAssignment(n)&&propName(n.name)==='scenes'&&ts.isArrayLiteralExpression(n.initializer))for(const row of n.initializer.elements){if(!ts.isObjectLiteralExpression(row))continue;const p=Object.fromEntries(row.properties.filter(ts.isPropertyAssignment).map(p=>[propName(p.name),p.initializer]));if(!p.id||!ts.isStringLiteralLike(p.id)||!p.start)continue;function ids(q){if(ts.isIdentifier(q)){const d=decl(q);if(d&&d.getSourceFile().fileName!==file)bindScene(d.getSourceFile().fileName,p.id.text);}ts.forEachChild(q,ids);}ids(p.start);}ts.forEachChild(n,scenes);}scenes(sf);}
function scenesFor(sf){return [...(sceneBindings.get(sf.fileName)??[])].sort();}
function sceneFor(sf){const a=scenesFor(sf);return a.length===1?a[0]:'*';}

function issue(n,role,reason){const k=keyFor(n)+':'+role;audit.set(k,{key:k,source:source(n),role,expression:n.getText(),reason});}
function decl(n){let s=ts.isShorthandPropertyAssignment(n.parent)&&n.parent.name===n?checker.getShorthandAssignmentValueSymbol(n.parent):checker.getSymbolAtLocation(n);if(s?.flags&ts.SymbolFlags.Alias)s=checker.getAliasedSymbol(s);return s?.valueDeclaration??s?.declarations?.[0];}
function propName(n){return ts.isIdentifier(n)||ts.isStringLiteralLike(n)||ts.isNumericLiteral(n)?n.text:null;}
function evalNode(n,env=new Map(),seen=new Set()){
 if(!n||seen.has(n))return [];seen=new Set(seen).add(n);if(env.has(n))return env.get(n);
 if(ts.isStringLiteralLike(n))return [n.text];if(ts.isNumericLiteral(n))return [Number(n.text)];if(n.kind===ts.SyntaxKind.TrueKeyword)return[true];if(n.kind===ts.SyntaxKind.FalseKeyword)return[false];
 if(ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isSatisfiesExpression(n)||ts.isNonNullExpression(n)||ts.isAwaitExpression(n))return evalNode(n.expression,env,seen);
 if(ts.isArrayLiteralExpression(n)){let rows=[[]];for(const e of n.elements){const vv=evalNode(ts.isSpreadElement(e)?e.expression:e,env,seen);if(!vv.length)return [];rows=rows.flatMap(r=>vv.map(v=>r.concat(ts.isSpreadElement(e)&&Array.isArray(v)?v:[v])));}return rows;}
 if(ts.isObjectLiteralExpression(n)){let rows=[{}];for(const p of n.properties){if(ts.isSpreadAssignment(p)){const vv=evalNode(p.expression,env,seen);if(!vv.length)return[];rows=rows.flatMap(r=>vv.map(v=>({...r,...v})));}else if(ts.isPropertyAssignment(p)){const k=propName(p.name);if(!k)return[];const vv=evalNode(p.initializer,env,seen);if(vv.length)rows=rows.flatMap(r=>vv.map(v=>({...r,[k]:v})));}else if(ts.isShorthandPropertyAssignment(p)){const vv=evalNode(p.name,env,seen);if(vv.length)rows=rows.flatMap(r=>vv.map(v=>({...r,[p.name.text]:v})));}}return rows;}
 if(ts.isConditionalExpression(n)){const c=evalNode(n.condition,env,seen);if(c.length&&c.every(v=>!v===!c[0]))return evalNode(c[0]?n.whenTrue:n.whenFalse,env,seen);return [...evalNode(n.whenTrue,env,seen),...evalNode(n.whenFalse,env,seen)];}
 if(ts.isTemplateExpression(n)){let vals=[n.head.text];for(const p of n.templateSpans){const vv=evalNode(p.expression,env,seen).filter(v=>typeof v==='string'||typeof v==='number');if(!vv.length){if(evaluatingSpeech)issue(n,'text','Dynamic template requires explicit binding; no partial-branch skip');return[];}vals=vals.flatMap(a=>vv.map(v=>a+v+p.literal.text));}return vals;}
 if(ts.isBinaryExpression(n)){if(n.operatorToken.kind===ts.SyntaxKind.PlusToken)return evalNode(n.left,env,seen).flatMap(a=>evalNode(n.right,env,seen).map(b=>a+b));if([ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind))return [...evalNode(n.left,env,seen),...evalNode(n.right,env,seen)];return[];}
 if(ts.isPropertyAccessExpression(n)){const vv=evalNode(n.expression,env,seen).flatMap(v=>v?.[n.name.text]!==undefined?[v[n.name.text]]:[]);if(vv.length)return vv;const d=decl(n.name);return d?.initializer?evalNode(d.initializer,env,seen):[];}
 if(ts.isElementAccessExpression(n)){const bases=evalNode(n.expression,env,seen),indices=evalNode(n.argumentExpression,env,seen);return bases.flatMap(b=>indices.length?indices.flatMap(i=>b?.[i]!==undefined?[b[i]]:[]):Array.isArray(b)?b:typeof b==='object'&&b?Object.values(b):[]);}
 if(ts.isIdentifier(n)){const d=decl(n);if(env.has(d))return env.get(d);if(d?.initializer){const initial=evalNode(d.initializer,env,seen);if(initial.some(Array.isArray)){const pushed=[];function findPush(q){if(ts.isCallExpression(q)&&ts.isPropertyAccessExpression(q.expression)&&q.expression.name.text==='push'&&ts.isIdentifier(q.expression.expression)&&decl(q.expression.expression)===d)for(const a of q.arguments)pushed.push(...evalNode(a,env,seen));ts.forEachChild(q,findPush);}findPush(d.getSourceFile());return initial.map(v=>Array.isArray(v)?v.concat(pushed):v);}return initial;}if(d&&ts.isBindingElement(d)){const pat=d.parent,ix=pat.elements.indexOf(d),varDecl=pat.parent;let vs=[];if(ts.isVariableDeclaration(varDecl)&&varDecl.initializer)vs=evalNode(varDecl.initializer,env,seen);else if(ts.isVariableDeclaration(varDecl)&&ts.isVariableDeclarationList(varDecl.parent)&&ts.isForOfStatement(varDecl.parent.parent))vs=evalNode(varDecl.parent.parent.expression,env,seen).flatMap(x=>Array.isArray(x)?x:[]);return vs.flatMap(v=>{let x=ts.isArrayBindingPattern(pat)?v?.[ix]:v?.[d.propertyName?.text??d.name.text];return x===undefined?[]:[x];});}return[];}
 if(ts.isCallExpression(n)){
  if(env.get('__control_bindings')&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='controlHint'){const control=evalNode(n.arguments[0],env,seen)[0];return env.get('__control_bindings')[control]??[];}
  if(env.has('__counter_values')&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='count'&&n.arguments[0]?.text==='k3-stein')return env.get('__counter_values');
  if(ts.isPropertyAccessExpression(n.expression)&&['map','filter','flatMap'].includes(n.expression.name.text)){
   const bases=evalNode(n.expression.expression,env,seen);if(n.expression.name.text==='filter')return bases;
   const callback=n.arguments[0];if(callback&&(ts.isArrowFunction(callback)||ts.isFunctionExpression(callback))){return bases.filter(Array.isArray).map(b=>b.flatMap(v=>{const e=new Map(env);e.set(callback.parameters[0],[v]);if(ts.isBlock(callback.body)){const out=[];function ret(q){if(ts.isReturnStatement(q)&&q.expression)out.push(...evalNode(q.expression,e,seen));else ts.forEachChild(q,ret);}ret(callback.body);return out;}return evalNode(callback.body,e,seen);}));}
  }
  const d=decl(ts.isPropertyAccessExpression(n.expression)?n.expression.name:n.expression),f=d?.initializer??d;
  if(f&&(ts.isFunctionDeclaration(f)||ts.isArrowFunction(f)||ts.isFunctionExpression(f))){const e=new Map(env);for(let i=0;i<f.parameters.length;i++)e.set(f.parameters[i],evalNode(n.arguments[i]??f.parameters[i].initializer,env,seen));if(!ts.isBlock(f.body))return evalNode(f.body,e,seen);const out=[];function ret(q){if(ts.isReturnStatement(q)&&q.expression)out.push(...evalNode(q.expression,e,seen));else if(!ts.isFunctionLike(q))ts.forEachChild(q,ret);}ts.forEachChild(f.body,ret);return out;}
 }
 return[];
}
function strings(v){return v.flatMap(x=>typeof x==='string'?[x]:Array.isArray(x)?strings(x):[]);}
function player(sf){return /kapitel-3\/kyra\.ts$/.test(sf.fileName)?'kyra':'lia';}
function alias(s){const fixed={'k1-narbige':'algard',narbige:'algard','k2-stimme-a':'azar','k2-stimme-b':'foltan','k4-wache':'bruderschaft-wache'};if(fixed[s])return fixed[s];if(s==='grauhaarige')return'orwen';if(s==='kahle'||s==='k1-kahle')return'maedchen';return s.replace(/^k[1-5]-/,'').replace(/-bound$/,'').replace(/-zelt$/,'').replace(/-scarred$/,'');}
function canonical(s,n){return ['player','w.player','G.player'].includes(s)?player(n.getSourceFile()):alias(s);}
function actorIds(n,env){if(ts.isIdentifier(n)){const d=decl(n);if(env.has(d)){const a=env.get(d);return a.flatMap(v=>typeof v==='string'?[v]:v?.speaker?[v.speaker]:v?.id?[v.id]:[]);}}if(ts.isPropertyAccessExpression(n)&&n.name.text==='player')return [player(n.getSourceFile())];if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['actor','spawn','get'].includes(n.expression.name.text)){if(n.arguments[0]&&ts.isObjectLiteralExpression(n.arguments[0]))return evalNode(n.arguments[0],env).map(v=>v.speaker??v.id).filter(Boolean);return strings(evalNode(n.arguments[0],env));}if(ts.isIdentifier(n)){const d=decl(n);if(d?.initializer)return actorIds(d.initializer,env);}return[];}
function exclude(n,reason,text=n.getText()){excluded.push({reason,text,sources:[source(n)]});}
function add(n,text,speaker,kind,mood='neutral',extra={},context){const t=plain(text);if(t.startsWith('♪')){exclude(n,'Root-approved song-only vocal text; existing music remains',text);return;}if(speaker==='ghoul'||/^(?:Chrrr|Chrrrr|pfff|Grrhhh)/iu.test(t.replace(/^[.…\s]+/u,''))) {exclude(n,'Creature growl or sleep vocalization belongs to SFX',text);return;}if(!/[\p{L}\p{N}]/u.test(t)){exclude(n,'Nonlexical vocalization or silence; no ordinary TTS',text);return;}const src=source(context??n);raw.push({scene:src.scene,chapter:src.chapter,speaker:canonical(speaker,n),runtime_speakers:[speaker],kind,text:t,display_text:text,mood,performance_variant:mood,direction_en:direction(kind,mood),sources:context?[src,{...source(n),role:'wrapper_definition'}]:[src],...extra});resolved.add(keyFor(n)+':text');resolved.add(keyFor(n)+':speaker');}
function direction(kind,mood){const d={angry:'Controlled anger; sharpen consonants without constant shouting.',pained:'Pain and strained breath; keep the words intelligible.',hurt:'Wounded, physically strained; restrained suffering.',sad:'Grief or disappointment with restrained intensity.',scared:'Fear and urgency, uneven breath.',worried:'Concerned, cautious delivery.',determined:'Firm resolve, grounded emphasis.',happy:'Warm, lively delivery.',smirk:'Dry, knowing humor.',thinking:'Thoughtful, deliberate pacing.',surprised:'A startled reaction, then clear words.',neutral:'Natural delivery grounded in the scene.'}[mood]??`Author mood: ${mood}.`;return `${kind==='think'?'Private inner thought. ':kind==='narrate'?'Story narration, measured pacing. ':kind==='bark'?'Brief in-scene call. ':kind==='choice'?'Selected player reply. ':''}${d} Speak the German words exactly, without added speech or music.`;}
function textValues(n,env,role='text'){const before=evaluatingSpeech;evaluatingSpeech=true;let v;try{v=strings(evalNode(n,env));}finally{evaluatingSpeech=before;}if(!v.length)issue(n,role,'Static expression could not be resolved');return [...new Set(v)];}
function choices(n,env,owner=n){const vv=evalNode(n,env);if(!vv.length){issue(n,'choice','Choice list unresolved');return;}const opts=vv.flatMap(v=>Array.isArray(v)?v:[v]);for(const o of opts){const t=typeof o==='string'?o:o?.text;if(typeof t!=='string'){issue(n,'choice','Choice option text unresolved');continue;}const q=[...t.matchAll(/[„"]([^“”"]+)[“”"]/gu)].map(x=>x[1]);if(q.length){for(const spoken of q)add(n,spoken,player(n.getSourceFile()),'choice','neutral',{original_choice_text:t});}else exclude(n,'Unquoted action/menu choice; explicit classification retained',t);}resolved.add(keyFor(n)+':choice');}
const specialTables=new Set();
function visit(n,env=new Map(),stack=new Set()){
 if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)){
  const method=n.expression.name.text,a=n.arguments;
  if(['say','think','narrate','bark','voice'].includes(method)){
   const actor=(method==='say'&&(!a[1]||ts.isObjectLiteralExpression(a[1])))||(method==='bark'&&(!a[1]||ts.isNumericLiteral(a[1])));
   const ix=(method==='say'||method==='bark'||method==='voice')&&!actor?1:0;
   const txt=a[ix];if(txt){
    const sd=a[0]&&ts.isIdentifier(a[0])?decl(a[0]):null,td=ts.isIdentifier(txt)?decl(txt):null;
    if(ix===1&&sd&&td&&ts.isBindingElement(sd)&&ts.isBindingElement(td)&&sd.parent===td.parent&&ts.isArrayBindingPattern(sd.parent)&&sd.parent.parent.initializer){
     const rows=evalNode(sd.parent.parent.initializer,env),si=sd.parent.elements.indexOf(sd),ti=td.parent.elements.indexOf(td);
     if(rows.length&&rows.every(r=>Array.isArray(r)&&typeof r[si]==='string'&&typeof r[ti]==='string')){for(const r of rows)add(txt,r[ti],r[si],method==='voice'?'bark':method,'neutral',{classification:'correlated_tuple_branch'},env.get('__call_node'));resolved.add(keyFor(txt)+':speaker');resolved.add(keyFor(txt)+':text');return;}
    }
    let speakers=method==='think'?[player(n.getSourceFile())]:method==='narrate'?['narrator']:actor?actorIds(n.expression.expression,env):strings(evalNode(a[0],env));
    if(!speakers.length)issue(txt,'speaker','Speaker/actor identity unresolved');
    const opts=a[ix+1]?evalNode(a[ix+1],env):[];const moods=opts.map(o=>o.mood??'neutral');const vv=textValues(txt,env);for(const text of vv)for(const s of speakers)for(const mood of moods.length?moods:['neutral'])add(txt,text,s,method==='voice'?'bark':method,mood,method==='voice'?{classification:'blindfold_spatial_voice'}:{},env.get('__call_node'));
   }
  }else if(method==='choose'){choices(a[0],env);if(a[1]&&ts.isObjectLiteralExpression(a[1])){const opts=evalNode(a[1],env);for(const o of opts)if(o.prompt){if(o.speaker&&o.speaker!=='narrator'){exclude(a[1],'UI choice prompt despite character speaker; explicit classification',o.prompt);}else exclude(a[1],'UI choice prompt; explicit source retained',o.prompt);}}}
  else if(method==='bubble'){if(a[0]&&ts.isStringLiteralLike(a[0])){const text=a[0].text,m=/^\*([^*]+):\*\s*(.+)$/u.exec(text);if(m&&m[1]==='Azar (fern)')add(a[0],m[2],'azar','bark','neutral',{classification:'distant_spatial_voice'});else issue(a[0],'speaker','Direct speech bubble requires speaker classification');}else if(path.basename(n.getSourceFile().fileName)==='blindfold.ts')exclude(n,'Blindfold.voice rendering wrapper; inventory its caller, not the repeated name label');else issue(a[0],'text','Dynamic direct bubble requires classification');}
  else if(['hint','setObjective','hold','chapterCard','plate','caption','emote','toast'].includes(method))exclude(n,'UI, interaction, visual-caption or tutorial panel');
 }
 if(ts.isPropertyAssignment(n)){
  const k=propName(n.name);
  if(['thought','blocked','comment'].includes(k)){for(const t of textValues(n.initializer,env))add(n.initializer,t,player(n.getSourceFile()),'think','neutral',{classification:k==='comment'?'item_inspection_comment':'story_thought'});}
  else if(['barks','suspiciousBarks','calmBarks'].includes(k)){
   const o=evalNode(n.parent,env),speakers=[...new Set(o.map(x=>x.speaker??x.id).filter(x=>typeof x==='string'))];if(!speakers.length)issue(n.initializer,'speaker','NPC property bark speaker unresolved');for(const t of textValues(n.initializer,env))for(const s of speakers)add(n.initializer,t,s,'bark');
  }
  else if(k==='reply'&&ts.isArrayLiteralExpression(n.initializer)){
   for(const row of n.initializer.elements){const vals=evalNode(row,env);for(const v of vals)if(Array.isArray(v)&&typeof v[0]==='string'&&typeof v[1]==='string')add(row,v[1],v[0],'say',v[2]??'neutral');}specialTables.add(n.initializer.getSourceFile().fileName);
  }
  else if(k==='text'&&ts.isObjectLiteralExpression(n.parent)&&n.parent.properties.some(p=>ts.isPropertyAssignment(p)&&propName(p.name)==='reply'))choices(n.initializer,env);
  else if(['verb','description','title','name','caption','tag','reason'].includes(k))exclude(n,'Display-only catalog/UI label or description, no implicit voice');
 }
 if(ts.isVariableDeclaration(n)&&n.name.getText()==='VERSES'){exclude(n.initializer,'Root-approved source-bound musical verses, existing score; no TTS');specialTables.add(n.getSourceFile().fileName);}

 if(ts.isForOfStatement(n)){
  const vals=evalNode(n.expression,env).flatMap(v=>Array.isArray(v)?v:[]);if(vals.length&&ts.isVariableDeclarationList(n.initializer)){
   const d=n.initializer.declarations[0];for(const v of vals){const e=new Map(env);if(ts.isIdentifier(d.name))e.set(d,[v]);else if(ts.isArrayBindingPattern(d.name))d.name.elements.forEach((b,i)=>{if(ts.isBindingElement(b))e.set(b,[v?.[i]]);});visit(n.statement,e,stack);}return;
  }
 }
 if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)){
  const d=decl(n.expression),f=d?.initializer??d;if(d&&ts.isParameter(d)&&/say/i.test(n.expression.text))issue(n,'callback','Speech callback parameter requires caller binding');
  if(f&&(ts.isFunctionDeclaration(f)||ts.isArrowFunction(f)||ts.isFunctionExpression(f))&&f.body&&!stack.has(f)){
   // Resolve simple speech wrappers at actual arguments without executing game logic.
   const hasTextParam=f.parameters.some(p=>p.type&&p.type.kind===ts.SyntaxKind.StringKeyword);
   if(hasTextParam){const e=new Map(env);e.set('__call_node',n);f.parameters.forEach((p,i)=>{const before=evaluatingSpeech;if(['text','t','line'].includes(p.name.getText()))evaluatingSpeech=true;try{e.set(p,n.arguments[i]||p.initializer?evalNode(n.arguments[i]??p.initializer,env):[undefined]);}finally{evaluatingSpeech=before;}});const st=new Set(stack).add(f);visit(f.body,e,st);}
  }
 }
 ts.forEachChild(n,c=>visit(c,env,stack));
}
for(const f of files)visit(program.getSourceFile(f));
// Chapter review records bind both exact text and a hash of a real AST node.
const directionDir=path.join(root,'docs/voice-production/directions');
const directionFiles=fs.existsSync(directionDir)?walk(directionDir).filter(f=>/^(?:kapitel-[1-5]|supplemental)\.json$/.test(path.basename(f))):[];
const validHashes=new Set();const astNodes=new Map();for(const file of files){const sf=program.getSourceFile(file);function nodes(n){astNodes.set(path.relative(root,file)+':'+n.getStart()+':'+n.getEnd(),n);validHashes.add(path.relative(root,file)+'\0'+sha(n.getText()));ts.forEachChild(n,nodes);}nodes(sf);}
const kindAlias={dialogue:'say',thought:'think',narration:'narrate',spoken_choice:'choice',choose:'choice'};
const reviewRows=directionFiles.flatMap(f=>{const d=JSON.parse(fs.readFileSync(f,'utf8'));return (Array.isArray(d)?d:d.entries??[]).filter(r=>r&&typeof r==='object').map(r=>({...r,review_file:path.relative(root,f),kind:kindAlias[r.kind]??r.kind}));});
for(const r of reviewRows)if(r.expression_sha256&&!validHashes.has(r.file+'\0'+r.expression_sha256))throw new Error(`Review AST hash absent: ${r.file}:${r.line}`);
const reviewText=r=>{if(typeof r.text!=='string')return null;const q=r.kind==='choice'?[...r.text.matchAll(/[„"]([^“”"]+)[“”"]/gu)].map(m=>m[1]):[];return q.length?q.map(plain):[plain(r.text)];};
const controlsSf=program.getSourceFile(path.join(root,'game/src/world/ctx.ts'));const controlBindings={};
for(const st of controlsSf.statements)if(ts.isVariableStatement(st))for(const d of st.declarationList.declarations)if(['KEY_NAMES','TOUCH_NAMES'].includes(d.name.getText()))for(const o of evalNode(d.initializer))for(const [k,v]of Object.entries(o)){if(!controlBindings[k])controlBindings[k]=[];if(!controlBindings[k].includes(v))controlBindings[k].push(v);}
const acceptedRaw=[];
for(const r of raw){
 const matches=reviewRows.filter(v=>(v.kind===r.kind||(r.classification==='blindfold_spatial_voice'&&v.kind==='say'))&&reviewText(v)?.includes(r.text)&&r.sources.some(s=>s.role!=='wrapper_definition'&&s.file===v.file&&(s.line===v.line||s.review_anchor_hashes?.includes(v.expression_sha256))));
 const spoken=matches.filter(v=>v.classification==='spoken'&&v.direction_en);
 const classified=matches.find(v=>['ui','sfx','nonverbal'].includes(v.classification));
 if(classified&&!spoken.length){excluded.push({reason:`Chapter review ${classified.classification}: ${classified.reason??classified.context_de??'explicitly excluded'}`,text:r.display_text,sources:r.sources,review_source:{file:classified.review_file,expression_sha256:classified.expression_sha256}});continue;}
 if(spoken.length){const v=spoken.find(v=>v.runtime_speaker&&canonical(v.runtime_speaker,{getSourceFile:()=>({fileName:v.file})})===r.speaker)??spoken[0];r.direction_en=v.direction_en;r.review={file:v.review_file,expression_sha256:v.expression_sha256,emotion_de:v.emotion_de,intensity:v.intensity};r.performance_variant=v.direction_en;}
 acceptedRaw.push(r);
}
raw.splice(0,raw.length,...acceptedRaw);
for(const [key,a] of audit){
 const matches=reviewRows.filter(r=>r.file===a.source.file&&(r.line===a.source.line||a.source.review_anchor_hashes?.includes(r.expression_sha256)));
 const spoken=matches.filter(r=>r.classification==='spoken'&&reviewText(r)&&r.direction_en);
 if(['speaker','callback','text'].includes(a.role)){
  for(const r of spoken){const texts=reviewText(r);const speaker=r.kind==='think'?player({fileName:r.file}):r.intended_speaker??r.runtime_speaker;if(!speaker||['speaker','info.unit.id','unit.id','valentus'].includes(speaker))continue;
   const node=astNodes.get(a.source.file+':'+a.source.start+':'+a.source.end);let displays=null,binding=null;
   if(node&&ts.isTemplateExpression(node)&&a.expression.includes('controlHint')){const e=new Map().set('__control_bindings',controlBindings);displays=strings(evalNode(node,e));binding={kind:'omit_control_hint_parenthetical',runtime_texts:displays};if(!displays.length)throw new Error('Control text binding unresolved');}
   if(node&&ts.isTemplateExpression(node)&&a.expression.includes("count('k3-stein')")){let parent=node.parent;while(parent&&!ts.isIfStatement(parent))parent=parent.parent;if(!parent||!ts.isBinaryExpression(parent.expression)||parent.expression.operatorToken.kind!==ts.SyntaxKind.LessThanToken||parent.expression.right.getText()!=='5')throw new Error('Stone count no longer bounded to0..4');const e=new Map().set('__counter_values',[0,1,2,3,4]);displays=strings(evalNode(node,e));binding={kind:'finite_counter',state_item:'k3-stein',values:[0,1,2,3,4],runtime_texts:displays};}

   for(const text of texts){if(text===a.expression)continue;if(displays&&displays.every(d=>plain(d.replace(/\s*\([^()]*\)/gu,'')).trim()!==text))continue;raw.push({scene:a.source.scene,chapter:a.source.chapter,speaker:alias(speaker),runtime_speakers:[speaker],kind:r.kind??'bark',text,display_text:displays?.[0]??r.text,runtime_display_texts:displays,runtime_normalization:binding,mood:'neutral',performance_variant:r.direction_en,direction_en:r.direction_en,sources:[a.source],manual_resolution:true,review:{file:r.review_file,expression_sha256:r.expression_sha256,emotion_de:r.emotion_de,intensity:r.intensity}});}
  }
  if(spoken.some(r=>r.runtime_speaker&&!['speaker','info.unit.id','unit.id'].includes(r.runtime_speaker))){resolved.add(key);}
 }
 const exclusions=matches.filter(r=>['ui','sfx','dispatch-only'].includes(r.classification));
 if(!spoken.length&&a.role==='text'&&a.expression.includes('controlHint')&&matches.some(r=>r.runtime_speaker==='narrator')){excluded.push({reason:'Root-approved source-bound instructional control prompt; no story thought removed',text:a.expression,sources:[a.source]});resolved.add(key);}
 if(exclusions.length){for(const r of exclusions)excluded.push({reason:`Chapter review ${r.classification}: ${r.reason??r.context_de}`,text:a.expression,sources:[a.source]});resolved.add(key);}
}

// Decisions bind to exact AST expression hashes. They cannot alter game text silently.
for(const row of decisions.resolutions??[]){const pending=[...audit.values()].find(a=>a.key===row.key);if(!pending)throw new Error(`Unknown resolution key ${row.key}`);if(row.expression_sha256!==pending.source.expression_sha256)throw new Error('Resolution source hash mismatch');if(row.exclude_reason){excluded.push({reason:row.exclude_reason,text:pending.expression,sources:[pending.source]});resolved.add(row.key);}else if(Array.isArray(row.lines)){for(const l of row.lines){if(typeof l.text!=='string'||typeof l.speaker!=='string')throw new Error('Invalid explicit resolution');raw.push({scene:l.scene??pending.source.scene,chapter:pending.source.chapter,speaker:alias(l.speaker),runtime_speakers:l.runtime_speakers??[l.speaker],kind:l.kind??'say',text:plain(l.text),display_text:l.display_text??l.text,mood:l.mood??'neutral',performance_variant:l.performance_variant??l.mood??'neutral',direction_en:l.direction_en??direction(l.kind??'say',l.mood??'neutral'),sources:[pending.source],manual_resolution:true});}resolved.add(row.key);}else throw new Error('Resolution needs lines or exclude_reason');}
const unresolved=[...audit.entries()].filter(([k])=>!resolved.has(k)).map(([,v])=>v);
// One reachable performance for each exact runtime route. Explicit source moods remain separate.
const parent=raw.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
const routeOwner=new Map();
for(let i=0;i<raw.length;i++){const row=raw[i];for(const src of row.sources.filter(s=>s.role!=='wrapper_definition'))for(const scene of src.runtime_scenes?.length?src.runtime_scenes:[src.scene])for(const runtime of row.runtime_speakers)for(const display of row.runtime_display_texts??[row.text]){
 const key=JSON.stringify([row.kind,canonical(runtime,{getSourceFile:()=>({fileName:src.file})}),plain(display),scene,row.mood]);if(routeOwner.has(key))parent[find(i)]=find(routeOwner.get(key));else routeOwner.set(key,i);
}}
const components=new Map();for(let i=0;i<raw.length;i++){const k=find(i);if(!components.has(k))components.set(k,[]);components.get(k).push(raw[i]);}
const reachable=[];for(const members of components.values()){
 members.sort((a,b)=>Number(Boolean(b.review))-Number(Boolean(a.review))||((a.sources[0].file+':'+String(a.sources[0].start).padStart(8,'0')).localeCompare(b.sources[0].file+':'+String(b.sources[0].start).padStart(8,'0'))));
 const chosen=members[0];for(const row of members.slice(1)){for(const src of row.sources)if(!chosen.sources.some(s=>s.file===src.file&&s.start===src.start))chosen.sources.push(src);for(const runtime of row.runtime_speakers)if(!chosen.runtime_speakers.includes(runtime))chosen.runtime_speakers.push(runtime);if(row.runtime_display_texts)chosen.runtime_display_texts=[...new Set([...(chosen.runtime_display_texts??[]),...row.runtime_display_texts])];}
 if(new Set(members.map(r=>r.direction_en)).size>1)chosen.route_resolution={policy:'single reviewed balanced performance per reachable scene/text/source-mood route',merged_directions:[...new Set(members.map(r=>r.direction_en))]};reachable.push(chosen);
}
raw.splice(0,raw.length,...reachable);

const dedup=new Map();for(const row of raw){const key=`${row.kind}\0${row.speaker}\0${row.text}\0${row.performance_variant}`;if(!dedup.has(key))dedup.set(key,{...row,id:'story-'+sha(key).slice(0,24)});else{const r=dedup.get(key);for(const s of row.sources)if(!r.sources.some(x=>x.file===s.file&&x.start===s.start))r.sources.push(s);for(const s of row.runtime_speakers)if(!r.runtime_speakers.includes(s))r.runtime_speakers.push(s);}}
for(const l of dedup.values())if(l.kind==='narrate'&&l.sources.some(s=>s.file.endsWith('/kapitel-3/leselager.ts')&&([202,203,226,227,228,229,235].includes(s.line)||(s.line===233&&l.text.startsWith('„'))))){l.speaker='lia';l.casting_policy='Root-approved Lia read-aloud: original narrator runtime retained';l.id='story-'+sha(`${l.kind}\0${l.speaker}\0${l.text}\0${l.performance_variant}`).slice(0,24);}
const lines=[...dedup.values()].sort((a,b)=>a.id.localeCompare(b.id));
for(const l of lines)l.runtime_keys=l.sources.filter(s=>s.role!=='wrapper_definition').flatMap(s=>(s.runtime_scenes?.length?s.runtime_scenes:[s.scene]).flatMap(scene=>l.runtime_speakers.flatMap(sp=>(l.runtime_display_texts??[l.text]).map(display=>({kind:l.kind,speaker:canonical(sp,{getSourceFile:()=>({fileName:s.file})}),text:plain(display),scene,mood:l.mood,performance_variant:l.performance_variant}))))).filter((k,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(k))===i);
const runtime_lookup=lines.flatMap(l=>l.runtime_keys.map(k=>({...k,asset_id:l.id})));
const aliases={grauhaarige:'orwen',narbige:'algard','k1-narbige':'algard','k1-kahle':'maedchen','k2-stimme-a':'azar','k2-stimme-b':'foltan','k4-wache':'bruderschaft-wache'};for(const l of lines)for(const runtime of l.runtime_speakers)aliases[runtime]=canonical(runtime,{getSourceFile:()=>({fileName:l.sources[0].file})});
for(const f of files){const sf=program.getSourceFile(f);function actorAlias(n){if(ts.isObjectLiteralExpression(n)){const id=n.properties.find(p=>ts.isPropertyAssignment(p)&&propName(p.name)==='id'),sp=n.properties.find(p=>ts.isPropertyAssignment(p)&&propName(p.name)==='speaker');if(id&&sp&&ts.isStringLiteralLike(id.initializer)&&ts.isStringLiteralLike(sp.initializer))aliases[id.initializer.text]=alias(sp.initializer.text);}ts.forEachChild(n,actorAlias);}actorAlias(sf);}
aliases['lia-cloak']='lia';aliases['kyra-bound']='kyra';
const scene_players=Object.fromEntries([...new Set([...sceneBindings.values()].flatMap(s=>[...s]))].sort().map(scene=>[scene,scene==='kyra'?'kyra':'lia']));
const result={runtime_lookup,scene_players,model:'gemini-3.8-flash-tts',language:'de',source_hashes:Object.fromEntries([...files,path.join(root,'game/src/ui/text.ts'),path.join(root,'game/src/world/ctx.ts'),...directionFiles].map(f=>[path.relative(root,f),sha(fs.readFileSync(f))])),lines,excluded,unresolved,characters:[...new Set(lines.map(l=>l.speaker))].sort(),alias_map:aliases,aliases,canonical_scopes:{prolog:'Existing188 takes and prolog manifest untouched; no global baris-young alias.',story:'k1..k5 portrait/actor prefixes removed; Baris remains adult baris.'},notes:['Static branch census; no game execution, API calls or downloads. No unresolved expression is silently omitted from audit.','Story scene-qualified runtime keys include performance variant so equal words in different emotions remain separate.','Source spans, expressions and SHA256 bind chapter review decisions. Unquoted menu actions are excluded explicitly; gameplay narrator say strings remain classified candidates.']};
const counts=Object.fromEntries([...new Set(lines.map(l=>l.kind))].map(k=>[k,lines.filter(l=>l.kind===k).length]));
if(process.argv.includes('--freeze')){if(lines.some(l=>!l.review))throw new Error('Freeze blocked: fallback-only acting directions');if(unresolved.length)throw new Error(`Freeze blocked by ${unresolved.length} unresolved expressions`);if(fs.existsSync(target))throw new Error('Existing story freeze requires explicit review before replacement');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');}
else if(process.argv.includes('--check')){if(unresolved.length)throw new Error(`Unresolved ${unresolved.length}`);if(fs.readFileSync(target,'utf8')!==JSON.stringify(result,null,2)+'\n')throw new Error('Story manifest/source drift');}
else{fs.mkdirSync(path.dirname(proposed),{recursive:true});fs.writeFileSync(proposed,JSON.stringify(result,null,2)+'\n');}
if(new Set(lines.map(l=>l.id)).size!==lines.length)throw new Error('ID collision');console.log(JSON.stringify({lines:lines.length,counts,unresolved:unresolved.length,characters:result.characters,proposed:path.relative(root,proposed)},null,2));
