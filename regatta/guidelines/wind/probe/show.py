import json,sys;d=json.load(open(sys.argv[1]))
for v,r in d.items():
  print('=====',v,'spread',{k:round(x,1) for k,x in (r['spread'] or {}).items()});print(' live',r['live'])
  for L in r['legs']: print(' leg',L['li'],L['lenM'],'m',L['type'],'twa',L['twa'],'kt',L['mid']['kt'],'prof',[ (p['o'],p.get('kt'),p.get('ddeg')) for p in L['prof']],'\n    T',L['T'],L['lr'])
  for P in r['price']: print(' price',P['li'],P['type'],{k:(x['mean'],x['min'],x['max'],x['fail']) for k,x in P['res'].items()})
