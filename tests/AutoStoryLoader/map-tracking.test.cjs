const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = __dirname;
const scriptRoot = path.join(__dirname, '../../repo/js/AutoStoryLoader');
const code = fs.readFileSync(path.join(scriptRoot, 'map-tracking.js'), 'utf8');
const api = vm.runInNewContext(code);
const route = JSON.parse(fs.readFileSync(path.join(root, 'test-route.json'), 'utf8'));
const makeRoute = points => ({info: {map_name:'Teyvat'}, positions:points});
function harness(input = route, options = {}) {
    let now = 0, at = {x:5977,y:9377}, angle = 270, reads = 0, disposed = 0, reset = 0, dashUntil = 0, movingReads = 0, failedRead = false, nativeReads = 0;
    const held = new Set(), messages = [], events = [], arrivals = [];
    const env = {
        readFile: () => JSON.stringify(input),
        nativeRun: async name => {events.push(['native',name]);},
        createReader: () => ({
            read(fresh) {
                assert.equal(fresh, true);
                if (failedRead) assert.equal(held.size, 0, 'Failed recognition must release keys before retry');
                if (held.has('VK_W')) movingReads++;
                reads++;
                const result = options.read ? options.read(reads, at) : {X: Math.round(at.x), Y: Math.round(at.y)};
                failedRead = !result;
                return result;
            },
            reset: () => {reset++;}, dispose: () => {disposed++;}
        }),
        now: () => now,
        sleep: async ms => {
            now += ms;
            if (options.cancelAt && now >= options.cancelAt) throw new Error('cancelled');
            if (held.has('VK_W') && !options.blocked) {
                const step = ms / 1000 * (held.has('VK_RBUTTON') || now <= dashUntil ? 12 : 6);
                at = {x: at.x - Math.cos(angle * Math.PI / 180) * step,
                    y: at.y - Math.sin(angle * Math.PI / 180) * step};
            }
        },
        keyDown: k => {held.add(k); events.push(['down',k,now]);},
        keyUp: k => {if(held.has(k)) events.push(['up',k,now]);held.delete(k);},
        tap: k => {events.push(['tap',k,now]);dashUntil=now+400;},
        orientation: () => options.badAngle ? NaN : angle,
        turn: x => {if(!options.badTurn) angle = (angle + x * (options.degreesPerPixel || 1/3) + 360) % 360;},
        teleport: async (x,y) => {events.push(['tp',x,y]);at={x,y};},
        info: m => {messages.push(m);if(m.includes('已到达点')) arrivals.push({...at});},
        warn: m => messages.push(m)
    };
    if (options.nativeRead) {
        env.nativeRead = () => {
            assert.equal(held.size,0,'Native localization must run at rest');
            return options.nativeRead(++nativeReads,at);
        };
        env.nativeRunJson = async text => {
            assert.equal(held.size,0,'Release custom movement before native handoff');
            const nativeRoute=JSON.parse(text);events.push(['nativeJson',nativeRoute]);
            if(options.nativeError)throw new Error(options.nativeError);
            if(!options.nativeIncomplete){const end=nativeRoute.positions.at(-1);at={x:end.x,y:end.y};}
        };
    }
    return {run: () => api.createRunner(env).runFile('route.json'), env, held, messages, events, arrivals,
        get: () => ({now,at,angle,reads,disposed,reset,movingReads,nativeReads})};
}
test('actual 10-point route is reached in order using fresh coordinates', async () => {
    const h = harness(); await h.run();
    assert.equal(h.events.filter(x=>x[0]==='tp').length, 1);
    assert.equal(h.arrivals.length, 9);
    h.arrivals.forEach((p,i)=>assert(Math.hypot(p.x-route.positions[i+1].x,p.y-route.positions[i+1].y)<3));
    assert(h.messages.at(-1).includes('全部路径点已实测到达'));
    assert.equal(h.get().disposed, 1);assert.equal(h.held.size, 0);
    assert(h.events.some(x=>x[0]==='tap'&&x[1]==='VK_RBUTTON'));
    assert(!h.events.some(x=>x[0]==='native'));
});
test('other maps delegate the exact original filename without game input or vision', async () => {
    for(const input of [makeRoute([{x:0,y:100}]),{...route,info:{map_name:'TheChasm'}}]) {
        const h = harness(input);await h.run();
        assert.deepEqual(h.events,[['native','route.json']]);assert.equal(h.get().reads,0);
    }
});
test('special actions, flight, climb and mixed map routes are never silently simplified', async () => {
    for(const change of [{action:'fight'}, {move_mode:'fly'}, {move_mode:'climb'},
        {point_ext_params:{misidentification:{}}},{items:[{name:'item'}]},{x:1}]) {
        const input = structuredClone(route);Object.assign(input.positions[2],change);
        const h=harness(input);await h.run();
        assert.deepEqual(h.events,[['native','route.json']]);assert(h.messages[0].includes('原内置寻路器'));
    }
});
test('failed recognition stops and cannot announce completion', async () => {
    const h=harness(route,{read:()=>null});
    await assert.rejects(h.run(),/未获得可靠坐标/);
    assert.equal(h.held.size,0);assert.equal(h.get().disposed,1);
    assert(!h.events.some(e=>e[0]==='down'));assert(!h.messages.some(m=>m.includes('全部路径点')));
});
test('a false position hundreds of units away is rejected after a valid start', async () => {
    const h=harness(route,{read:(i,p)=>i<=3?{X:p.x,Y:p.y}:{X:7000,Y:9000}});
    await assert.rejects(h.run(),/未获得可靠坐标/);assert.equal(h.held.size,0);
    assert(!h.messages.some(m=>m.includes('已到达点')));
});
test('a transient recognition miss retries at rest and recovers', async () => {
    const h=harness(route,{read:(i,p)=>i===3?null:{X:Math.round(p.x),Y:Math.round(p.y)}});
    await h.run();assert.equal(h.arrivals.length,9);
});
test('cancellation at multiple movement/turn/recognition boundaries releases keys', async () => {
    for(const cancelAt of [50,400,1500,2500,5100,20000]) {
        const h=harness(route,{cancelAt});await assert.rejects(h.run(),/cancelled/);
        assert.equal(h.held.size,0);assert.equal(h.get().disposed,1);
        assert(!h.messages.some(m=>m.includes('全部路径点')));
    }
});
test('blocked terrain stops with an error rather than skipping waypoints', async () => {
    const h=harness(route,{blocked:true});await assert.rejects(h.run(),/无进展/);
    assert.equal(h.held.size,0);assert.equal(h.arrivals.length,0);
});
test('invalid camera or ineffective rotation prevents movement', async () => {
    for(const options of [{badAngle:true},{badTurn:true}]) {
        const h=harness(route,options);await assert.rejects(h.run(),/朝向|转向/);
        assert(!h.events.some(e=>e[0]==='down'));assert.equal(h.held.size,0);
    }
});
test('a route without initial teleport must start near its first point', async () => {
    const h=harness(makeRoute([{x:8000,y:9000,type:'target'}]));
    await assert.rejects(h.run(),/未获得可靠坐标/);assert(!h.events.some(e=>e[0]==='down'));
});
test('world bearing and wrap agree at all four cardinal directions',()=>{
    const a={x:6000,y:9300};
    assert.equal(api.bearing(a,{x:5990,y:9300}),0);
    assert.equal(api.bearing(a,{x:6000,y:9290}),90);
    assert.equal(api.bearing(a,{x:6010,y:9300}),180);
    assert.equal(api.bearing(a,{x:6000,y:9310}),270);
    assert.equal(api.turnDelta(359,1),2);assert.equal(api.turnDelta(1,359),-2);
});
test('turns converge at high mouse sensitivity that made fixed gain oscillate',async()=>{
    for (const degreesPerPixel of [.1,.5,1,1.4]) {
        const h=harness(route,{degreesPerPixel});await h.run();assert.equal(h.arrivals.length,9);
    }
});
test('leaving the HUD during a turn stops before any movement',async()=>{
    const h=harness();h.env.mainUI=()=>false;
    await assert.rejects(h.run(),/离开主界面/);assert.equal(h.held.size,0);
});
test('invalid routes fail before any teleport or keyboard action',async()=>{
    for(const input of [makeRoute([]),makeRoute([{x:'6000',y:9300}]),makeRoute([null])]) {
        const h=harness(input);await assert.rejects(h.run());assert.equal(h.events.length,0);
    }
});
test('real BGI factory loads scoped modules, uses strict HUD and disables native fallback',()=>{
    let disposed=0, factoryCalled=false;
    const context={settings:{},file:{readTextSync:name=> name==='weather-localizer.js' ? 'function createWeatherLocalizer() {return 123;}' :
        'function createWeatherPositionReader(options) { check(options.nativeFallback,createWeatherLocalizer(),isInMainUI()); return {read:()=>null,reset(){},dispose(){}}; }'},
        captureGameRegion:()=>({Find:()=>({isEmpty:()=>true}),Dispose(){disposed++;}}),
        check:(fallback,loc,main)=>{factoryCalled=true;assert.equal(fallback,false);assert.equal(loc,123);assert.equal(main,false);},
        keyUp(){},genshin:{},log:{info(){},warn(){}},sleep:async()=>{}};
    context.file.readTextSyncOrig=context.file.readTextSync;
    context.file.readTextSync=name=>name==='route.json'?JSON.stringify(makeRoute([{x:6000,y:9300}])):context.file.readTextSyncOrig(name);
    const instance=vm.runInNewContext(code,context).createBgi({});
    return assert.rejects(instance.runFile('route.json'),/未获得可靠坐标/).then(()=>{
        assert(factoryCalled);assert.equal(disposed,2);
    });
});
test('dash keeps forward movement continuous and taps sprint at native one-second intervals',async()=>{
    const h=harness(makeRoute([{x:5977,y:9377,type:'teleport'},{x:5977,y:9280,type:'target',move_mode:'dash'}]));
    await h.run();
    assert(h.get().movingReads>10);
    const dashes=h.events.filter(e=>e[0]==='tap');assert(dashes.length>2);
    for(let i=1;i<dashes.length;i++) assert(dashes[i][2]-dashes[i-1][2]>=1000);
    assert(!h.events.some(e=>e[0]==='down'&&e[1]==='VK_RBUTTON'));
    assert(h.events.filter(e=>e[0]==='down'&&e[1]==='VK_W').length<5);
});
test('walk never sprints and only run holds sprint, releasing it near the target',async()=>{
    for(const mode of ['walk','run']) {
        const h=harness(makeRoute([{x:5977,y:9377,type:'teleport'},{x:5977,y:9280,type:'target',move_mode:mode}]));
        await h.run();assert(!h.events.some(e=>e[0]==='tap'));
        const down=h.events.filter(e=>e[0]==='down'&&e[1]==='VK_RBUTTON');
        assert.equal(down.length,mode==='run'?1:0);assert.equal(h.held.size,0);
    }
});
test('four actual endpoint captures recover with independent two-half confirmation and measured coordinates',()=>{
    const frames=JSON.parse(fs.readFileSync(path.join(root,'fixtures/snow-replay.json'),'utf8'));
    const queue=[{ok:true,X:5901,Y:9195,exactScore:.8}],messages=[];
    let now=10000;
    const context={Date:class extends Date{static now(){return now;}},
        createWeatherLocalizer:()=>({match:()=>queue.shift(),dispose(){}}),
        isInMainUI:()=>true,captureGameRegion:()=>({SrcMat:{},Dispose(){}}),
        log:{info:m=>messages.push(m),warn:m=>messages.push(m)},
        genshin:{getPositionFromMapWithMatchingMethod(){throw Error('Native fallback should be disabled');}}};
    const text=fs.readFileSync(path.join(scriptRoot,'weather-position.js'),'utf8');
    const reader=vm.runInNewContext(text+'\ncreateWeatherPositionReader({nativeFallback:false});',context);
    reader.read(true);
    const measured=[];
    for(const frame of frames){now=frame.sampledAt;queue.push(frame.result);const p=reader.read(true);assert(p);measured.push([p.X,p.Y]);}
    assert.deepEqual(measured,[[5899,9194],[5895,9191],[5894,9190],[5894,9190]]);
    reader.dispose();assert(messages.some(m=>m.includes('"failed":0')));
});

const ordinaryRoute=()=>makeRoute([
    {x:6583.4736328125,y:9580.5,type:'teleport',move_mode:'walk'},
    {x:6624.568359375,y:9576.3701171875,type:'path',move_mode:'dash'},
    {x:6631.8466796875,y:9568.1416015625,type:'target',move_mode:'walk'}]);
const nativeAt=(_i,p)=>({X:p.x,Y:p.y});

test('ordinary layer overlapping outdoor coordinates delegates once, without repeating teleport or changing saved route',async()=>{
    const input=ordinaryRoute(),before=JSON.stringify(input);
    const h=harness(input,{read:()=>null,nativeRead:nativeAt});await h.run();
    assert.equal(h.get().reads,0);assert.equal(h.get().nativeReads,4);
    assert.equal(h.events.filter(e=>e[0]==='tp').length,1);
    const handed=h.events.filter(e=>e[0]==='nativeJson');assert.equal(handed.length,1);
    assert.equal(handed[0][1].info.map_match_method,'SIFT');
    assert.deepEqual(handed[0][1].positions.slice(1),input.positions.slice(1));
    assert.deepEqual(handed[0][1].positions[0],{x:input.positions[0].x,y:input.positions[0].y,type:'path',move_mode:'walk'});
    assert(!h.events.some(e=>e[0]==='down'));assert.equal(h.held.size,0);
    assert.equal(JSON.stringify(input),before);assert.equal(h.get().disposed,0);
    assert(!h.messages.some(m=>m.includes('[雪雾')));
    assert(h.messages.at(-1).includes('当前地图步骤完成'));
});

test('ordinary route without teleport retains all original points and the native movement modes',async()=>{
    const input=makeRoute([{x:5977,y:9377,type:'path',move_mode:'walk'},{x:5980,y:9350,type:'target',move_mode:'dash'}]);
    const h=harness(input,{read:()=>null,nativeRead:nativeAt});await h.run();
    const handed=h.events.find(e=>e[0]==='nativeJson')[1];
    assert.deepEqual(handed.positions.slice(1),input.positions);
    assert(!h.events.some(e=>e[0]==='tp'));
});

test('missing, distant or unstable native positions cannot select the ordinary-layer route',async()=>{
    for(const nativeRead of [()=>null,()=>({X:8000,Y:9500}),()=>({X:null,Y:null}),
        (i,p)=>({X:p.x+(i===2?4:0),Y:p.y})]){
        const h=harness(ordinaryRoute(),{read:()=>null,nativeRead});
        await assert.rejects(h.run(),/未获得可靠坐标/);
        assert(!h.events.some(e=>e[0]==='nativeJson'||e[0]==='down'));assert.equal(h.held.size,0);
    }
});

test('a confirmed snow segment cannot switch to native just because its later texture match fails',async()=>{
    const h=harness(route,{read:(i,p)=>i<=3?nativeAt(i,p):null,nativeRead:()=>null});
    await assert.rejects(h.run(),/未获得可靠坐标/);
    assert.equal(h.get().nativeReads,1);assert(!h.events.some(e=>e[0]==='nativeJson'));
    assert.equal(h.held.size,0);
});

test('native completion requires fresh endpoint verification even when the native API resolves after a failure',async()=>{
    const h=harness(ordinaryRoute(),{read:()=>null,nativeRead:nativeAt,nativeIncomplete:true});
    await assert.rejects(h.run(),/终点坐标未通过复核/);
    assert(!h.messages.some(m=>m.includes('当前地图步骤完成')));assert.equal(h.held.size,0);
});

test('native handoff exceptions and cancellation do not mark the map step complete',async()=>{
    for(const options of [{nativeError:'cancelled'},{cancelAt:150},{cancelAt:350}]){
        const h=harness(ordinaryRoute(),{read:()=>null,nativeRead:nativeAt,...options});
        await assert.rejects(h.run(),/cancelled/);
        assert.equal(h.held.size,0);assert.equal(h.get().disposed,0);
        assert(!h.messages.some(m=>m.includes('当前地图步骤完成')));
    }
});

test('camera or progress errors cannot trigger the native localization fallback',async()=>{
    for(const options of [{badAngle:true},{blocked:true}]){
        const h=harness(route,{nativeRead:()=>null,...options});await assert.rejects(h.run());
        assert.equal(h.get().nativeReads,1);assert(!h.events.some(e=>e[0]==='nativeJson'));
    }
});

test('a later teleport can select a new ordinary layer without replaying a completed snow segment',async()=>{
    const input=makeRoute([{x:5977,y:9377,type:'teleport'}, {x:5977,y:9370,type:'target'}, ...ordinaryRoute().positions]);
    const h=harness(input,{read:(i,p)=>p.x<6500?nativeAt(i,p):null,nativeRead:(i,p)=>p.x<6500?null:nativeAt(i,p)});await h.run();
    assert.equal(h.events.filter(e=>e[0]==='tp').length,2);
    assert.equal(h.arrivals.length,1);
    const handed=h.events.find(e=>e[0]==='nativeJson')[1];
    assert.deepEqual(handed.positions.slice(1),input.positions.slice(3));
});

test('ordinary layer hands back to weather matching after a later teleport to snow',async()=>{
    const input=makeRoute([...ordinaryRoute().positions,{x:5977,y:9377,type:'teleport'},{x:5977,y:9370,type:'target'}]);
    const h=harness(input,{read:(i,p)=>p.x<6500?nativeAt(i,p):null,nativeRead:(i,p)=>p.x<6500?null:nativeAt(i,p)});await h.run();
    assert.equal(h.events.filter(e=>e[0]==='tp').length,2);assert.equal(h.arrivals.length,1);
    const handed=h.events.filter(e=>e[0]==='nativeJson');assert.equal(handed.length,1);
    assert.deepEqual(handed[0][1].positions.slice(1),input.positions.slice(1,3));
    assert.equal(h.get().nativeReads,5);assert.equal(h.held.size,0);
});

test('ordinary-map success never constructs or executes the weather detector',async()=>{
    const h=harness(ordinaryRoute(),{nativeRead:nativeAt});
    h.env.createReader=()=>{throw new Error('Weather detector must not start on native success');};
    await h.run();assert.equal(h.get().reads,0);
    assert.equal(h.events.filter(e=>e[0]==='nativeJson').length,1);
});

test('an unconfirmed native start falls through to unchanged snow movement exactly once',async()=>{
    const h=harness(route,{nativeRead:()=>({X:8000,Y:10000})});await h.run();
    assert.equal(h.get().nativeReads,1);assert.equal(h.arrivals.length,9);
    assert.equal(h.events.filter(e=>e[0]==='nativeJson').length,0);
    assert.equal(h.messages.filter(m=>m.includes('启用本段室外纹理定位')).length,1);
});

test('real BGI factory selects ordinary native pathing without creating a weather reader',async()=>{
    const input=makeRoute([{x:6600,y:9580,type:'path'},{x:6610,y:9580,type:'target'}]);
    let at={X:6600,Y:9580},reads=0,runs=0,disposed=0;
    const context={file:{readTextSync:name=>name==='route.json'?JSON.stringify(input):
        name==='weather-localizer.js'?'function createWeatherLocalizer(){throw Error("Unexpected weather");}':
        'function createWeatherPositionReader(){throw Error("Unexpected weather reader");}'},
        captureGameRegion:()=>({Find:()=>({isEmpty:()=>false}),Dispose(){disposed++;}}),
        genshin:{getPositionFromMapWithMatchingMethod(...args){assert.deepEqual(args,['Teyvat','SIFT',0]);reads++;return at;}},
        pathingScript:{run:async text=>{runs++;const p=JSON.parse(text).positions.at(-1);at={X:p.x,Y:p.y};}},
        keyUp(){},sleep:async()=>{},log:{info(){},warn(){throw Error('Unexpected weather warning');}}};
    await vm.runInNewContext(code,context).createBgi({}).runFile('route.json');
    assert.equal(reads,4);assert.equal(runs,1);assert.equal(disposed,4);
});

test('other nations, separate maps and mixed-region routes perform no specialized localization',async()=>{
    const points=[{x:100,y:200},{x:4326,y:9300},{x:8986,y:9300},{x:6000,y:7400},{x:6000,y:11034}];
    const routes=[...points.map(p=>makeRoute([{...p,type:'target'}])),
        {...route,info:{map_name:'TheChasm'}},makeRoute([{x:100,y:200,type:'teleport'},{x:6000,y:9300,type:'target'}])];
    for(const input of routes){
        const h=harness(input,{nativeRead:()=>{throw Error('Extra native verification outside Snezhnaya');}});
        h.env.createReader=()=>{throw Error('Weather reader outside Snezhnaya');};
        await h.run();assert.deepEqual(h.events,[['native','route.json']]);assert.equal(h.get().nativeReads,0);
    }
});

test('real BGI factory outside Snezhnaya does not even read the weather modules',async()=>{
    const input=makeRoute([{x:100,y:200,type:'target'}]);const files=[],runs=[];
    const context={file:{readTextSync:name=>{files.push(name);assert.equal(name,'route.json');return JSON.stringify(input);}},
        pathingScript:{runFile:async name=>runs.push(name)},genshin:{},log:{warn(){}}};
    await vm.runInNewContext(code,context).createBgi({}).runFile('route.json');
    assert.deepEqual(files,['route.json']);assert.deepEqual(runs,['route.json']);
});
