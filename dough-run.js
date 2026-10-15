(function(){
var WIDTH=720,HEIGHT=260,GROUND=205;
var CHECKPOINTS=[2000,4000,6000,8000,10000];
var MINI_TROPHIES_PER_CHECKPOINT=4;
var canvas,ctx,state,frame=0,raf=0,active=false,paused=false,mode="endless",player="",ducking=false,canvasObserver;
var ORDER_KEY="dbz-dough-run-player";
function read(key,fallback){try{return localStorage.getItem(key)||fallback}catch(e){return fallback}}
function write(key,value){try{localStorage.setItem(key,value)}catch(e){}}
function bestKey(){return "dbz-dough-run-best-"+mode}
function currentBest(){return Number(read(bestKey(),"0"))||0}
function $(selector){return document.querySelector(selector)}
function text(selector,value){var element=$(selector);if(element)element.textContent=value}
function currentPlayer(){return read(ORDER_KEY,"Runner")}
function getMode(){return read("dbz-dough-run-mode","endless")==="marathon"?"marathon":"endless"}
function go(route){location.hash="#/"+route}
function resizeCanvas(){
 if(!canvas||!ctx)return;
 var bounds=canvas.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return;
 var previousGround=GROUND,previousHeight=HEIGHT;
 HEIGHT=Math.round(bounds.height*WIDTH/bounds.width);
 GROUND=HEIGHT-55;
 var scale=Math.min(window.devicePixelRatio||1,2);
 var width=Math.round(bounds.width*scale),height=Math.round(bounds.height*scale);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
 ctx.setTransform(width/WIDTH,0,0,height/HEIGHT,0,0);
 ctx.imageSmoothingEnabled=false;
 if(state&&previousGround!==GROUND){
  var groundShift=GROUND-previousGround;
  state.burger.y+=groundShift;
  state.obstacles.forEach(function(obstacle){obstacle.y+=groundShift});
  state.clouds.forEach(function(cloud){cloud.y=Math.round(cloud.y*HEIGHT/previousHeight)});
 }
}
function updateBest(){var best=Math.max(currentBest(),Math.floor(state.score));write(bestKey(),String(best));return best}
function updateMenu(){
 player=currentPlayer();
 text("[data-run-player]",player);
 var oldMode=mode;
 mode="endless";text("[data-run-endless-best]",String(currentBest()));
 mode="marathon";text("[data-run-marathon-best]",String(currentBest()));
 mode=oldMode;
}
function onRoute(route){
 active=false;
 paused=false;
 if(canvasObserver){canvasObserver.disconnect();canvasObserver=null}
 if(raf)cancelAnimationFrame(raf);
 raf=0;
 if(route==="dough-run-info"){
  var input=$("#runner-name");
  if(input)input.value=read(ORDER_KEY,"");
 }else if(route==="dough-run-menu"){
  updateMenu();
 }else if(route==="dough-run-game"){
  mode=getMode();
  player=currentPlayer();
  canvas=$("#dough-run-canvas");
  if(!canvas)return;
  ctx=canvas.getContext("2d");
  resizeCanvas();
  if(window.ResizeObserver){canvasObserver=new ResizeObserver(function(){resizeCanvas();if(active&&paused)draw()});canvasObserver.observe(canvas)}
  reset();
  active=true;
  raf=requestAnimationFrame(loop);
 }else if(route==="dough-run-over"||route==="dough-run-victory"){
  player=currentPlayer();
  text("[data-run-player]",player);
  if(state){
   text("[data-run-score]",String(Math.floor(state.score)));
   text("[data-run-best]",String(currentBest()));
   var rewards=$("[data-run-rewards]");
   if(rewards){
    rewards.replaceChildren();
    if(state.rewards.length){
     state.rewards.forEach(function(reward){
      var badge=document.createElement("span");
      badge.textContent="🏆 × "+reward.miniTrophies+" mini trophies · "+reward.score.toLocaleString()+" points";
      rewards.appendChild(badge);
      if(reward.grandTrophy){
       var grand=document.createElement("span");
       grand.textContent="🏆 Grand trophy";
       rewards.appendChild(grand);
      }
     });
    }else{
     rewards.textContent="No checkpoint rewards this run. Give it another try!";
    }
   }
  }
 }
}
function savePlayer(value){
 player=value.trim().slice(0,24);
 if(!player)return;
 write(ORDER_KEY,player);
 go("dough-run-menu");
}
function start(selectedMode){
 mode=selectedMode==="marathon"?"marathon":"endless";
 paused=false;
 write("dbz-dough-run-mode",mode);
 go("dough-run-game");
}
function restart(){start(getMode())}
function togglePause(){
 if(!active||!state||state.dead)return;
 paused=!paused;
 ducking=false;
 var button=$("[data-run-pause]");
 if(button){
  button.textContent=paused?"Resume":"Pause";
  button.setAttribute("aria-label",paused?"Resume game":"Pause game");
 }
 text("[data-run-status]",paused?"Game paused. Select Resume to continue.":"Game resumed.");
 if(paused){
  if(raf)cancelAnimationFrame(raf);
  raf=0;
  draw();
 }else{
  raf=requestAnimationFrame(loop);
 }
}
function reset(){
 paused=false;
 state={score:0,speed:5.6,tick:0,ground:0,nextObstacle:70,rewards:[],toast:"",toastTime:0,dead:false,
  burger:{x:72,y:GROUND,vy:0,duck:false},obstacles:[],clouds:[{x:230,y:Math.round(HEIGHT*.17)},{x:545,y:Math.round(HEIGHT*.28)}]};
 ducking=false;
 text("[data-run-status]","");
 updateHud();
}
function updateHud(){
 text("[data-run-score]",String(Math.floor(state.score)));
 text("[data-run-best]",String(currentBest()));
 text("[data-run-player]",player);
 text("[data-run-mode-label]",mode==="marathon"?"Marathon Munchies":"Endless Runner");
 if(mode==="marathon"){
  var next=CHECKPOINTS[state.rewards.length];
  text("[data-run-progress]",next?"Milestone "+(state.rewards.length+1)+" of 5 · "+Math.min(Math.floor(state.score),next).toLocaleString()+"/"+next.toLocaleString():"All checkpoints cleared");
 }else{
  text("[data-run-progress]","Best "+currentBest());
 }
 if(state.toastTime>0)text("[data-run-status]","Milestone "+state.rewards.length+" of 5 complete: "+state.toast+"!");
}
function jump(){
 if(!active||paused||!state||state.dead)return;
 var burger=state.burger;
 if(burger.y>=GROUND){burger.vy=-13;text("[data-run-status]","Jump!")}
}
function spawnObstacle(){
 var flying=state.score>180&&Math.random()<.24;
 if(flying){
  var levels=[GROUND-20,GROUND-48,GROUND-74];
  state.obstacles.push({type:"flying",x:WIDTH+30,y:levels[Math.floor(Math.random()*levels.length)],w:38,h:24});
 }else{
  var count=1+Math.floor(Math.random()*2);
  state.obstacles.push({type:"pastry",x:WIDTH+30,y:GROUND,w:24*count+6,h:28+Math.floor(Math.random()*14),count:count});
 }
 state.nextObstacle=Math.max(42,Math.floor(88+Math.random()*55-state.speed*2));
}
function playerBox(){
 var burger=state.burger;
 if(ducking&&burger.y>=GROUND)return{x:burger.x+3,y:burger.y-25,w:52,h:21};
 return{x:burger.x+7,y:burger.y-39,w:34,h:37};
}
function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function finish(victory){
 active=false;
 state.dead=true;
 var best=updateBest();
 text("[data-run-score]",String(Math.floor(state.score)));
 text("[data-run-best]",String(best));
 if(victory)go("dough-run-victory");else go("dough-run-over");
}
function update(){
 if(!active||!state)return;
 state.tick++;
 state.speed=Math.min(11.5,5.6+state.score/430);
 state.score+=state.speed/12;
 state.ground=(state.ground+state.speed)%WIDTH;
 var burger=state.burger;
 if(burger.y<GROUND||burger.vy<0){burger.vy+=.62+(ducking?.75:0);burger.y+=burger.vy;if(burger.y>=GROUND){burger.y=GROUND;burger.vy=0}}
 state.clouds.forEach(function(cloud){cloud.x-=state.speed*.22;if(cloud.x<-65){cloud.x=WIDTH+30;cloud.y=25+Math.random()*65}});
 if(--state.nextObstacle<=0)spawnObstacle();
 var box=playerBox();
 for(var i=0;i<state.obstacles.length;i++){
  var obstacle=state.obstacles[i];
  obstacle.x-=state.speed;
  var obstacleBox={x:obstacle.x+3,y:obstacle.y-obstacle.h+3,w:obstacle.w-6,h:obstacle.h-5};
  if(hit(box,obstacleBox)){finish(false);return}
 }
 state.obstacles=state.obstacles.filter(function(obstacle){return obstacle.x>-60});
 if(mode==="marathon"&&state.rewards.length<CHECKPOINTS.length&&state.score>=CHECKPOINTS[state.rewards.length]){
  var milestone=CHECKPOINTS[state.rewards.length];
  var finalMilestone=state.rewards.length===CHECKPOINTS.length-1;
  state.toast=milestone.toLocaleString()+" points · "+MINI_TROPHIES_PER_CHECKPOINT+" mini trophies"+(finalMilestone?" and the grand trophy":"");
  state.toastTime=150;
  state.rewards.push({score:milestone,miniTrophies:MINI_TROPHIES_PER_CHECKPOINT,grandTrophy:finalMilestone});
  text("[data-run-status]","Milestone "+state.rewards.length+" of 5 complete: "+state.toast+"!");
  if(finalMilestone){finish(true);return}
 }
 if(state.toastTime>0)state.toastTime--;
 if(state.tick%6===0)updateHud();
}
function pixel(x,y,w,h){ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function drawBurger(){
 var burger=state.burger,top=burger.y,step=Math.floor(state.tick/6)%2;
 var bg=getComputedStyle(document.documentElement).getPropertyValue("--hero").trim();
 var fg=getComputedStyle(document.documentElement).getPropertyValue("--hero-text").trim();
 var accent=getComputedStyle(document.documentElement).getPropertyValue("--gold").trim();
 function rect(color,x,y,w,h){ctx.fillStyle=color;pixel(burger.x+x,top+y,w,h)}
 if(ducking&&burger.y>=GROUND){
  rect(fg,8+(step?0:5),-7,6,7);rect(fg,39+(step?5:0),-7,6,7);
  rect("#d98e3b",0,-15,51,7);rect("#6b3a1e",-2,-22,55,7);
  rect(accent,0,-25,51,4);rect("#5aa83a",-2,-29,55,4);
  rect("#e8a24a",2,-37,47,9);rect("#e8a24a",8,-41,34,5);
  rect(bg,32,-34,4,4);rect(bg,41,-34,4,4);
  return;
 }
 rect(fg,10,-8,6,8-(step?4:0));rect(fg,29,-8,6,8-(step?0:4));
 rect("#d98e3b",3,-17,38,8);rect("#6b3a1e",0,-25,44,8);
 rect(accent,2,-29,40,4);rect("#5aa83a",-2,-33,48,4);
 rect("#e8a24a",2,-41,40,8);rect("#e8a24a",8,-45,28,5);
 rect("#fff3d6",12,-43,3,2);rect("#fff3d6",25,-42,3,2);rect("#fff3d6",19,-39,3,2);
 rect(bg,28,-39,4,5);rect(bg,35,-39,4,5);
}
function drawObstacle(obstacle){
 var accent=getComputedStyle(document.documentElement).getPropertyValue("--gold").trim();
 if(obstacle.type==="flying"){
  ctx.fillStyle="#704b32";pixel(obstacle.x+6,obstacle.y-14,24,11);pixel(obstacle.x,obstacle.y-11,8,5);pixel(obstacle.x+30,obstacle.y-16,8,7);
  ctx.fillStyle="#fff3d6";pixel(obstacle.x+14,obstacle.y-12,3,3);pixel(obstacle.x+24,obstacle.y-12,3,3);
  return;
 }
 for(var i=0;i<obstacle.count;i++){
  var x=obstacle.x+i*25;
  ctx.fillStyle="#8a542e";pixel(x+4,obstacle.y-obstacle.h,16,obstacle.h);
  ctx.fillStyle="#e8a24a";pixel(x,obstacle.y-obstacle.h+7,24,5);
  ctx.fillStyle=accent;pixel(x+7,obstacle.y-obstacle.h+14,9,4);
 }
}
function draw(){
 var bg=getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
 var fg=getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
 var muted=getComputedStyle(document.documentElement).getPropertyValue("--muted").trim();
 ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
 ctx.fillStyle=muted;ctx.globalAlpha=.32;
 state.clouds.forEach(function(cloud){pixel(cloud.x,cloud.y,45,8);pixel(cloud.x+10,cloud.y-7,24,8)});
 ctx.globalAlpha=1;ctx.fillStyle=fg;
 pixel(0,GROUND,WIDTH,2);
 for(var i=0;i<22;i++){var x=((i*103-state.ground+WIDTH*2)%WIDTH);pixel(x,GROUND+9+(i%3)*5,3+(i%4)*2,2)}
 state.obstacles.forEach(drawObstacle);
 drawBurger();
 ctx.fillStyle=fg;ctx.font='bold 16px "Courier New",monospace';ctx.textAlign="right";
 ctx.fillText("SCORE "+String(Math.floor(state.score)).padStart(5,"0"),WIDTH-14,25);
 if(mode==="marathon")ctx.fillText("MILESTONE "+Math.min(state.rewards.length+1,5)+"/5",WIDTH-14,47);
 if(state.toastTime>0){ctx.textAlign="center";ctx.font='bold 17px "Courier New",monospace';ctx.fillText("REWARD: "+state.toast.toUpperCase(),WIDTH/2,83)}
 if(paused){
  ctx.fillStyle=bg;ctx.globalAlpha=.78;ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.globalAlpha=1;
  ctx.fillStyle=fg;ctx.textAlign="center";ctx.font='bold 30px Poppins,Arial,sans-serif';ctx.fillText("PAUSED",WIDTH/2,HEIGHT/2+10);
 }
}
function loop(){
 if(!active)return;
 if(!paused)update();
 draw();
 if(active&&!paused)raf=requestAnimationFrame(loop);
}
document.addEventListener("submit",function(event){if(event.target.matches("[data-run-form]")){event.preventDefault();var input=event.target.querySelector("[name=runner]");if(input.reportValidity())savePlayer(input.value)}});
document.addEventListener("pointerdown",function(event){
 if(!active||paused)return;
 if(event.target.closest("[data-run-jump]")||event.target===canvas){event.preventDefault();jump()}
 if(event.target.closest("[data-run-duck]")){event.preventDefault();ducking=true}
});
window.addEventListener("pointerup",function(){ducking=false});
window.addEventListener("pointercancel",function(){ducking=false});
window.addEventListener("resize",function(){if(active)resizeCanvas()});
window.addEventListener("keydown",function(event){
 if(!active||paused)return;
 if(event.code==="Space"||event.code==="ArrowUp"){event.preventDefault();jump()}
 if(event.code==="ArrowDown"){event.preventDefault();ducking=true}
});
window.addEventListener("keyup",function(event){if(event.code==="ArrowDown")ducking=false});
window.DoughRun={onRoute:onRoute,savePlayer:savePlayer,start:start,restart:restart,togglePause:togglePause};
})();
