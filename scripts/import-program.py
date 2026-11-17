"""Build catalogue from visually reviewed prescriptions and bundled source images."""
import json,re,pathlib
curated=json.load(open('scripts/reviewed-prescriptions.json'));files=sorted(f for f in pathlib.Path('public/program').glob('*/*.jpg') if f.parent.name in ['April','May','June']);groups={};entries=[]
for f in files:
 m=re.search(r'W(\d)D(\d)',f.name);key=f'{f.parent.name}-W{m[1]}D{m[2]}';p=str(f).removeprefix('public/');groups.setdefault(key,[]).append(p);entries.append({'path':p,'sessionId':key,'supporting':'_Sheet' in p,'review':'visually-inspected; reviewed summary; original retained'})
def rng(text,unit):
 m=re.search(r'(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?'+unit,text)
 return [float(m[1]),float(m[2] or m[1])] if m else None
sessions=[]
for key,sources in groups.items():
 if key not in curated:raise ValueError('Missing reviewed prescription '+key)
 month=key.split('-')[0];w,d=map(int,re.search(r'W(\d)D(\d)',key).groups());blocks=[]
 for part in curated[key].split('；'):
  if '｜' in part:blocks.append(part)
  elif blocks:blocks[-1]+='；'+part
 exercises=[]
 for i,chunk in enumerate(blocks):
  name,details=chunk.split('｜',1);kind='hold' if any(x in name for x in ['等长','支撑','悬挂','悬垂']) and not any(x in name for x in ['高翻','抓举','引体','触杠','举腿']) else 'conditioning' if any(x in name for x in ['划船机','自行车','单车','风扇车','能量系统','代谢','间歇','快慢跑','有氧','冷身']) else 'sprint' if any(x in name for x in ['跑','冲刺','加速','行走','雪橇']) else 'jump' if any(x in name for x in ['跳','Pogo','CMJ','DJ','SJ']) else 'throw' if any(x in name for x in ['抛','掷','药球砸']) else 'strength'
  if name in ['训练时间','原图指导','执行提示','新牛说明','无雪橇/阻力设备时替代','测试记录','原文说明','复合循环','第一复合组','第二复合组','第三复合组','第三循环','第四循环','第一循环','群聚循环']:kind='other'
  complex_=any(x in name+details for x in ['群聚','两波','三波','Wave','循环','计数','需确认','组合'])
  sets=rng(details,'组') or (rng(details,'趟') if kind=='sprint' else None);reps=rng(details,'次')
  percent=re.search(r'(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?%([^，；]*?)1RM',details)
  load=[float(percent[1]),float(percent[2] or percent[1])] if percent and not complex_ else None
  ref=(percent[3] or None) if percent else None
  v=re.search(r'MV([≥>]?)(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?m/s',details)
  velocity=[float(v[2]),float(v[3] or v[2])] if v and not complex_ else None
  tempo=re.search(r'\d[-:/]\d[-:/][Xx\d](?:[-:/]\d)?',details)
  rest=re.search(r'休(?:息)?(\d+(?:\.\d+)?)(?:[–-](\d+(?:\.\d+)?))?(秒|分钟)',details)
  restRange=[float(rest[1])*(60 if rest[3]=='分钟' else 1),float(rest[2] or rest[1])*(60 if rest[3]=='分钟' else 1)] if rest and not complex_ else None
  hold=rng(details,'秒') if kind=='hold' else None
  distance=rng(name,'米') or rng(details,'米') if kind=='sprint' else None
  work=rng(details,'秒') if kind=='conditioning' else None
  ambiguity='Complex structure: use original instructions; record each actual set separately.' if complex_ else '1RM reference is not specified by the source.' if load and not ref else None
  exercises.append({'id':key+f'-{i+1}','name':name,'sourceText':chunk.replace('｜','\n'),'kind':kind,'sets':None if complex_ else sets,'reps':None if complex_ else reps,'perSide':bool(re.search(r'/侧|每侧|每方向|/手',details)),'loadPercent':load,'referenceExerciseId':ref,'tempo':tempo[0] if tempo else None,'velocityTarget':velocity,'velocityMetric':None,'velocityComparison':'min' if v and v[1] else 'range','restSeconds':restRange,'holdSeconds':hold,'distanceMetres':distance,'workSeconds':work,'rounds':None if complex_ else rng(details,'轮'),'optional':any(x in name+details for x in ['选做','自愿','有条件']),'groupId':key+'-complex' if complex_ else None,'ambiguity':ambiguity,'purpose':'generalAerobic' if kind=='conditioning' and any(x in name for x in ['冷身','有氧']) else 'conditioning' if kind=='conditioning' and '代谢' not in name else 'other'})
 sessions.append({'id':key,'month':month,'blockIndex':['April','May','June'].index(month),'week':w,'day':d,'optional':any('Optional' in p for p in sources),'sourceText':curated[key].replace('；','\n\n').replace('｜','\n'),'sources':sources,'exercises':exercises})

# UP is a reviewed structured input, not raw OCR-derived prescriptions.
up=json.loads(pathlib.Path('scripts/reviewed-up-prescriptions.json').read_text())
metadata=json.loads(pathlib.Path('scripts/reviewed-program-metadata.json').read_text())
for session in sessions:
 session.update(programId='lp',phaseId='lp-'+str(session['blockIndex']+1))
for folder,index in [('July',0),('August',1)]:
 grouped={}
 for f in sorted(pathlib.Path('public/program',folder).glob('*.jpg')):
  w,d=re.search(r'W(\d)D(\d)',f.name).groups()
  key='August-W2D2' if f.name=='Aug_W2D1_Warmup.jpg' else f'{folder}-W{w}D{d}'
  path=str(f).removeprefix('public/')
  grouped.setdefault(key,[]).append(path)
  entries.append(dict(path=path,sessionId=key,role='alternative' if ('Supplement' in path) else 'continuation' if 'Continued' in path else 'session',review='visual review; structured summary; original authority retained'))
 for key,paths in grouped.items():
  if key not in up:raise ValueError('Missing reviewed UP entry '+key)
  w,d=map(int,re.search(r'W(\d)D(\d)',key).groups())
  ex=up[key]
  for n,prescription in enumerate(ex):prescription['id']=f'{key}-{n+1}'
  s=dict(id=key,programId='up',phaseId=f'up-{index+1}',month=folder,blockIndex=index,week=w,day=d,optional=any('Optional' in p for p in paths),sourceText='\n\n'.join(p['sourceText'] for p in ex),sources=paths,exercises=ex,conditionalSources=[p for p in paths if 'Supplement' in p],alternativePlans=[])
  if key=='July-W3D2':
   alt=up['July-W3D2-treadmill']
   for n,prescription in enumerate(alt):prescription['id']=f'{key}-treadmill-{n+1}'
   s['alternativePlans']=[dict(id='treadmill',name='跑步机替代整套场地计划（不是附加训练）',sources=s['conditionalSources'],exercises=alt)]
  if key=='August-W2D1':
   s['autoregulation']='none'
  if key=='August-W2D2':s['autoregulation']='none'
  if key=='August-W1D3':s['sourceConflict']='文件D3但原图标题第一周第四天；暂按文件排序，需确认。'
  if key=='August-W1D4':s['sourceConflict']='文件D4但原图标题第一周第五天；暂按文件排序，需确认。'
  sessions.append(s)
for definition in metadata:
 for phase in definition['phases']:
  phase['entrySessionIds']=[min((s for s in sessions if s['phaseId']==phase['id'] and s['week']==week),key=lambda s:s['day'])['id'] for week in range(1,5)]
  for session in sessions:
   if session['phaseId']==phase['id']:session['focus']=phase['weeklyFocus'][session['week']-1]
p=dict(version='lp-up-v2',sourceCommit='27a9ac924647066eba52f782edbea4e269fe20b8',definitions=metadata,sources=[e['path'] for e in entries],sessions=sorted(sessions,key=lambda s:(s['programId'],s['blockIndex'],s['week'],s['day'])))
pathlib.Path('src/program/catalog.json').write_text(json.dumps(p,ensure_ascii=False,indent=2))
pathlib.Path('src/program/source-manifest.json').write_text(json.dumps(dict(sourceCommit=p['sourceCommit'],entries=entries),ensure_ascii=False,indent=2))
print(len(entries),'images;',len(sessions),'sessions;',sum(len(s['exercises']) for s in sessions),'reviewed prescription blocks')
