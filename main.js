const { Plugin, MarkdownRenderChild, PluginSettingTab, Setting } = require('obsidian');
const NS='http://www.w3.org/2000/svg';
const R={1:18,2:14,3:10,4:7,5:5};
const LVCOL={1:'#2f5d8a',2:'#4a7bb0',3:'#7aa7d0',4:'#a8c6e2',5:'#d5e5f5'};
const DEFLEVELS=['一般人类思维','学科大图景','主题','概念','事实'];
class Graph{
  constructor(el,triples,app){
    this.el=el; this.app=app; this.mode='3d'; this.scale=0.72; this.tx=0; this.ty=0;
    this.yaw=.3; this.pitch=.2; this.spin=true;
    this.nodes=[]; this.edges=[]; this.stations=[];
    this.build(triples); this.ui(); this.layout(); this.sphere(); this.render(); this.drawLegend(); requestAnimationFrame(()=>this.render()); setTimeout(()=>this.render(),250); this.loop();
  }
  drawLegend(){
    if(!this.lg) return;
    const names=(this.settings&&this.settings.levelNames)||DEFLEVELS;
    this.lg.innerHTML='';
    for(let i=1;i<=5;i++){
      const item=document.createElement('span'); item.className='cmap-lg-item';
      const dot=document.createElement('i'); dot.style.background=LVCOL[i]; dot.style.width=(4+i*2)+'px'; dot.style.height=(4+i*2)+'px';
      const txt=document.createElement('span'); txt.textContent=(names[i-1]||('L'+i));
      item.append(dot,txt); this.lg.appendChild(item);
    }
  }
  build(ts){
    const map=new Map(), nodes=this.nodes;
    const add=(t)=>{ let m=t.match(/^\[L(\d)\]\s*(.+)$/); let id=m?m[2]:t, lv=Math.min(5,Math.max(1,m?+m[1]:3));
      if(!map.has(id)){ const o={id,lv,kind:'c',x:Math.random()*400-200,y:Math.random()*300-150,vx:0,vy:0}; map.set(id,o); nodes.push(o);} return map.get(id); };
    for(const [a,r,b] of ts){
      const A=add(a); const targets=b.split(/[、,，]\s*/).map(s=>s.trim()).filter(Boolean).map(add);
      if(targets.length>1){
        const st={id:r+'@'+A.id,kind:'s',lv:2,label:r,parent:A.id,children:targets.map(t=>t.id),x:0,y:0};
        this.stations.push(st); nodes.push(st); this.edges.push({a:A.id,b:st.id,rel:'',type:'trunk'});
        for(const t of targets) this.edges.push({a:st.id,b:t.id,rel:'',type:'branch'});
      } else if(targets.length===1){
        this.edges.push({a:A.id,b:targets[0].id,rel:r,type:'cross'});
      }
    }
  }
  ui(){
    const bar=document.createElement('div'); bar.className='cmap-bar';
    const b2=document.createElement('button'), b3=document.createElement('button'), bf=document.createElement('button'), bx=document.createElement('button');
    b2.textContent='2D'; b3.textContent='3D 球'; bf.textContent='重置';
    bx.textContent='全屏'; bar.append(bf,bx); this.el.appendChild(bar);
    this.svg=document.createElementNS(NS,'svg'); this.svg.setAttribute('class','cmap-svg');
    const defs=document.createElementNS(NS,'defs');
    defs.innerHTML='<marker id="cmar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b9c6d6"/></marker>'+
      '<radialGradient id="cg" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#8fb6de"/><stop offset="60%" stop-color="#4f7fae"/><stop offset="100%" stop-color="#2f5d8a"/></radialGradient>'+
      '<radialGradient id="cg2" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#bcd6ef"/><stop offset="100%" stop-color="#7ba3cc"/></radialGradient>'+
      '<filter id="cs" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#1d3557" flood-opacity="0.18"/></filter>';
    this.svg.appendChild(defs);
    this.g=document.createElementNS(NS,'g'); this.svg.appendChild(this.g); this.el.appendChild(this.svg);
    const lg=document.createElement('div'); lg.className='cmap-legend'; this.el.appendChild(lg); this.lg=lg;
    bx.onclick=()=>{ if(document.fullscreenElement){document.exitFullscreen();} else { this.svg.requestFullscreen().then(()=>{this.scale=0.72;this.tx=0;this.ty=0;setTimeout(()=>this.render(),120);}).catch(()=>{}); } };
    b2.onclick=()=>{this.mode='2d';this.render();};
    b3.onclick=()=>{this.mode='3d';this.sphere();this.render();};
    bf.onclick=()=>{this.spin=true;this.scale=0.72;this.tx=0;this.ty=0;this.yaw=.3;this.pitch=.2;this.render();};
    this.svg.addEventListener('wheel',e=>{e.preventDefault();this.scale*=e.deltaY>0?.92:1.08;this.render();},{passive:false});
    let d=null;
    this.svg.addEventListener('contextmenu',e=>e.preventDefault());
    this.svg.addEventListener('mouseenter',()=>{ if(this.mode==='3d') this.spin=false; });
    this.svg.addEventListener('mouseleave',()=>{ if(this.mode==='3d') this.spin=true; });
    this.svg.addEventListener('pointerdown',e=>{this.spin=false;d={x:e.clientX,y:e.clientY,pan:(e.button!==0||e.shiftKey),shift:e.shiftKey,sx:e.clientX,sy:e.clientY,moved:false};});
    window.addEventListener('pointerup',()=>{
      const dd=d; d=null;
      if(dd && !dd.moved && this.pending){ const q=this.pending; this.pending=null; this.select(q.id); }
      else if(dd && !dd.moved && !this.pending){ this.select(null); }
    });
    this.svg.addEventListener('pointermove',e=>{
      if(!d)return; const dx=e.clientX-d.x, dy=e.clientY-d.y;
      if(this.mode==='2d'||d.pan||(e.buttons&2)||(e.buttons&4)){this.tx+=dx;this.ty+=dy;} else {this.yaw+=dx*.01;this.pitch=Math.max(-1.3,Math.min(1.3,this.pitch+dy*.01));}
      if(Math.abs(e.clientX-d.sx)+Math.abs(e.clientY-d.sy)>6) d.moved=true;
      d={x:e.clientX,y:e.clientY,pan:d.pan,shift:d.shift,sx:d.sx,sy:d.sy,moved:d.moved}; this.render();
    });
    this.svg.addEventListener('click',async e=>{
      const t=e.target.getAttribute&&e.target.getAttribute('data-note'); if(!t) return;
      const app=this.app;
      const map=app.metadataCache.getFirstLinkpathDest(t+'·交互概念图','');
      if(map){ app.workspace.openLinkText(t+'·交互概念图','',false); return; }
      const note=app.metadataCache.getFirstLinkpathDest(t,'');
      if(note){ app.workspace.openLinkText(t,'',false); return; }
      const leaf=app.workspace.getRightLeaf(false) || app.workspace.getLeaf('tab');
      await leaf.setViewState({type:'search',state:{query:t}});
      app.workspace.revealLeaf(leaf);
    });
  }
  layout(){
    const cs=this.nodes.filter(n=>n.kind==='c');
    for(const n of cs){n.x=(Math.random()-.5)*500;n.y=(Math.random()-.5)*400;}
    for(let it=0;it<400;it++){
      for(let i=0;i<cs.length;i++)for(let j=i+1;j<cs.length;j++){
        const a=cs[i],b=cs[j];let dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy)||1,f=5200/(dd*dd);
        dx/=dd;dy/=dd;a.vx-=dx*f;a.vy-=dy*f;b.vx+=dx*f;b.vy+=dy*f;
      }
      for(const e of this.edges){
        const a=cs.find(n=>n.id===e.a), b=cs.find(n=>n.id===e.b); if(!a||!b)continue;
        const dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy)||1,f=(dd-170)*.02;
        a.vx+=dx/dd*f;a.vy+=dy/dd*f;b.vx-=dx/dd*f;b.vy-=dy/dd*f;
      }
      for(const n of cs){n.vx-=n.x*.002;n.vy-=n.y*.002;n.x+=n.vx*=.85;n.y+=n.vy*=.85;}
    }
    for(const s of this.stations){
      const p=cs.find(n=>n.id===s.parent), kids=s.children.map(c=>cs.find(n=>n.id===c)).filter(Boolean);
      const cx=kids.reduce((a,b)=>a+b.x,0)/(kids.length||1), cy=kids.reduce((a,b)=>a+b.y,0)/(kids.length||1);
      s.x=(p.x+cx)/2; s.y=(p.y+cy)/2;
    }
  }
  sphere(){const N=this.nodes.length,ga=Math.PI*(3-Math.sqrt(5)),R0=230;
    this.nodes.forEach((n,i)=>{const y=1-(i/Math.max(1,N-1))*2,r=Math.sqrt(Math.max(0,1-y*y)),th=ga*i;
      n.sx=Math.cos(th)*r*R0;n.sy=y*R0;n.sz=Math.sin(th)*r*R0;});}
  proj(n){ if(this.mode==='2d')return{x:n.x,y:n.y,z:0};
    const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
    let x=n.sx*cy-n.sz*sy,z=n.sx*sy+n.sz*cy,y=n.sy;
    const y2=y*cp-z*sp,z2=y*sp+z*cp,f=560/(560+z2); return{x:x*f,y:y2*f,z:z2}; }
  render(){
    while(this.g.firstChild)this.g.removeChild(this.g.firstChild);
    const pos=new Map(); this.nodes.forEach(n=>pos.set(n.id,this.proj(n)));
    if(this.sel && !this.nodes.some(n=>n.id===this.sel)) this.sel=null;
    const keep=this.sel?this.nearOf(this.sel,2):null;
    const hov=this.hover, near=new Set();
    if(hov){
    near.add(hov);
    for(const e of this.edges){ if(e.a===hov) near.add(e.b); if(e.b===hov) near.add(e.a); }
    for(let pass=0; pass<2; pass++){
      for(const e of this.edges){
        if(near.has(e.a)) near.add(e.b);
        if(near.has(e.b)) near.add(e.a);
      }
    }
    for(const st of this.stations){
      if(st.id===hov || near.has(st.id)){
        near.add(st.id); near.add(st.parent);
        for(const c of st.children) near.add(c);
      }
    }
  }
    const mk=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
    for(const e of this.edges){
      if(keep&&!(keep.has(e.a)&&keep.has(e.b))) continue;
      const a=pos.get(e.a), b=pos.get(e.b); if(!a||!b)continue;
      const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1, bend=Math.min(30,len*0.12);
      const mx=(a.x+b.x)/2-dy/len*bend, my=(a.y+b.y)/2+dx/len*bend;
      const l=mk('path',{'data-a':e.a,'data-b':e.b,d:`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`,fill:'none',stroke:'#c2cede','stroke-width':e.type==='trunk'?2:1,'stroke-linecap':'round','marker-end':'url(#cmar)'});
      l.setAttribute('opacity', hov?(near.has(e.a)||near.has(e.b)?1:0.22):1);
      if(hov&&(near.has(e.a)&&near.has(e.b))) l.setAttribute('stroke','#2f5d8a');
      this.g.appendChild(l);
      if(e.rel){ const tx=mk('text',{'data-a':e.a,'data-b':e.b,x:(a.x+b.x)/2,y:(a.y+b.y)/2-4,'text-anchor':'middle',class:'cmap-rel'}); tx.textContent=e.rel; this.g.appendChild(tx); }
    }
    for(const n of this.nodes){
      if(keep&&!keep.has(n.id)) continue;
      const p=pos.get(n.id);
      if(n.kind==='s'){
        const t=mk('text',{x:p.x,y:p.y-6,'text-anchor':'middle',class:'cmap-st'}); t.textContent=n.label; this.g.appendChild(t);
        continue;
      }
      const c=mk('circle',{cx:p.x,cy:p.y,r:R[n.lv]||8,fill:LVCOL[n.lv]||'#a8c6e2',stroke:'#ffffff','stroke-width':1.2,'data-note':n.id,class:'cmap-node'});
      c.setAttribute('opacity', hov?(near.has(n.id)?1:0.12):1);
      c.addEventListener('mouseenter',()=>{ if(this.hover!==n.id){ this.hover=n.id; this.hoverPaint(); } });
      c.addEventListener('mouseleave',()=>{ if(this.hover!==null){ this.hover=null; this.hoverPaint(); } });
      c.style.cursor='pointer'; c.addEventListener('pointerdown',ev=>{ this.pending={id:n.id,btn:ev.button}; });
      c.addEventListener('contextmenu',ev=>{ ev.preventDefault(); ev.stopPropagation(); this.openNote(n.id); });
      c.addEventListener('dblclick',ev=>{ ev.preventDefault(); ev.stopPropagation(); this.openNote(n.id); }); this.g.appendChild(c);
      const t=mk('text',{x:p.x,y:p.y-12,'text-anchor':'middle',class:'cmap-label','data-lbl':n.id}); t.textContent=n.id; this.g.appendChild(t);
    }
    const cw=(this.svg.clientWidth||900)/2, ch=(this.svg.clientHeight||640)/2;
    this.g.setAttribute('transform',`translate(${cw},${ch}) scale(${this.scale}) translate(${-this.tx/this.scale},${-this.ty/this.scale})`);
  }
  loop(){ if(this.mode==='3d'&&this.spin){this.yaw+=.004;this.render();} requestAnimationFrame(()=>this.loop()); }
}
Graph.prototype.nearOf=function(id,depth){
  const set=new Set([id]);
  for(let d=0; d<depth; d++){
    for(const e of this.edges){ if(set.has(e.a)) set.add(e.b); if(set.has(e.b)) set.add(e.a); }
  }
  for(const st of this.stations){ if(set.has(st.id)){ set.add(st.parent); for(const c of st.children) set.add(c); } }
  return set;
};
Graph.prototype.hoverPaint=function(){
  const keep=this.sel?this.nearOf(this.sel,2):null;
    const hov=this.hover, near=new Set();
  if(hov){
    near.add(hov);
    for(const e of this.edges){ if(e.a===hov) near.add(e.b); if(e.b===hov) near.add(e.a); }
    for(const st of this.stations){
      if(st.id===hov || near.has(st.id)){
        near.add(st.id); near.add(st.parent);
        for(const c of st.children) near.add(c);
      }
    }
  }
  this.g.querySelectorAll('circle[data-note]').forEach(c=>{
    c.setAttribute('opacity',1);
  });
  this.g.querySelectorAll('path[data-edge]').forEach(p=>{
    const a=p.getAttribute('data-a'), b=p.getAttribute('data-b');
    const on=hov&&(a===hov||b===hov);
    p.setAttribute('opacity', hov?(on?1:0.3):1);
    p.setAttribute('stroke', on?'#2f5d8a':'#c2cede');
    p.setAttribute('stroke-width', on?2:0.9);
  });
  this.g.querySelectorAll('text.cmap-rel').forEach(t=>{
    const a=t.getAttribute('data-a'), b=t.getAttribute('data-b');
    t.setAttribute('opacity',1);
  });
  this.g.querySelectorAll('text[data-lbl]').forEach(t=>{
    t.setAttribute('opacity',1);
  });
};
Graph.prototype.bar=function(){
  if(this._bar) return this._bar;
  const b=document.createElement('div'); b.className='cmap-selbar'; b.style.display='none';
  b.innerHTML='<span class="cmap-selname"></span><button data-act="map">🗺 概念图</button><button data-act="note">📄 笔记</button><button data-act="search">🔍 相关</button><button data-act="x">✕</button>';
  this.el.appendChild(b);
  b.addEventListener('click',ev=>{
    const a=ev.target.getAttribute&&ev.target.getAttribute('data-act'); if(!a) return;
    if(a==='x'){ this.select(null); return; }
    const id=this.sel; if(!id) return;
    if(a==='map') this.openMap(id);
    else if(a==='note') this.openNote(id);
    else if(a==='search') this.search(id);
  });
  this._bar=b; return b;
};
Graph.prototype.select=function(id){
  const b=this.bar();
  if(!id){ this.sel=null; this.hover=null; b.style.display='none'; this.render(); return; }
  this.sel=id; this.hover=id; this.render();
  b.querySelector('.cmap-selname').textContent=id;
  b.style.display='flex';
};
Graph.prototype.search=function(t){
  const app=this.app;
  app.commands.executeCommandById('global-search:open');
  setTimeout(()=>{
    const lv=app.workspace.getLeavesOfType('search')[0];
    if(lv){ lv.setViewState({type:'search',state:{query:t}}); app.workspace.revealLeaf(lv); }
  },180);
};
Graph.prototype.openMap=function(t){
  const app=this.app;
  try{
    const files=app.vault.getMarkdownFiles();
    const map=files.find(f=>f.basename===t+'·交互概念图');
    if(map){ app.workspace.getLeaf('tab').openFile(map); return; }
    this.openNote(t);
  }catch(e){ new Notice('打开失败：'+t); }
};
Graph.prototype.openNote=function(t){
  const app=this.app;
  try{
    const files=app.vault.getMarkdownFiles();
    const note=files.find(f=>f.basename===t);
    if(note){ app.workspace.getLeaf('tab').openFile(note); return; }
    app.commands.executeCommandById('global-search:open');
    setTimeout(()=>{
      const lv=app.workspace.getLeavesOfType('search')[0];
      if(lv){ lv.setViewState({type:'search',state:{query:t}}); app.workspace.revealLeaf(lv); }
      else { new Notice('没有匹配：'+t); }
    },180);
  }catch(e){ new Notice('打开失败：'+t); }
};
const strip=(t)=>{const m=t.match(/^\[L\d\]\s*(.+)$/); return (m?m[1]:t).trim();};
const safeName=(n)=>n.replace(/[\\/:*?"<>|]/g,'-').slice(0,60);

class CMPlugin extends Plugin{
  async onload(){
    this.settings=Object.assign({nodeSize:1,showRel:true,autoSpin:true,libFolder:'System Ⅱ',autoLink:true,map:'',levelNames:DEFLEVELS.slice()}, await this.loadData());
    this.addSettingTab(new CMSettingTab(this));
    const ribbonEl=this.addRibbonIcon('network','构建概念网络',()=>this.buildNetwork());
    setTimeout(()=>this.placeRibbon(ribbonEl), 1500);
    this.addCommand({id:'build-concept-network',name:'构建概念网络',callback:()=>this.buildNetwork()});
    this.registerMarkdownCodeBlockProcessor('cmap',(src,el,ctx)=>{
      const ts=[];
      for(const line of src.split(/\r?\n/)){
        const t=line.trim(); if(!t||t.startsWith('%%'))continue;
        const m=t.match(/^(.+?)\s*--\s*(.+?)\s*-->\s*(.+)$/);
        if(m)ts.push([m[1].trim(),m[2].trim(),m[3].trim()]);
      }
      const ch=new MarkdownRenderChild(el); ctx.addChild(ch);
      const g=new Graph(el,ts,this.app); g.settings=this.settings; g.render();
    });
  }
  placeRibbon(el){
    try{
      if(!el||!el.parentElement) return;
      const bar=el.parentElement;
      const items=[...bar.querySelectorAll('.side-dock-ribbon-action')];
      const anchor=items.find(x=>{
        const t=(x.getAttribute('aria-label')||x.getAttribute('data-tooltip-position')||'')+'';
        return /小米|Minote/i.test(t) || (x.getAttribute('aria-label')||'').includes('小米');
      }) || items.find(x=>/刷新并同步/.test(x.getAttribute('aria-label')||''));
      if(anchor && anchor!==el){ anchor.insertAdjacentElement('afterend', el); }
      else { bar.insertBefore(el, bar.firstChild); }
    }catch(e){}
  }
  async saveSettings(){ await this.saveData(this.settings); }

  async buildNetwork(){
    try{ return await this._buildNetwork(); }
    catch(e){ new Notice('构建失败：'+String(e&&e.message||e).slice(0,80)); console.error('[3d-concept-map]',e); }
  }
  async _buildNetwork(){
    const n0=new Notice('开始构建概念网络…',0);
    const {vault}=this.app, files=vault.getMarkdownFiles();
    const lib=this.settings.libFolder;
    const tri=new Map();
    const add=(s,r,o)=>{ s=strip(s); o=strip(o); if(!s||!o) return; tri.set(s+'|'+r+'|'+o,{s,r,o}); };
    const re=/```cmap\r?\n([\s\S]*?)```/g;
    for(const f of files){
      if(f.path.startsWith(lib+'/概念/') || f.path.endsWith('概念索引.md')) continue;
      const txt=await vault.cachedRead(f);
      let m; re.lastIndex=0;
      while((m=re.exec(txt))){
        for(const line of m[1].split(/\r?\n/)){
          const mm=line.trim().match(/^(.+?)\s*--\s*(.+?)\s*-->\s*(.+)$/);
          if(!mm) continue;
          for(const t of mm[3].split(/[、,，]/)) add(mm[1],mm[2].trim(),t);
        }
      }
    }
    const concepts=new Set(); tri.forEach(t=>{concepts.add(t.s); concepts.add(t.o);});
    if(this.settings.autoLink){
      const mapRules={};
      for(const line of (this.settings.map||'').split(/\r?\n/)){
        const m=line.split('='); if(m.length===2) mapRules[m[0].trim()]=m[1].trim();
      }
      for(const f of files){
        if(f.path.startsWith(lib+'/')||!f.path.startsWith('Minote/')) continue;
        const parts=f.path.split('/'); const folder=parts[1]||'';
        const name=f.basename.replace(/_\d{6,}$/,'').trim();
        if(name.length<2||name.length>20||concepts.has(name)) continue;
        let hit=null;
        for(const c of concepts){ if(c.length>=2&&name.includes(c)){ hit=c; break; } }
        add(name,'属于', hit|| mapRules[folder] || folder);
        concepts.add(name);
      }
    }
    const byS=new Map(), byO=new Map();
    tri.forEach(t=>{ (byS.get(t.s)||byS.set(t.s,[]).get(t.s)).push(t); (byO.get(t.o)||byO.set(t.o,[]).get(t.o)).push(t); });
    const dir=lib+'/概念';
    if(!(await vault.adapter.exists(dir))) await vault.createFolder(dir);
    let n=0, skippedUser=0;
    for(const c of concepts){
      const outs=(byS.get(c)||[]).slice(0,40), ins=(byO.get(c)||[]).slice(0,40);
      let body='---\ngenerated_by: three-d-concept-map\n---\n\n# '+c+'\n\n> 概念节点 · '+(outs.length+ins.length)+' 条连接\n\n## 关系图\n\n```cmap\n';
      body+=outs.map(t=>`${c} --${t.r}--> ${t.o}`).join('\n')+'\n';
      body+=ins.map(t=>`${t.s} --${t.r}--> ${c}`).join('\n')+'\n```\n\n';
      if(outs.length) body+='## 它指向\n\n'+outs.map(t=>`- **${t.r}** → [[${t.o}]]`).join('\n')+'\n\n';
      if(ins.length) body+='## 指向它\n\n'+ins.map(t=>`- [[${t.s}]] ← **${t.r}**`).join('\n')+'\n\n';
      const path=dir+'/'+safeName(c)+'.md';
      const exist=vault.getAbstractFileByPath(path);
      if(exist){
        const oldText=await vault.cachedRead(exist);
        if(!oldText.includes('generated_by: three-d-concept-map')){
          skippedUser++; continue;   // 不是插件生成的同名文件，绝不覆盖
        }
        if(oldText!==body) await vault.modify(exist, body);
      } else { await vault.create(path, body); }
      n++;
      if(n%200===0){ n0.setMessage('构建中… '+n+'/'+concepts.size); }
    }
    const deg=[...concepts].map(c=>({c,d:(byS.get(c)||[]).length+(byO.get(c)||[]).length})).sort((a,b)=>b.d-a.d);
    let idx='# 概念索引（'+concepts.size+' 个概念 / '+tri.size+' 条关系）\n\n| 概念 | 连接数 |\n|---|---|\n';
    idx+=deg.map(x=>`| [[${x.c}]] | ${x.d} |`).join('\n')+'\n';
    const ip=lib+'/概念索引.md';
    const ie=vault.getAbstractFileByPath(ip);
    if(ie) await vault.modify(ie,idx); else await vault.create(ip,idx);
    // 回收：带标记但已不在概念集合里的页面
    let movedOld=0;
    const oldDir=lib+'/旧概念';
    try{
      for(const f of vault.getMarkdownFiles()){
        if(!f.path.startsWith(dir+'/')) continue;
        if(f.extension!=='md') continue;
        const base=f.basename;
        if([...concepts].some(c=>safeName(c)===base)) continue;
        const txt=await vault.cachedRead(f);
        if(!txt.includes('generated_by: three-d-concept-map')) continue;
        if(!(await vault.adapter.exists(oldDir))) await vault.createFolder(oldDir);
        await vault.rename(f, oldDir+'/'+f.name);
        movedOld++;
      }
    }catch(e){}
    n0.hide();
    new Notice(`概念网络已更新：${concepts.size} 个概念 / ${tri.size} 条关系`+(skippedUser?` · 跳过 ${skippedUser} 个同名用户文件`:'')+(movedOld?` · 归档 ${movedOld} 个旧概念页`:''));
  }
}
class CMSettingTab extends PluginSettingTab{
  constructor(plugin){ super(plugin.app, plugin); this.plugin=plugin; }
  display(){
    const {containerEl}=this; containerEl.empty();
    containerEl.createEl('h2',{text:'3D Concept Map 设置'});
    new Setting(containerEl).setName('概念目录').setDesc('生成的概念页与索引放在这里').addText(t=>t.setValue(this.plugin.settings.libFolder).onChange(async v=>{this.plugin.settings.libFolder=v||'概念库'; await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('节点大小').addSlider(s=>s.setLimits(0.6,2,0.1).setValue(this.plugin.settings.nodeSize).setDynamicTooltip().onChange(async v=>{this.plugin.settings.nodeSize=v; await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('显示连词').addToggle(t=>t.setValue(this.plugin.settings.showRel).onChange(async v=>{this.plugin.settings.showRel=v; await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('自动旋转').addToggle(t=>t.setValue(this.plugin.settings.autoSpin).onChange(async v=>{this.plugin.settings.autoSpin=v; await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('自动关联未归类笔记').setDesc('按文件夹或标题匹配已有概念').addToggle(t=>t.setValue(this.plugin.settings.autoLink).onChange(async v=>{this.plugin.settings.autoLink=v; await this.plugin.saveSettings();}));
    const lvNames=(this.plugin.settings.levelNames||DEFLEVELS).slice();
    for(let i=1;i<=5;i++){
      new Setting(containerEl).setName('L'+i+' 名称').addText(t=>t.setValue(lvNames[i-1]||'').onChange(async v=>{ lvNames[i-1]=v; this.plugin.settings.levelNames=lvNames.slice(); await this.plugin.saveSettings(); }));
    }
    new Setting(containerEl).setName('分类规则').setDesc('每行一条：文件夹=概念，例如 明亮=明亮那方').addTextArea(t=>{t.setValue(this.plugin.settings.map||'').setPlaceholder('明亮=明亮那方\n한국어=韩语'); t.inputEl.rows=6; t.onChange(async v=>{this.plugin.settings.map=v; await this.plugin.saveSettings();});});
  }
}
module.exports=CMPlugin;
