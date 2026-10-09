export type RepeatSettings={a:string;b:string;count:number;gap:number};
export type SessionState={status:"idle"|"loading"|"playing"|"paused"|"waiting"|"error";key:string|null;cycle:number;message?:string};
export class RecitationSession {
  state:SessionState={status:"idle",key:null,cycle:0};
  private keys:string[]=[];private index=0;private count=1;private gap=0;private timer:ReturnType<typeof setTimeout>|null=null;private waiting=false;private pausedFrom:SessionState["status"]="playing";private deadline=0;private remaining=0;
  constructor(private transport:{play:(key:string)=>void;stop:()=>void;pause:()=>void;resume:()=>void},private changed:(state:SessionState)=>void){}
  private emit(status:SessionState["status"],message?:string){this.state={...this.state,status,message};this.changed(this.state)}
  start(keys:string[],count:number,gap:number){this.cancel();if(!keys.length)return;this.keys=[...keys];this.count=Math.max(0,Math.floor(count));this.gap=Math.max(0,Math.min(60,gap))*1000;this.index=0;this.state={status:"loading",key:keys[0],cycle:1};this.next()}
  private next(){this.state={...this.state,key:this.keys[this.index]};this.emit("loading");this.transport.play(this.keys[this.index])}
  started(key:string){if(this.state.key===key&&this.state.status==="loading")this.emit("playing")}
  ended(key:string){if(key!==this.state.key||this.state.status!=="playing")return;this.index++;if(this.index<this.keys.length){this.next();return}this.index=0;if(this.count&&this.state.cycle>=this.count){this.cancel();return}this.state={...this.state,cycle:this.state.cycle+1};this.waiting=true;this.emit("waiting");this.remaining=this.gap;this.scheduleGap()}
  private scheduleGap(){this.deadline=Date.now()+this.remaining;this.timer=setTimeout(()=>{this.timer=null;this.waiting=false;this.next()},this.remaining)}
  pause(){if(!["playing","waiting","loading"].includes(this.state.status))return;this.pausedFrom=this.state.status;if(this.timer){this.remaining=Math.max(0,this.deadline-Date.now());clearTimeout(this.timer);this.timer=null}this.transport.pause();this.emit("paused")}
  resume(){if(this.state.status!=="paused")return;if(this.waiting){this.emit("waiting");this.scheduleGap()}else{this.emit(this.pausedFrom==="loading"?"loading":"playing");this.transport.resume()}}
  fail(message:string){if(this.timer)clearTimeout(this.timer);this.timer=null;this.transport.stop();this.emit("error",message)}
  cancel(){if(this.timer)clearTimeout(this.timer);this.timer=null;this.waiting=false;this.transport.stop();this.keys=[];this.state={status:"idle",key:null,cycle:0};this.changed(this.state)}
}
