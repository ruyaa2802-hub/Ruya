import json, sys, subprocess, os
MAP = {'f0VP180K0pzLuL5QQOtL': 'vid/V01.mp4', '2hmVZLbFKyZ2CUo7IFJU': 'vid/V02.mp4', 'Vc1QWe5Yfr4fAX4vJ5ON': 'vid/V03.mp4',
       'zwRRsJ5PHEkLb4zTjPQE': 'vid/V04.mp4', '4qBWHrIgeWehlk1q3a2z': 'vid/V05.mp4', '3jpgNUxNQ8UKSiorHEuq': 'vid/V06.mp4',
       'mXKINv0YoQ501FByKT7s': 'vid/V09.mp4', 'JLbeIYvbNYbvBdVfQR4D': 'vid/V11.mp4', 'FeNAhwJklmxQNf6fUegl': 'vid/V13.mp4',
       'R6Sf4nQMEvUCg3ocxqS0': 'vid/V16.mp4', 'Y74CVCDrioJulU3g7lyY': 'img/K12_yigin_obur_uc.png'}
d = json.load(open(sys.argv[1]))
st = {g['id']: g['status'] for g in d['generations']}
print('all_completed', d['all_completed'], 'failures', d['has_failures'])
for g in d['generations']:
    print(MAP.get(g['id'], g['id']), g['status'], g.get('error_message', '')[:120])
for m in d.get('media', []):
    p = MAP.get(m['generation_id'])
    if p and not os.path.exists(p):
        subprocess.run(['curl', '-sS', '-o', p, m.get('master_url') or m['url']])
        print('indirildi', p)
