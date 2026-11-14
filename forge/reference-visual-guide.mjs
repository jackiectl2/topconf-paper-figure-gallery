const number = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const hex = value => /^#[0-9a-f]{6}$/i.test(String(value||'')) ? String(value).toLowerCase() : null;
const kinds = new Map([
  ['icon','icon'],['icons','icon'],['chart','chart'],['charts','chart'],
  ['plot','chart'],['plots','chart'],['matrix','matrix'],['matrices','matrix'],
  ['table','table'],['tables','table'],['formula','formula'],['formulas','formula'],
  ['equation','formula'],['equations','formula'],['photo','photo'],['image','image'],
  ['thumbnail','thumbnail'],['timeline','timeline'],['flow strip','flow strip'],
  ['diagram fragment','diagram fragment'],['grid','grid'],['graph','graph'],
  ['legend','legend'],['illustration','illustration'],['waveform','chart']
]);

function visualKinds(values){
  return [...new Set((Array.isArray(values)?values:[]).map(value=>kinds.get(String(value).trim().toLowerCase())).filter(Boolean))].slice(0,6);
}

function visualFlow(text){
  const value=String(text||'').toLowerCase();
  if(/left.to.right|left → right|left-right/.test(value))return 'left to right';
  if(/right.to.left|right → left|right-left/.test(value))return 'right to left';
  if(/top.to.bottom|top → bottom|top-bottom/.test(value))return 'top to bottom';
  if(/bottom.to.top|bottom → top|bottom-top/.test(value))return 'bottom to top';
  return 'follow the measured panel positions';
}

function visualShape(text){
  const value=String(text||'').toLowerCase();
  if(/round|curv/.test(value))return 'rounded rectangles';
  if(/square|rectang|sharp/.test(value))return 'square rectangles';
  return 'rectangular containers';
}

function visualArrow(text){
  const value=String(text||'').toLowerCase();
  return /curv/.test(value)?'curved connectors':/dash|dot/.test(value)?'straight arrows with dashed connectors':'straight arrows';
}

function visualPalette(palette){
  if(!palette||typeof palette!=='object')return {};
  const result={};
  for(const key of ['background','primary','accent','neutral']){
    const color=hex(palette[key]);if(color)result[key]=color;
  }
  result.others=[...new Set((Array.isArray(palette.others)?palette.others:[]).map(hex).filter(Boolean))].slice(0,10);
  return result;
}

/** Keep measured visual structure. Discard all reference-paper names and claims. */
export function sanitizeReferenceAnalysis(raw){
  const source=raw&&typeof raw==='object'?raw:{};
  const panels=(Array.isArray(source.panels)?source.panels:[]).slice(0,8).map((panel,index)=>({
    name:`Panel ${String.fromCharCode(65+index)}`,role:'visual section',
    x:number(panel?.x),y:number(panel?.y),w:number(panel?.w),h:number(panel?.h)
  }));
  const layoutBlueprint=(Array.isArray(source.layoutBlueprint)?source.layoutBlueprint:[]).slice(0,16).map((zone,index)=>{
    const moduleKinds=visualKinds(zone?.moduleKinds);
    return {id:`zone-${index+1}`,role:moduleKinds.length?`${moduleKinds.join(' and ')} modules`:'visual modules',
      x:number(zone?.x),y:number(zone?.y),w:number(zone?.w),h:number(zone?.h),
      moduleCount:number(zone?.moduleCount),occupancy:number(zone?.occupancy),moduleKinds,
      nesting:'grouped visual modules',flow:visualFlow(zone?.flow)};
  });
  const d=source.density||{},s=source.strokes||{},t=source.typography||{},style=source.styleFingerprint||{};
  const allKinds=[...new Set(layoutBlueprint.flatMap(zone=>zone.moduleKinds))];
  return {
    density:{containers:number(d.containers),modulesPerPanel:number(d.modulesPerPanel),
      solidBorders:number(d.solidBorders),dashedBorders:number(d.dashedBorders),
      connectors:number(d.connectors),boxFillPercent:number(d.boxFillPercent),
      nesting:'panel > grouping frame > visual modules',
      variety:allKinds.length?allKinds.join(', '):'visual modules',
      fill:`approximately ${number(d.boxFillPercent)}% of a module box is occupied`},
    strokes:{box:number(s.box),arrow:number(s.arrow),connector:number(s.connector)},
    typography:{panelHeader:number(t.panelHeader),label:number(t.label),note:number(t.note)},
    palette:visualPalette(source.palette),
    layout:`${panels.length} panel regions on a horizontal canvas`,panels,layoutBlueprint,
    topology:{anchor:'panel positions and module counts',zones:'use the measured panel and zone geometry',
      flow:visualFlow(source.topology?.flow),spacing:'even gaps between measured regions'},
    styleFingerprint:{background:'flat background',panelShape:visualShape(style.panelShape),
      moduleShape:visualShape(style.moduleShape),iconStyle:'simple flat icons',
      arrowStyle:visualArrow(style.arrowStyle),textTreatment:'compact panel headers and short labels'},
    elements:allKinds.length?allKinds.join(', '):'visual modules',
    hierarchy:'panel headers, then module labels and annotations',
    refinedPrompt:''
  };
}
