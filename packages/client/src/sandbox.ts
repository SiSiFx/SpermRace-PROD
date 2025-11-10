import * as PIXI from 'pixi.js';

const WORLD = { width: 1800, height: 1200 };

type Vec = { x: number; y: number };
type TrailPoint = Vec & { expiresAt: number };

const PHYS = {
  ACC: 180,
  LONG_DRAG: 0.985,  // more forward carry
  LAT_DRAG: 0.998,   // much less sideways damping -> visible drift
  TURN: 3.0,
  MAX: 500,
  TURN_SPEED_SCALE: 0.3,
};

const BOOST = { MULT: 1.7, DUR: 1200, CD: 3500, TRAIL_BONUS: 1500 };
const TRAIL = { EMIT_MS: 50, LIFE: 5000 };
const SELF_BUFFER = 12;
const GRID = 120;

class Car {
  pos: Vec; vel: Vec; angle: number; targetAngle: number; lastEmit=0; trail: TrailPoint[]=[];
  boostUntil: number|null = null; nextBoostAt = 0; alive=true; isHuman=false;
  container: PIXI.Container; g: PIXI.Graphics; color=0x00d4ff;
  constructor(x:number,y:number, stage: PIXI.Container){
    this.pos={x,y}; this.vel={x:0,y:0}; this.angle=Math.random()*Math.PI*2; this.targetAngle=this.angle;
    this.container = new PIXI.Container();
    this.g = new PIXI.Graphics();
    this.container.addChild(this.g);
    stage.addChild(this.container);
  }
  setTarget(mx:number,my:number){ const dx=mx-this.pos.x, dy=my-this.pos.y; this.targetAngle=Math.atan2(dy,dx); }
  tryBoost(){ const now=Date.now(); if(now<this.nextBoostAt) return; this.boostUntil=now+BOOST.DUR; this.nextBoostAt=now+BOOST.CD; }
  update(dt:number, accelerating:boolean){
    if(!this.alive) return;
    let d = this.targetAngle - this.angle; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI;
    const speed = Math.hypot(this.vel.x,this.vel.y);
    const turnScale = 1/(1+(speed/PHYS.MAX)*PHYS.TURN_SPEED_SCALE);
    this.angle += d*PHYS.TURN*turnScale*dt;
    const boosting = this.boostUntil!==null && Date.now()<this.boostUntil;
    if(accelerating){
      const ax=Math.cos(this.angle)*PHYS.ACC*(boosting?BOOST.MULT:1);
      const ay=Math.sin(this.angle)*PHYS.ACC*(boosting?BOOST.MULT:1);
      this.vel.x += ax*dt; this.vel.y += ay*dt;
    }
    const hx=Math.cos(this.angle), hy=Math.sin(this.angle);
    const vf = this.vel.x*hx + this.vel.y*hy;
    const vs = -this.vel.x*hy + this.vel.y*hx;
    const vf2 = vf*PHYS.LONG_DRAG, vs2 = vs*PHYS.LAT_DRAG;
    this.vel.x = vf2*hx - vs2*hy; this.vel.y = vf2*hy + vs2*hx;
    const s2=Math.hypot(this.vel.x,this.vel.y); if(s2>PHYS.MAX){ const r=PHYS.MAX/s2; this.vel.x*=r; this.vel.y*=r; }
    this.pos.x += this.vel.x*dt; this.pos.y += this.vel.y*dt;
    if(this.pos.x<0){this.pos.x=0; this.vel.x=Math.abs(this.vel.x)*0.5}
    if(this.pos.x>WORLD.width){this.pos.x=WORLD.width; this.vel.x=-Math.abs(this.vel.x)*0.5}
    if(this.pos.y<0){this.pos.y=0; this.vel.y=Math.abs(this.vel.y)*0.5}
    if(this.pos.y>WORLD.height){this.pos.y=WORLD.height; this.vel.y=-Math.abs(this.vel.y)*0.5}
    this.lastEmit += dt*1000; const now=Date.now();
    if(this.lastEmit>=TRAIL.EMIT_MS){ this.lastEmit=0; this.trail.push({x:this.pos.x,y:this.pos.y,expiresAt: now+TRAIL.LIFE+(boosting?BOOST.TRAIL_BONUS:0)}); }
    this.trail = this.trail.filter(p=>p.expiresAt>now);
  }
  draw(){
    this.g.clear(); this.g.rect(-12,-7,24,14).fill(this.color);
    this.container.position.set(this.pos.x,this.pos.y); this.container.rotation = this.angle;
  }
}

class Grid {
  map = new Map<string, { car: Car; point: TrailPoint }[]>();
  key(p:Vec){ return `${Math.floor(p.x/GRID)},${Math.floor(p.y/GRID)}`; }
  clear(){ this.map.clear(); }
  insert(car:Car, point:TrailPoint){ const k=this.key(point); if(!this.map.has(k)) this.map.set(k,[]); this.map.get(k)!.push({car,point}); }
  nearby(p:Vec){ const out: { car: Car; point: TrailPoint }[]=[]; const cx=Math.floor(p.x/GRID), cy=Math.floor(p.y/GRID); for(let x=cx-1;x<=cx+1;x++){ for(let y=cy-1;y<=cy+1;y++){ const k=`${x},${y}`; const arr=this.map.get(k); if(arr) out.push(...arr); } } return out; }
}

function collide(cars: Car[]){
  const grid = new Grid(); grid.clear();
  for(const c of cars){ if(!c.alive) continue; for(const pt of c.trail) grid.insert(c, pt); }
  for(const c of cars){ if(!c.alive) continue; const near=grid.nearby(c.pos);
    for(const e of near){
      if(e.car===c){ const idx=c.trail.indexOf(e.point); if(idx>c.trail.length-SELF_BUFFER) continue; }
      const dx=c.pos.x-e.point.x, dy=c.pos.y-e.point.y; if((dx*dx+dy*dy) < (10+5)*(10+5)) { c.alive=false; break; }
    }
  }
}

async function main(){
  const app = new PIXI.Application();
  await app.init({ width: window.innerWidth, height: window.innerHeight, backgroundColor: 0x0a0a0f, resizeTo: window });
  document.body.appendChild(app.canvas);
  const stage = app.stage;

  const worldG = new PIXI.Graphics(); worldG.rect(0,0,WORLD.width,WORLD.height).stroke({width:2,color:0x00d4ff,alpha:0.6}); stage.addChild(worldG);
  const trailLayer = new PIXI.Graphics(); stage.addChild(trailLayer);

  const hudSpeed = document.getElementById('hud-speed')!; const hudBoost = document.getElementById('hud-boost')!; const hudStatus = document.getElementById('hud-status')!;

  const cars: Car[] = [];
  const human = new Car(WORLD.width/2, WORLD.height/2, stage); human.isHuman=true; human.color=0x00d4ff; cars.push(human);
  // bots
  for(let i=0;i<12;i++){ const b=new Car(Math.random()*WORLD.width, Math.random()*WORLD.height, stage); b.color=0xff6b6b; cars.push(b); }

  let mouse = { x: WORLD.width/2, y: WORLD.height/2 };
  let accelerating = true; // always accelerating like slither feel
  const updateMouse = (x:number,y:number)=>{ mouse.x=x; mouse.y=y; human.setTarget(mouse.x, mouse.y); };
  app.canvas.addEventListener('mousemove', (e)=>{ const r=app.canvas.getBoundingClientRect(); updateMouse(e.clientX-r.left, e.clientY-r.top); });
  window.addEventListener('keydown',(e)=>{ if(e.code==='Space') human.tryBoost(); if(e.code==='KeyR') reset(); });

  function reset(){ for(const c of cars){ c.pos={x:Math.random()*WORLD.width,y:Math.random()*WORLD.height}; c.vel={x:0,y:0}; c.trail=[]; c.alive=true; c.angle=Math.random()*Math.PI*2; c.targetAngle=c.angle; } }

  function botAI(){
    for(const c of cars){ if(c.isHuman || !c.alive) continue; // simple wander target
      if(Math.random()<0.02){ const tx=c.pos.x + (Math.random()*400-200), ty=c.pos.y + (Math.random()*400-200); c.setTarget(Math.max(0,Math.min(WORLD.width,tx)), Math.max(0,Math.min(WORLD.height,ty))); }
      if(Math.random()<0.003) c.tryBoost();
    }
  }

  app.ticker.add((t)=>{
    const dt = t.deltaTime/60;
    botAI();
    for(const c of cars){ c.update(dt, accelerating); }
    // redraw trails in world space layer
    trailLayer.clear();
    for(const c of cars){
      if(c.trail.length>1){
        trailLayer.moveTo(c.trail[0].x,c.trail[0].y);
        for(let i=1;i<c.trail.length;i++){ trailLayer.lineTo(c.trail[i].x,c.trail[i].y); }
        trailLayer.stroke({ width: 6, color: 0xff6b6b, alpha: 0.85, cap: 'round', join: 'round' });
      }
    }
    for(const c of cars){ c.draw(); }
    collide(cars);
    const alive = cars.filter(c=>c.alive);
    if(alive.length===1){ const winner=alive[0]; hudStatus.textContent = winner.isHuman? 'WINNER (You)' : 'WINNER (Bot)'; hudStatus.className = winner.isHuman? 'ok' : 'warn'; setTimeout(reset, 1500); }
    const sp = Math.round(Math.hypot(human.vel.x,human.vel.y)); hudSpeed.textContent = String(sp);
    const cd = Math.max(0, human.nextBoostAt - Date.now()); hudBoost.textContent = cd>0 ? `${Math.ceil(cd/100)/10}s` : 'ready'; hudBoost.className = cd>0 ? 'warn' : 'ok';
    if(human.alive){ hudStatus.textContent = 'alive'; hudStatus.className='ok'; } else { hudStatus.textContent='eliminated'; hudStatus.className='bad'; }
  });
}

main().catch(console.error);



