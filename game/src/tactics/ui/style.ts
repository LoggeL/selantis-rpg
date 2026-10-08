/** Battle UI stylesheet — „Chronik“: night-blue panels, gold hairlines, Cinzel/Alegreya/Alegreya Sans SC. */
export const TACTICS_CSS = `
.tac{position:absolute;left:0;top:0;pointer-events:none;color:#efe3c8;font-family:Alegreya,Georgia,serif;
  --gold:#d8b25a;--gold2:#f3d27a;--ink:#141a26;--panel:#141a26;--danger:#d4573b;--turq:#49e0c8;--blue:#7fb8ff;--green:#7ccf6a;
  font-size:var(--fs,14px);line-height:1.25;user-select:none;-webkit-user-select:none;overflow:hidden}
.tac *{box-sizing:border-box}
.tac button{font:inherit;color:inherit;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.tac .sc{font-family:'Alegreya Sans SC',sans-serif;letter-spacing:.06em}
.tac-panel{position:absolute;background:linear-gradient(180deg,rgba(26,33,50,.94),rgba(17,22,34,.95));border:1px solid rgba(216,178,90,.55);
  border-radius:.55em;box-shadow:inset 0 0 0 2px rgba(10,13,20,.9),inset 0 1px 0 3px rgba(216,178,90,.08),0 .4em 1.2em rgba(0,0,0,.55)}
.tac-panel::before,.tac-panel::after{content:'';position:absolute;width:.7em;height:.7em;border:2px solid var(--gold);opacity:.85;pointer-events:none}
.tac-panel::before{top:-2px;left:-2px;border-right:0;border-bottom:0;border-top-left-radius:.45em}
.tac-panel::after{bottom:-2px;right:-2px;border-left:0;border-top:0;border-bottom-right-radius:.45em}

/* objective */
.tac-obj{left:calc(.8em + var(--safe-left,0px));top:calc(.8em + var(--safe-top,0px));max-width:min(19em,calc(28% - 1em));padding:.45em .8em .55em;pointer-events:auto;overflow-wrap:break-word}
.tac-obj .lbl{font-family:'Alegreya Sans SC',sans-serif;font-size:.72em;letter-spacing:.16em;color:var(--gold);display:flex;align-items:center;gap:.4em}
.tac-obj .lbl::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(216,178,90,.6),transparent)}
.tac-obj .txt{font-family:Cinzel,serif;font-weight:700;font-size:1em;color:#f4e6c4;margin-top:.1em}
.tac-obj .det{font-size:.82em;color:#cbbd98;font-style:italic;margin-top:.1em}
.tac.has-hint .tac-obj .det{display:none}
.tac-obj .prog{display:flex;gap:.25em;margin-top:.35em}
.tac-obj .prog i{width:.9em;height:.32em;border-radius:1px;background:rgba(216,178,90,.22);border:1px solid rgba(216,178,90,.45)}
.tac-obj .prog i.on{background:var(--gold2);box-shadow:0 0 .4em rgba(243,210,122,.6)}
.tac-obj.flash{animation:tacObjFlash .9s ease}
@keyframes tacObjFlash{0%{box-shadow:0 0 0 0 rgba(243,210,122,.0)}30%{box-shadow:0 0 0 .3em rgba(243,210,122,.5)}100%{box-shadow:0 0 0 0 rgba(243,210,122,0)}}

/* phase pill + order */
.tac-phase{left:50%;top:calc(.75em + var(--safe-top,0px));transform:translateX(-50%);padding:.25em .9em .3em;font-family:Cinzel,serif;font-weight:700;font-size:.9em;letter-spacing:.06em;white-space:nowrap;display:flex;gap:.6em;align-items:center}
.tac-phase .rd{font-family:'Alegreya Sans SC',sans-serif;font-weight:500;font-size:.8em;color:#bfb08c;letter-spacing:.12em}
.tac-phase{max-width:44%;letter-spacing:.03em;gap:.4em}
.tac-phase>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis}
.tac-phase .rd{flex-shrink:0}
.tac-phase.enemy{color:#ffb4a0}.tac-phase.player{color:#f3e2b0}.tac-phase.ally{color:#bdf0c8}
.tac-order{position:absolute;left:50%;top:3.1em;transform:translateX(-50%);display:flex;gap:.22em;pointer-events:auto}
.tac-order .o{width:1.9em;height:1.9em;border-radius:.3em;border:1px solid rgba(216,178,90,.5);background:#0e131d;overflow:hidden;position:relative;cursor:pointer;padding:0}
.tac-order .o img{width:100%;height:100%;image-rendering:pixelated;display:block}
.tac-order .o.player{border-color:#8ebcff}.tac-order .o.enemy{border-color:#e0705a}.tac-order .o.ally{border-color:#8ae0a0}
.tac-order .o.done{filter:grayscale(.8) brightness(.55)}
.tac-order .o.down{filter:grayscale(1) brightness(.35)}
.tac-order .o.cur{box-shadow:0 0 0 2px var(--gold2),0 0 .6em rgba(243,210,122,.6)}
.tac-order .sep{width:1px;background:rgba(216,178,90,.4);margin:0 .2em}
.tac-order{max-width:48%;overflow-x:auto;padding:3px;top:3.1em}
.tac-order .o{flex-shrink:0}
.tac-order .order-number{position:absolute;left:0;bottom:0;padding:0 .2em;background:#0e131de6;color:#fff2cc;font:700 .55em sans-serif}

/* rotate */
.tac-rot{position:absolute;right:calc(.8em + var(--safe-right,0px));top:var(--tac-controls-top,66px);display:flex;gap:.3em;pointer-events:auto}
.tac-rot button{width:2em;height:2em;border-radius:50%;background:rgba(20,26,38,.85);border:1px solid rgba(216,178,90,.55);display:grid;place-items:center;padding:0}
.tac-rot button:hover{border-color:var(--gold2);background:rgba(36,46,66,.95)}
.tac-rot svg{width:1.1em;height:1.1em}

/* unit card */
.tac-card{left:calc(.8em + var(--safe-left,0px));bottom:calc(.8em + var(--safe-bottom,0px));width:21em;padding:.6em .7em .6em;pointer-events:auto;transition:opacity .15s,transform .15s}
.tac-card.hidden{opacity:0;transform:translateY(.5em);pointer-events:none}
.tac-card .top{display:flex;gap:.6em;align-items:flex-start}
.tac-card .por{width:4.4em;height:4.4em;flex:0 0 auto;border-radius:.35em;border:1px solid rgba(216,178,90,.6);background:radial-gradient(circle at 40% 30%,#2a3550,#0d1119);overflow:hidden;box-shadow:inset 0 0 0 2px #0a0d14}
.tac-card .por img{width:100%;height:100%;image-rendering:pixelated;display:block}
.tac-card .nm{font-family:Cinzel,serif;font-weight:700;font-size:1.05em;color:#f6e8c6;line-height:1.1}
.tac-card .ttl{font-style:italic;font-size:.8em;color:#b9ab88}
.tac-card .team{font-family:'Alegreya Sans SC',sans-serif;font-size:.68em;letter-spacing:.12em;padding:.05em .45em;border-radius:.3em;margin-left:.3em;vertical-align:.15em}
.tac-card .team.player{background:rgba(127,184,255,.16);color:#a8ccff;border:1px solid rgba(127,184,255,.4)}
.tac-card .team.enemy{background:rgba(212,87,59,.16);color:#ffab96;border:1px solid rgba(212,87,59,.45)}
.tac-card .team.ally{background:rgba(124,207,106,.14);color:#b8f0a8;border:1px solid rgba(124,207,106,.4)}
.tac-hp{margin-top:.35em;display:flex;align-items:center;gap:.45em}
.tac-hp .bar{flex:1;height:.62em;border-radius:.2em;background:#2a1c22;border:1px solid rgba(0,0,0,.6);position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
.tac-hp .bar b{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(180deg,#9ee08a,#5ea84e);transition:width .35s}
.tac-hp .bar b.mid{background:linear-gradient(180deg,#f3d27a,#c99a3a)}
.tac-hp .bar b.low{background:linear-gradient(180deg,#f0806a,#b8402c)}
.tac-hp .bar b.foe{background:linear-gradient(180deg,#f0806a,#b8402c)}
.tac-hp .bar s{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,rgba(255,240,200,.85) 0 3px,rgba(255,200,150,.55) 3px 6px);animation:tacGhost .8s ease-in-out infinite alternate}
@keyframes tacGhost{from{opacity:.45}to{opacity:1}}
.tac-hp .num{font-family:'Alegreya Sans SC',sans-serif;font-size:.85em;color:#efe3c8;min-width:3.6em;text-align:right}
.tac-hp .resource-label{width:1.6em;font:700 .72em 'Alegreya Sans SC',sans-serif;color:var(--green)}
.tac-mp{margin-top:.2em}
.tac-mp .resource-label{color:var(--blue)}
.tac-mp .bar b{background:linear-gradient(180deg,#8abfff,#4467c9)}
.tac-growth{display:flex;gap:.7em;justify-content:space-between;margin-top:.3em;font:.78em 'Alegreya Sans SC',sans-serif;color:#c9bb96}
.tac-growth b{color:#fff0c9;font-variant-numeric:tabular-nums}
.tac-expbar{height:3px;background:#080e18;margin-top:.15em;overflow:hidden}
.tac-expbar b{display:block;height:100%;background:var(--gold2)}
.tac-equipment{border-top:1px solid #d8b25a33;margin-top:.4em;padding-top:.3em}
.tac-weapon-name{font:.78em 'Alegreya Sans SC',sans-serif;color:#cdbb91;margin-top:.2em}
.tac-equip-buttons{display:flex;gap:.25em;margin-top:.25em}
.tac-equip-buttons button{border:1px solid #d8b25a55;border-radius:.2em;background:#172034;font:.76em 'Alegreya Sans SC',sans-serif;padding:.2em .5em}
.tac-equip-buttons button.on{border-color:var(--gold);color:var(--gold2)}
.tac-equip-buttons button:disabled{opacity:.5;cursor:default}
.tac-stats{display:flex;flex-wrap:wrap;gap:.3em .7em;margin-top:.3em;font-family:'Alegreya Sans SC',sans-serif;font-size:.78em;color:#c9bb96;letter-spacing:.04em}
.tac-stats b{color:#f3e2b0;font-weight:700}
.tac-chip{display:inline-flex;align-items:center;gap:.25em;font-family:'Alegreya Sans SC',sans-serif;font-size:.74em;letter-spacing:.05em;padding:.06em .45em;border-radius:.6em;border:1px solid rgba(216,178,90,.4);color:#efe3c8;background:rgba(216,178,90,.1)}
.tac-chip.magic{border-color:rgba(73,224,200,.6);color:#b8fff0;background:rgba(73,224,200,.1)}
.tac-chip.bad{border-color:rgba(212,87,59,.6);color:#ffb8a6;background:rgba(212,87,59,.12)}
.tac-chip.good{border-color:rgba(124,207,106,.55);color:#c8f6b8;background:rgba(124,207,106,.1)}
.tac-chips{display:flex;flex-wrap:wrap;gap:.25em;margin-top:.3em}
.tac-abil{display:grid;grid-template-columns:repeat(2,1fr);gap:.3em;margin-top:.5em}
.tac-abil button{position:relative;display:flex;align-items:center;gap:.4em;text-align:left;padding:.32em .45em .34em;border-radius:.35em;background:linear-gradient(180deg,#25304a,#1a2235);border:1px solid rgba(216,178,90,.4);min-height:2.25em}
.tac-abil button:hover:not(:disabled):not(.dis){border-color:var(--gold2);background:linear-gradient(180deg,#2e3b5a,#1f2940)}
.tac-abil button.on{border-color:var(--gold2);box-shadow:0 0 0 1px var(--gold2),0 0 .7em rgba(243,210,122,.35);background:linear-gradient(180deg,#3a3a2a,#262418)}
.tac-abil button.magic.on{border-color:var(--turq);box-shadow:0 0 0 1px var(--turq),0 0 .7em rgba(73,224,200,.35);background:linear-gradient(180deg,#1d3a3c,#14282a)}
.tac-abil button:disabled,.tac-abil button.dis{opacity:.42;cursor:default}
.tac-abil button.attack{border-color:rgba(243,210,122,.7)}
.tac-abil .k{font-family:'Alegreya Sans SC',sans-serif;font-size:.68em;color:#0e131d;background:var(--gold);border-radius:.25em;padding:0 .3em;line-height:1.35}
.tac-abil .ic{width:1.15em;height:1.15em;flex:0 0 auto;color:#f3d27a}
.tac-abil .magic .ic{color:var(--turq)}
.tac-abil .an{font-size:.86em;line-height:1.05;color:#f2e6c8}
.tac-abil .cd{position:absolute;right:.3em;top:.25em;font-family:'Alegreya Sans SC',sans-serif;font-size:.66em;color:#ffcfb8;background:rgba(212,87,59,.25);border:1px solid rgba(212,87,59,.6);border-radius:.6em;padding:0 .35em}
.tac-done{margin-top:.45em;font-family:'Alegreya Sans SC',sans-serif;font-size:.74em;letter-spacing:.08em;color:#a99a78;text-align:center}

/* target card */
.tac-tcard{right:calc(.8em + var(--safe-right,0px));bottom:calc(4.4em + var(--safe-bottom,0px));width:19em;padding:.55em .7em .6em;transition:opacity .12s,transform .12s}
.tac-tcard.hidden{opacity:0;transform:translateY(.4em)}
.tac-tcard .hd{display:flex;align-items:center;gap:.5em}
.tac-tcard .por{width:2.6em;height:2.6em;border-radius:.3em;border:1px solid rgba(216,178,90,.5);overflow:hidden;background:#0e131d;flex:0 0 auto}
.tac-tcard .por img{width:100%;height:100%;image-rendering:pixelated;display:block}
.tac-tcard .nm{font-family:Cinzel,serif;font-weight:700;font-size:.95em;color:#f6e8c6}
.tac-tcard .ab{font-family:'Alegreya Sans SC',sans-serif;font-size:.72em;letter-spacing:.1em;color:var(--gold)}
.tac-tcard .ab.magic{color:var(--turq)}
.tac-tcard.forecast{left:50%;right:auto;transform:translateX(-50%);bottom:var(--tac-footer,3.6em);width:min(39em,calc(100% - 1.6em));max-height:min(24em,calc(100% - var(--tac-header,4em) - var(--tac-footer,3.6em) - 8px));padding:.6em .8em;z-index:2;display:flex;flex-direction:column;pointer-events:auto}
.tac.has-forecast .tac-card{visibility:hidden}
.tac.choosing .tac-card{visibility:hidden}
.tac-forecast-body{overflow-y:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:thin}
.tac-versus>.tac-combatant,.tac-versus-arrow{position:sticky;top:0}
.tac-targets{min-width:0;display:grid;gap:.6em}
/* One affected unit at a time (FFTA); the others stay in the DOM, collapsed, for the pager. */
.tac-target:not(.on){display:none}
.tac-pager{display:flex;align-items:center;gap:.3em;margin-left:auto;font-size:1.25em;color:#f3e2b0}
.tac-pager button{min-width:32px;min-height:32px;padding:0 .3em;border-radius:.3em;border:1px solid rgba(216,178,90,.6);background:linear-gradient(180deg,#2c3854,#1b2336);font:700 1.15em Cinzel,serif;line-height:1;color:#f6e8c6;display:grid;place-items:center}
.tac-pager button:hover{border-color:var(--gold2)}
.tac-page{min-width:2.4em;text-align:center;font-variant-numeric:tabular-nums}
.tac-count{align-self:center}
.tac-big .v.dir{font-size:1.05em;color:#e8d8b0}
.tac-big .v.dir.side{color:#c8f6b8}.tac-big .v.dir.back{color:#9ee08a}
.tac-forecast-actions{display:flex;align-items:center;justify-content:space-between;gap:.7em;border-top:1px solid #d8b25a44;margin-top:.4em;padding-top:.4em;flex-shrink:0}
.tac-forecast-actions>span{font:.7em 'Alegreya Sans SC',sans-serif;color:#c9bb96}
.tac-forecast-actions .tac-btn{font-size:.75em;white-space:nowrap}
.tac-facing{left:50%;transform:translateX(-50%);bottom:var(--tac-footer,3.6em);width:min(25em,calc(100% - 1.6em));padding:.6em .8em;z-index:3;pointer-events:auto}
.tac-facing.hidden{display:none}
.tac.has-facing .tac-card,.tac.has-facing .tac-tcard,.tac.has-facing .tac-hint{visibility:hidden;pointer-events:none}
.tac-directions{display:flex;justify-content:center;gap:.6em;margin:.5em 0}
.tac-directions button{background:#182537;border:1px solid #d8b25a77;border-radius:.25em;font-size:1.6em;line-height:1;width:2em;height:1.6em}
.tac-directions button.on{background:#574526;border-color:var(--gold2);color:#fff2cc}
.tac-facing-note{font:.75em 'Alegreya Sans SC',sans-serif;color:#c9bb96;text-align:center}
.tac-facing-actions{display:flex;justify-content:space-between;gap:.7em;margin-top:.5em}
.tac-facing-actions .tac-btn{font-size:.8em}
.forecast-title{display:flex;justify-content:space-between;align-items:center;gap:1em;border-bottom:1px solid #d8b25a44;padding-bottom:.3em;font:.72em 'Alegreya Sans SC',sans-serif;color:#c9bb96;flex-shrink:0}
.tac-versus{display:grid;grid-template-columns:minmax(0,1fr) 1.5em minmax(0,1fr);align-items:start;gap:.6em;margin-top:.4em}
.tac-combatant{min-width:0;padding:.25em .4em;border-left:2px solid var(--blue);background:#27375433}
.tac-combatant.enemy{border-color:var(--danger);background:#54322733}
.tac-combatant.ally{border-color:var(--green)}
.tac-combatant .ab{letter-spacing:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:14em}
.tac-versus-arrow{text-align:center;font-size:1.6em;color:var(--gold2)}
.tac-forecast-note{font:.7em 'Alegreya Sans SC',sans-serif;color:#c9bb96;margin-top:.2em}
.forecast .tac-big{justify-content:center;flex-wrap:wrap;gap:.8em;margin-top:.4em}
.forecast .tac-chips{justify-content:center}
.forecast .tac-push{justify-content:center}
.tac-big{display:flex;gap:.9em;margin-top:.35em;align-items:baseline}
.tac-big div{display:flex;flex-direction:column}
.tac-big .v{font-family:Cinzel,serif;font-weight:700;font-size:1.45em;line-height:1;color:#fff2cc}
.tac-big .v.hit{color:#f3d27a}
.tac-big .v.dmg{color:#ffb39e}
.tac-big .v.lethal{color:#ff8a6a;text-shadow:0 0 .5em rgba(255,100,70,.5)}
.tac-big .l{font-family:'Alegreya Sans SC',sans-serif;font-size:.66em;letter-spacing:.12em;color:#a99a78}
.tac-push{margin-top:.35em;font-size:.8em;color:#e8d8b0;display:flex;gap:.35em;align-items:flex-start}
.tac-push svg{width:1em;height:1em;flex:0 0 auto;margin-top:.1em;color:#f3d27a}
.tac-row{display:flex;align-items:center;gap:.4em;margin-top:.3em;font-size:.82em}
.tac-row .n{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tac-row .c{font-family:'Alegreya Sans SC',sans-serif;color:#f3d27a}
.tac-row .d{font-family:'Alegreya Sans SC',sans-serif;color:#ffb39e;min-width:2.4em;text-align:right}

/* tile info */
.tac-tile{left:50%;bottom:.8em;transform:translateX(-50%);padding:.22em .8em .26em;font-size:.8em;white-space:nowrap;display:flex;gap:.6em;align-items:center}
.tac-tile .h{font-family:'Alegreya Sans SC',sans-serif;color:var(--gold2);letter-spacing:.06em}
.tac-tile .note{color:#bfb08c;font-style:italic}
.tac-tile.hidden{opacity:0}

/* end turn */
.tac-end{position:absolute;right:calc(.8em + var(--safe-right,0px));bottom:calc(.8em + var(--safe-bottom,0px));display:flex;gap:.4em;pointer-events:auto;align-items:stretch}
.tac-btn{display:flex;align-items:center;gap:.45em;padding:.42em .85em .46em;border-radius:.5em;background:linear-gradient(180deg,#2c3854,#1b2336);border:1px solid rgba(216,178,90,.65);box-shadow:inset 0 1px 0 rgba(255,240,200,.08),0 .3em .8em rgba(0,0,0,.5);font-family:Cinzel,serif;font-weight:700;font-size:.92em;color:#f6e8c6;white-space:nowrap}
.tac-btn:hover:not(:disabled){border-color:var(--gold2);background:linear-gradient(180deg,#36456a,#222c44)}
.tac-btn:active:not(:disabled){transform:translateY(1px)}
.tac-btn:disabled{opacity:.45;cursor:default}
.tac-btn svg{width:1.2em;height:1.2em;color:var(--gold2)}
.tac-btn kbd{font-family:'Alegreya Sans SC',sans-serif;font-weight:500;font-size:.7em;color:#0e131d;background:var(--gold);border-radius:.25em;padding:0 .35em}
.tac-btn.pulse{animation:tacPulse 1.3s ease-in-out infinite}
@keyframes tacPulse{0%,100%{box-shadow:0 0 0 0 rgba(243,210,122,.0),0 .3em .8em rgba(0,0,0,.5)}50%{box-shadow:0 0 0 .25em rgba(243,210,122,.35),0 0 1.2em rgba(243,210,122,.45)}}
.tac-btn.small{font-family:'Alegreya Sans SC',sans-serif;font-weight:500;font-size:.8em;letter-spacing:.05em;padding:.35em .6em}
.tac-end .hg{animation:tacHg 3s ease-in-out infinite;transform-origin:50% 50%}
@keyframes tacHg{0%,80%{transform:rotate(0)}90%,100%{transform:rotate(180deg)}}

/* action menu */
.tac-menu{position:absolute;z-index:4;padding:.3em;display:flex;flex-direction:column;gap:.18em;pointer-events:auto;min-width:8.6em;transform:translate(0,-50%)}
.tac-menu.hidden{display:none}
.tac-menu:not(.targeting){max-height:calc(100% - var(--tac-header,64px) - var(--tac-footer,40px));overflow-y:auto}
.tac-menu button{display:flex;align-items:center;gap:.45em;text-align:left;padding:.28em .55em .3em;border-radius:.3em;background:transparent;border:1px solid transparent;font-size:.9em;color:#efe3c8}
.tac-menu button:hover:not(:disabled):not(.dis),.tac-menu button.on{background:rgba(216,178,90,.14);border-color:rgba(216,178,90,.5)}
.tac-menu button:disabled,.tac-menu button.dis{opacity:.38;cursor:default}
.tac-menu kbd{margin-left:auto;font-family:'Alegreya Sans SC',sans-serif;font-size:.7em;color:#a99a78}
.tac-menu svg{width:1em;height:1em;color:var(--gold2)}
.tac-menu .sub{padding-left:.6em;border-left:1px solid rgba(216,178,90,.3);margin-left:.6em;display:flex;flex-direction:column;gap:.1em}
.tac-menu .sub button{font-size:.84em}
.tac-menu .sub .magic svg{color:var(--turq)}
.tac-menu .sub .attack span{font-weight:700;color:#f6e8c6}
.tac-menu.targeting{transform:none;min-width:8em;max-width:12em}
.tac-target-name{padding:.2em .5em;font:.75em 'Alegreya Sans SC',sans-serif;color:var(--gold2)}

/* tooltip */
.tac-tip{position:absolute;width:min(17em,calc(100% - 1.6em));max-height:calc(100% - 1.6em);overflow-y:auto;padding:.5em .65em .55em;font-size:.82em;pointer-events:none;z-index:5}
.tac-tip.hidden{display:none}
.tac-menu,.tac-hint,.tac-tip{overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#8d744a #141a26}
.tac-tip h4{margin:0 0 .15em;font-family:Cinzel,serif;font-size:1em;color:#f6e8c6}
.tac-tip p{margin:0 0 .35em;color:#d8caa6;font-style:italic;line-height:1.25}
.tac-tip .meta{display:flex;flex-wrap:wrap;gap:.25em}

/* banners */
.tac-banner{position:absolute;left:0;right:0;top:38%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;opacity:0}
.tac-banner .rib{position:relative;padding:.35em 3.5em .45em;font-family:Cinzel,serif;font-weight:700;font-size:2.3em;letter-spacing:.08em;color:#fff1c8;text-shadow:0 .08em 0 #3a2a10,0 0 .6em rgba(243,210,122,.45);
  background:linear-gradient(90deg,transparent,rgba(20,26,38,.92) 18%,rgba(20,26,38,.92) 82%,transparent);border-top:1px solid rgba(216,178,90,.7);border-bottom:1px solid rgba(216,178,90,.7)}
.tac-banner.enemy .rib{color:#ffd0c0;text-shadow:0 .08em 0 #3a1008,0 0 .6em rgba(212,87,59,.6);border-color:rgba(212,87,59,.75)}
.tac-banner.ally .rib{color:#d8ffe0;border-color:rgba(124,207,106,.7)}
.tac-banner .sub{margin-top:.35em;font-family:'Alegreya Sans SC',sans-serif;letter-spacing:.2em;font-size:.95em;color:#d8c8a0}
.tac-banner.show{animation:tacBanner var(--dur,1.3s) cubic-bezier(.2,.8,.2,1) forwards}
.tac-banner.show .rib{animation:tacRib var(--dur,1.3s) cubic-bezier(.2,.8,.2,1) forwards}
@keyframes tacBanner{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes tacRib{0%{letter-spacing:.5em;transform:scaleX(.6)}18%{letter-spacing:.08em;transform:scaleX(1)}82%{letter-spacing:.1em}100%{letter-spacing:.2em;transform:scaleX(1.05)}}
.tac.reduced .tac-banner.show,.tac.reduced .tac-banner.show .rib{animation-name:tacBannerFade}
@keyframes tacBannerFade{0%{opacity:0}15%{opacity:1}85%{opacity:1}100%{opacity:0}}
.tac-title{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .6s}
.tac-title.show{opacity:1}
.tac-title .pre{font-family:'Alegreya Sans SC',sans-serif;letter-spacing:.35em;color:#d8b25a;font-size:.95em}
.tac-title .t{font-family:Cinzel,serif;font-weight:700;font-size:2.5em;color:#fff1c8;text-shadow:0 .08em 0 #2a1a08,0 0 1em rgba(0,0,0,.8);margin:.1em 0}
.tac-title .s{font-style:italic;color:#e0d2ae;font-size:1.05em;text-shadow:0 0 .6em #000}
.tac-title .line{width:14em;height:1px;background:linear-gradient(90deg,transparent,#d8b25a,transparent);margin:.4em 0}

/* ability plate (AI) */
.tac-plate{position:absolute;padding:.22em .8em .26em;font-family:Cinzel,serif;font-weight:700;font-size:.92em;white-space:nowrap;transform:translate(-50%,-100%);opacity:0;transition:opacity .15s}
.tac-plate.show{opacity:1}
.tac-plate.enemy{border-color:rgba(212,87,59,.7);color:#ffd0c0}
.tac-plate.magic{border-color:rgba(73,224,200,.7);color:#c8fff4}

/* floating numbers */
.tac-floats{position:absolute;inset:0;pointer-events:none}
.tac-float{position:absolute;transform:translate(-50%,-50%);font-family:Cinzel,serif;font-weight:700;font-size:1.65em;color:#fff;white-space:nowrap;pointer-events:none;
  text-shadow:-1px -1px 0 #1a0e10,1px -1px 0 #1a0e10,-1px 1px 0 #1a0e10,1px 1px 0 #1a0e10,0 .1em .3em rgba(0,0,0,.8);animation:tacFloat 1s ease-out forwards}
.tac-float.dmg{color:#fff3e0}.tac-float.big{font-size:2.1em;color:#ffd27a}.tac-float.heal{color:#a8f0a0}.tac-float.miss{color:#c8d0e0;font-size:1em;font-family:'Alegreya Sans SC',sans-serif;letter-spacing:.1em}
.tac-float.info{font-family:'Alegreya Sans SC',sans-serif;font-size:1em;font-weight:700;letter-spacing:.08em;color:#f3d27a}
.tac-float.bad{color:#ff9a80}
.tac-float.magic{color:#b8fff0}
@keyframes tacFloat{0%{transform:translate(-50%,-30%) scale(.4);opacity:0}14%{transform:translate(-50%,-90%) scale(1.25);opacity:1}30%{transform:translate(-50%,-110%) scale(1)}75%{opacity:1}100%{transform:translate(-50%,-190%) scale(.95);opacity:0}}

/* hint */
.tac-hint{z-index:3;left:calc(.8em + var(--safe-left,0px));top:6.6em;width:min(21em,44%);padding:.6em .85em .65em;pointer-events:auto;transition:opacity .25s,transform .25s}
.tac-hint.hidden{opacity:0;transform:translateY(-.6em);pointer-events:none;visibility:hidden;transition:opacity .25s,transform .25s,visibility 0s .25s}
.tac-hint{max-height:calc(100% - var(--tac-header,64px) - var(--tac-footer,40px));overflow-y:auto;overscroll-behavior:contain}
.tac.has-hint .tac-card,.tac.has-hint .tac-tcard:not(.forecast){visibility:hidden}
.tac.has-forecast .tac-hint{visibility:hidden;pointer-events:none}
.tac.has-tip .tac-hint,.tac.has-tip .tac-tcard:not(.forecast){visibility:hidden;pointer-events:none}
.tac-hint .h{font-family:'Alegreya Sans SC',sans-serif;font-size:.72em;letter-spacing:.16em;color:var(--gold);display:flex;gap:.4em;align-items:center}
.tac-hint .h svg{width:1.1em;height:1.1em}
.tac-hint .b{margin-top:.2em;font-size:.95em;color:#f0e4c6;line-height:1.3}
.tac-hint .b em{color:#f3d27a;font-style:normal}
.tac-hint .b strong{color:#fff;font-weight:600}
.tac-hint .row{display:flex;justify-content:flex-end;margin-top:.45em}
.tac-hint .wait{font-family:'Alegreya Sans SC',sans-serif;font-size:.72em;color:#a99a78;letter-spacing:.08em;margin-top:.35em}

/* outcome */
.tac-out{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6em;background:radial-gradient(ellipse at center,rgba(8,10,16,.35),rgba(8,10,16,.85));opacity:0;pointer-events:none;transition:opacity .6s}
.tac-out.show{opacity:1;pointer-events:auto}
.tac-out .t{font-family:Cinzel,serif;font-weight:700;font-size:3em;letter-spacing:.1em;color:#fff1c8;text-shadow:0 .08em 0 #3a2a10,0 0 1em rgba(243,210,122,.5)}
.tac-out.lose .t{color:#ffc8b8;text-shadow:0 .08em 0 #3a1008,0 0 1em rgba(212,87,59,.55)}
.tac-out .s{font-style:italic;color:#e0d2ae;font-size:1.05em}
.tac-out .line{width:16em;height:1px;background:linear-gradient(90deg,transparent,#d8b25a,transparent)}
.tac-out .btns{display:flex;gap:.6em;margin-top:.5em}

/* compact layout for small canvases (phones) */
.tac.compact .tac-card{width:15.5em;padding:.4em .5em}
.tac.compact .tac-card .por{width:3em;height:3em}
.tac.compact .tac-card .ttl,.tac.compact .tac-card .tac-stats{display:none}
.tac.compact .tac-abil{margin-top:.35em;gap:.2em}
.tac.compact .tac-abil button{min-height:1.9em;padding:.2em .35em}
.tac.compact .tac-abil .an{font-size:.8em}
.tac.compact .tac-obj{max-width:calc(28% - 1em);padding:.3em .55em .4em}
.tac.compact .tac-obj .det{display:none}
.tac.compact .tac-hint{width:14.5em;top:5em;font-size:.88em}
.tac.compact .tac-tcard{width:14em;bottom:3.6em}
.tac.compact .tac-tcard.forecast{width:calc(100% - 1.2em);bottom:var(--tac-footer,3.3em);font-size:.9em}
.tac.compact .tac-versus{gap:.3em;grid-template-columns:minmax(0,1fr) 1em minmax(0,1fr)}
.tac.compact .tac-combatant{padding:.15em .25em}
.tac.compact .tac-combatant .por{width:2em;height:2em}
.tac.compact .tac-combatant .ab{display:none}
.tac.compact .forecast-title{gap:.5em}
.tac.compact .tac-pager{font-size:1.4em}
.tac.compact .tac-equipment .tac-chips{display:none}
.tac.compact .tac-growth{gap:.3em}
.tac.compact .tac-tcard .tac-stats{display:none}
.tac.compact .tac-tile{display:none}
.tac.compact .tac-btn{font-size:.85em;padding:.35em .6em}
.tac.compact .tac-btn kbd{display:none}
.tac.compact .tac-menu{min-width:7.5em}
.tac.compact .tac-menu kbd{display:none}
.tac.compact .tac-menu.targeting{left:.8em!important;right:auto!important;top:auto!important;bottom:.8em;min-width:0}
.tac.compact .tac-menu.targeting .tac-target-name{display:none}
.tac.compact .tac-banner .rib{font-size:1.8em}
.tac.compact .tac-order .o{width:1.6em;height:1.6em}
`;
