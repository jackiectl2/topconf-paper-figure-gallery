import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sanitizeReferenceAnalysis} from './reference-visual-guide.mjs';

test('reference-paper names and claims cannot enter the generation guide',()=>{
  const forbidden='Multi-Frequency Augmentation';
  const raw={layout:`${forbidden} on the left`,refinedPrompt:`Draw ${forbidden}`,
    panels:[{name:forbidden,role:forbidden,x:10,y:20,w:700,h:600}],
    layoutBlueprint:[{id:forbidden,role:forbidden,x:15,y:25,w:300,h:200,
      moduleCount:4,occupancy:75,moduleKinds:['chart',forbidden],nesting:forbidden,flow:forbidden}],
    topology:{anchor:forbidden,zones:forbidden,flow:`left to right through ${forbidden}`},
    density:{containers:2,modulesPerPanel:4,boxFillPercent:75,variety:forbidden},
    palette:{background:'#FFFFFF',primary:'#92ACCB',accent:forbidden},
    styleFingerprint:{panelShape:'rounded rectangles',arrowStyle:'straight arrows',textTreatment:forbidden},
    elements:forbidden,hierarchy:forbidden};
  const safe=sanitizeReferenceAnalysis(raw);
  assert.doesNotMatch(JSON.stringify(safe),/Multi-Frequency|Augmentation/);
  assert.equal(safe.panels[0].name,'Panel A');
  assert.equal(safe.layoutBlueprint[0].role,'chart modules');
  assert.deepEqual(safe.layoutBlueprint[0].moduleKinds,['chart']);
  assert.equal(safe.layoutBlueprint[0].moduleCount,4);
  assert.equal(safe.layoutBlueprint[0].occupancy,75);
  assert.equal(safe.topology.flow,'left to right');
  assert.equal(safe.palette.primary,'#92accb');
  assert.equal(safe.palette.accent,undefined);
  assert.equal(safe.refinedPrompt,'');
});
