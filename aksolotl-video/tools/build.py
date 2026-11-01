import json,sys,os
sys.path.insert(0,os.path.dirname(__file__))
import world, axo
D=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cells,cdata=world.cells()
caps=[
 (0.0,1.9,"Şu sevimli tipe bak!"),
 (1.9,3.3,"Ama sakın küçümseme…"),
 (3.3,7.0,"Çünkü bu minik kahraman, kaybettiği bacaklarını yeniden oluşturabiliyor!"),
 (7.2,10.7,"Bir bacağını kaybettiğinde vücudu hemen harekete geçiyor!"),
 (10.7,14.2,"Hücreleri çoğalıyor, yeni dokular gelişiyor"),
 (14.2,17.0,"ve zamanla yepyeni bir bacak ortaya çıkıyor."),
 (17.4,21.6,"Bilim insanları bu özel hücre yapısına blastema diyor."),
 (21.6,26.9,"Bu yapı, yeni bacağın oluşması için gereken dokuların gelişmesine yardımcı oluyor."),
 (27.2,30.1,"Bir de inanılmaz başka bir özelliği var!"),
 (30.1,34.0,"Aksolotl yetişkin olsa bile larva döneminden kalan dış solungaçlarını koruyor."),
 (34.0,36.1,"Yani hayatı boyunca biraz yavru gibi görünüyor!"),
 (36.3,41.0,"Üstelik bu eşsiz canlı, yalnızca Meksika'nın Xochimilco bölgesinde doğal olarak yaşıyor"),
 (41.0,43.3,"ve nesli kritik derecede tehlike altında."),
 (43.3,45.4,"Doğanın bu minik mucizesini korumalıyız."),
 (45.5,47.0,"Sen böyle bir hayvan olduğunu biliyor muydun?"),
]
capshtml=''.join(f'<div id="cap{i}" class="cap{" last" if i==len(caps)-1 else ""}"><span>{t}</span></div>' for i,(a,b,t) in enumerate(caps))
cpos=[(462,742),(618,742),(500,700),(580,700),(540,676),(448,790),(632,790),(484,760),(596,760),(540,726),(430,740),(650,740),(520,650),(562,650),(470,672),(612,672)]
js=open(os.path.join(D,'tools/main.js')).read()
js=js.replace('%%CELLDATA%%',json.dumps(cdata)).replace('%%CPOS%%',json.dumps(cpos)).replace('%%CAPLIST%%',json.dumps([[a,b] for a,b,_ in caps]))
# eye wrapper .big
rig=axo.rig().replace('<g class="blink">','<g class="big"><g class="blink">').replace('</g></g>\'\'\'','</g></g>')
html=open(os.path.join(D,'tools/page.tpl.html')).read()
rig=axo.rig()
rig=rig.replace('<g class="blink">','<g class="big"><g class="blink">')
rig=rig.replace('</g>\n      </g></g>','</g>\n      </g></g></g>')
html=(html.replace('%%BG%%',world.bg()).replace('%%LENS%%',world.lens()).replace('%%AXO%%',rig)
  .replace('%%FG%%',world.fg()).replace('%%CELLS%%',cells).replace('%%SP%%',world.sparkles(15)).replace('%%CAPS%%',capshtml).replace('%%JS%%',js))
open(os.path.join(D,'index.html'),'w').write(html)
json.dump(caps,open(os.path.join(D,'tools/caps.json'),'w'),ensure_ascii=False)
print(len(html))
