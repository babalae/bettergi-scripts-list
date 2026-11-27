const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scriptRoot = path.join(__dirname, '../../repo/js/AutoStoryLoader');
const target = '测试任务';
async function loader(options = {}) {
    const calls = {quests: [], maps: [], later: 0, cleanup: 0, refresh: 0, triggers: [], writes: []};
    const settings = {disclaimer_accepted: true, disclaimer_confirm_text: '同意', ...options.settings};
    const tracker = {run: async name => {
        calls.quests.push(name);
        if (options.questError) throw Error('quest unavailable');
        return options.verified !== false;
    }};
    const map = {runFile: async name => {
        calls.maps.push(name);
        if (options.mapError) throw Error('map unavailable');
    }};
    const context = {
        settings,
        injectedTracker: tracker, injectedMap: map,
        file: {
            ReadImageMatSync: () => ({}),
            readTextSync: name => {
                if (name === 'quest-tracker.js') return '({createBgi: () => injectedTracker})';
                if (name === 'map-tracking.js') return '({createBgi: () => injectedMap})';
                if (name === './settings.json') return JSON.stringify([{name:'process_selector'}]);
                throw Error('unexpected file ' + name);
            },
            readText: async () => JSON.stringify(options.steps || [{type:'地图追踪',data:'route.json'}]),
            ReadPathSync: () => {calls.refresh++;return [];},
            writeTextSync: (name,text) => {calls.writes.push([name,text]);return true;}
        },
        RecognitionObject: {TemplateMatch: () => ({})},
        RealtimeTimer: function(name) {this.name=name;},
        log: {info(){},warn(){},debug(){},error(){}},
        genshin: {returnMainUi: async () => {}},
        sleep: async () => {},
        dispatcher: {
            AddTrigger: value => calls.triggers.push(value.name),
            ClearAllTriggers: () => calls.cleanup++
        }
    };
    const source = fs.readFileSync(path.join(scriptRoot,'main.js'),'utf8')
        .replace('await Main();','UIUtils.createMainUIChecker = () => () => true; return {Main, Execute, StepProcessorFactory, StepProcessor};');
    const api = await vm.runInNewContext(source,context);
    api.StepProcessorFactory.processors.after = async () => calls.later++;
    return {api,calls};
}
test('tracking-only mode runs the requested quest without loading a selected plot',async()=>{
    const h=await loader({settings:{target_quest_name:target,process_selector:'作者-剧情'}});
    await h.api.Main();
    assert.deepEqual(h.calls.quests,[target]);
    assert.equal(h.calls.maps.length,0);assert.equal(h.calls.triggers.length,0);
    assert.equal(h.calls.cleanup,1);
});
test('existing disclaimer gate still prevents any new game action',async()=>{
    for(const setting of [{disclaimer_accepted:false},{disclaimer_confirm_text:'未确认'}]){
        const h=await loader({settings:{target_quest_name:target,...setting}});
        await h.api.Main();
        assert.equal(h.calls.quests.length+h.calls.maps.length,0);
        assert.equal(h.calls.cleanup,1);
    }
});
test('tracking before a plot retains the public upstream path convention',async()=>{
    const h=await loader({settings:{target_quest_name:target,quest_track_only:false,process_selector:'作者-剧情'}});
    await h.api.Main();
    assert.deepEqual(h.calls.quests,[target]);
    assert.equal(h.calls.maps.length,1);
    assert.match(h.calls.maps[0],/^process\/+作者\/剧情\/route\.json$/);
    assert.equal(h.calls.cleanup,1);
});
test('blank quest retains ordinary list refresh without game input',async()=>{
    const h=await loader({settings:{target_quest_name:' ',disclaimer_accepted:false}});
    await h.api.Main();
    assert.equal(h.calls.quests.length+h.calls.maps.length,0);
    assert.equal(h.calls.refresh,1);assert.equal(h.calls.writes.length,1);
});
test('quest failure in the entry stops the selected plot and clears triggers',async()=>{
    const h=await loader({questError:true,settings:{target_quest_name:target,quest_track_only:false,process_selector:'作者-剧情'}});
    await assert.rejects(h.api.Main(),e=>e.questTracking===true);
    assert.equal(h.calls.maps.length,0);assert.equal(h.calls.cleanup,1);
});
test('JSON object and string quest instructions run once and preserve following steps',async()=>{
    for(const step of [{type:'追踪任务',data:target},'追踪任务 '+target]){
        const h=await loader();
        await h.api.Execute.executeUnifiedTalkProcess([step,{type:'after'}],'作者','剧情');
        assert.deepEqual(h.calls.quests,[target]);assert.equal(h.calls.later,1);
    }
});
test('unverified quest result does not repeat the action and permits following steps',async()=>{
    const h=await loader({verified:false});
    await h.api.Execute.executeUnifiedTalkProcess([{type:'追踪任务',data:target},{type:'after'}],'作者','剧情');
    assert.deepEqual(h.calls.quests,[target]);assert.equal(h.calls.later,1);
});
test('quest and map errors propagate through nested flow catches',async()=>{
    for(const kind of ['quest','map']){
        const step=kind==='quest'?{type:'追踪任务',data:target}:{type:'地图追踪',data:'route.json'};
        const h=await loader({[kind+'Error']:true,steps:[step,{type:'after'}]});
        await assert.rejects(h.api.Execute.executeTalkCommission('作者','剧情'),e=>e[kind+'Tracking']===true);
        assert.equal(h.calls.later,0);
    }
});
test('a plot map error reaches Main and clears started triggers',async()=>{
    const h=await loader({mapError:true,settings:{process_selector:'作者-剧情'}});
    await assert.rejects(h.api.Main(),e=>e.mapTracking===true);
    assert.equal(h.calls.cleanup,1);assert(h.calls.triggers.length>0);
});
test('unrelated existing step errors retain the upstream continue behavior',async()=>{
    const h=await loader();
    h.api.StepProcessorFactory.processors.old = async () => {throw Error('old error');};
    await h.api.Execute.executeUnifiedTalkProcess([{type:'old'},{type:'after'}],'作者','剧情');
    assert.equal(h.calls.later,1);
});
test('diagnostic minimap writes are off by default and bounded when enabled',()=>{
    const source=fs.readFileSync(path.join(scriptRoot,'weather-position.js'),'utf8');
    function harness(diagnostics){
        let writes=0,disposed=0;
        const context={
            createWeatherLocalizer:()=>({match:()=>({ok:false}),dispose(){}}),
            isInMainUI:()=>true,
            captureGameRegion:()=>({SrcMat:{Width:1920},Dispose(){}}),
            OpenCvSharp:{OpenCvSharp:{Rect:class{}}},
            Mat:class{Dispose(){disposed++;}},
            file:{WriteImageSync(){writes++;return true;},WriteTextSync(){return true;}},
            log:{info(){},warn(){}}
        };
        const reader=vm.runInNewContext(source+'\ncreateWeatherPositionReader({nativeFallback:false,diagnostics:'+diagnostics+'});',context);
        for(let i=0;i<12;i++)assert.equal(reader.read(true),null);
        reader.dispose();
        return {writes,disposed};
    }
    assert.deepEqual(harness(false),{writes:0,disposed:0});
    assert.deepEqual(harness(true),{writes:8,disposed:8});
});
test('manifest and resource defaults describe the shipped entry',()=>{
    const manifest=JSON.parse(fs.readFileSync(path.join(scriptRoot,'manifest.json')));
    assert.equal(manifest.version,'1.6.1');assert.equal(manifest.bgi_version,'0.66.0');
    assert(fs.existsSync(path.join(scriptRoot,manifest.main)));
    const settings=JSON.parse(fs.readFileSync(path.join(scriptRoot,manifest.settings_ui)));
    assert.equal(settings.find(x=>x.name==='quest_track_only').default,true);
    assert.equal(settings.find(x=>x.name==='weather_diagnostics').default,false);
    assert(settings.some(x=>x.name==='disclaimer_accepted'));
    for(const name of ['MapBack_07_color.webp','MapBack_07_gray.webp'])
        assert(fs.statSync(path.join(scriptRoot,'assets/weather',name)).size>0);
});
