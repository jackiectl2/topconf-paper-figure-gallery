import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';

const source=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const targetsStart=source.indexOf('const TARGETS = {');
const targets=source.slice(targetsStart,source.indexOf('\n};',targetsStart)+3);
const helpers=source.slice(source.indexOf('function generationIntent('),source.indexOf('\nconst SVG_SYS'));
const budgets=source.slice(source.indexOf('function imagePromptBudget('),source.indexOf('function compactImageGuide('));
const imageStart=source.indexOf('  const budget=imagePromptBudget(model);',source.indexOf('async function genOaiImage('));
assert.ok(imageStart>0);
const imageAssembly=source.slice(imageStart,source.indexOf('\n  let body;',imageStart));

function harness(){
  const nodes={'#target':{value:'overview'},'#targetDesc':{value:''}};
  const ctx={
    $:id=>nodes[id],tt:key=>key,refs:new Set(),data:{figs:[]},GAL_I18N:{lang:'zh'},
    ratio:'16:9',zonePriority:'',hasAnalyzedLayout:true,layoutGuide:'style '.repeat(2000),
    detailedPrompt:'Detailed reference style. '.repeat(2000)
  };
  runInNewContext(`${targets}\n${helpers}\n${budgets}
    function imagePrompt(content,model){
      const p='oai';
      const tg=TARGETS[$('#target').value] || TARGETS.overview;
      const methodOnly=['pipeline','architecture'].includes($('#target').value);
      ${imageAssembly}
      return imgPrompt;
    }
    this.targets=TARGETS;`,ctx);
  return {ctx,nodes};
}

for(const target of ['overview','architecture','pipeline','results','custom']){
  for(const model of ['gpt-image-2.5-sunburst','qwen-image','qwen-image-2.0']){
    test(`${target}: manual paper input reaches SVG and ${model} with complete intent`,()=>{
      const {ctx,nodes}=harness();
      nodes['#target'].value=target;
      nodes['#targetDesc'].value='请画训练和推理双分支，末尾必须有反馈环。';
      const description=target==='custom'?nodes['#targetDesc'].value:ctx.targets[target].instr;
      const content='Method: input passes through encoder to output. '.repeat(500);
      const svg=ctx.buildPrompt(content,'reference guide',[]);
      const bitmap=ctx.imagePrompt(content,model);
      assert.match(bitmap,/every visible word in the finished figure must be English/);
      for(const prompt of [svg,bitmap]){
        assert.ok(prompt.includes('Comic Sans MS'));
        assert.match(prompt,/Do not add any figure-wide title banner or standalone title row/);
        assert.match(prompt,/restrained cartoon illustration style/);
        assert.match(prompt,/no more than 1,300 visible non-whitespace characters/);
        assert.match(prompt,/square rectangular modules, even spacing, straight arrows/);
        assert.ok(prompt.includes(ctx.targets[target].promptLabel));
        assert.ok(prompt.includes(description));
        assert.ok(prompt.includes('input passes through encoder'));
        if(target!=='custom') assert.ok(!prompt.includes(nodes['#targetDesc'].value));
      }
      if(target==='pipeline'||target==='architecture'){
        assert.match(bitmap,/without empirical results|Do not add a Results stage/);
        assert.doesNotMatch(bitmap,/method and results|results that the paper content|result thumbnail/);
        assert.ok(bitmap.lastIndexOf('Final method-only rule:')>bitmap.indexOf('input passes through encoder'));
        assert.ok(svg.lastIndexOf('Final method-only rule:')>svg.indexOf('input passes through encoder'));
      }
      const budget=ctx.imagePromptBudget(model);
      assert.ok(ctx.imagePromptSize(bitmap,budget)<=budget.limit);
    });
  }
}

test('reference analysis drops a top title banner before building generation guides',()=>{
  const omit=source.slice(source.indexOf('function omitGlobalTitle('),source.indexOf('function jsonCandidateSlices('));
  const style=source.slice(source.indexOf('function imageStyleText('),source.indexOf('function designContractText('));
  const contract=source.slice(source.indexOf('function designContractText('),source.indexOf('function generationIntent('));
  const ctx={figureCanvas:()=>({width:1600,height:900})};
  runInNewContext(`${omit}\n${style}\n${contract}\nthis.clean=omitGlobalTitle;this.style=imageStyleText;this.contract=designContractText;`,ctx);
  const analyzed={typography:{title:56,panelHeader:28,label:22,note:18},
    panels:[{name:'Figure title',role:'overall title banner',x:0,y:20,w:1100,h:70},
      {name:'Panel A',role:'Method',x:0,y:110,w:780,h:700}],
    layoutBlueprint:[{id:'title-row',role:'figure title',x:0,y:20,w:1100,h:70},
      {id:'method',role:'Method modules',x:0,y:110,w:780,h:700}]};
  const clean=ctx.clean(analyzed);
  assert.equal(clean.typography.title,undefined);
  assert.equal(clean.panels.length,1);
  assert.equal(clean.layoutBlueprint.length,1);
  const guides=ctx.style(clean).join('\n')+'\n'+ctx.contract(clean);
  assert.doesNotMatch(guides,/title 56px|title-row|overall title banner|Figure title/);
  assert.match(guides,/panelHeader 28px/);
  assert.match(guides,/Method modules/);
});

test('generation uses the current selection and custom description, independent of PDF parsing',()=>{
  const {ctx,nodes}=harness();
  ctx.imagePrompt('Manual input','gpt-image');
  nodes['#target'].value='custom';
  nodes['#targetDesc'].value='Current custom intent';
  assert.ok(ctx.imagePrompt('Manual input','gpt-image').includes('Current custom intent'));
  assert.ok(ctx.buildPrompt('Manual input','',[]).includes('Current custom intent'));
  nodes['#target'].value='pipeline';
  assert.ok(!ctx.imagePrompt('Manual input','gpt-image').includes('Current custom intent'));
});

test('oversized custom intent is reported rather than silently truncated',()=>{
  const {ctx,nodes}=harness();
  nodes['#target'].value='custom';
  nodes['#targetDesc'].value='绘图要求'.repeat(3000);
  assert.throws(()=>ctx.imagePrompt('Manual input','qwen-image'),/绘图意图超出/);
});
