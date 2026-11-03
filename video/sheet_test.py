import time, sys
from PIL import Image
import gfx
t=time.time()
cfg = {"tabak":("open",(0,0),"smile","neutral"),"fincan":("wide",(0,0),"wide","worried"),
       "cayd":("smug",(0.3,0.2),"smirk","smug"),"pot1":("open",(0,0),"mid","up"),
       "pot2":("open",(0,0),"smile","neutral"),"pot3":("blink",(0,0),"a","neutral"),
       "kazan":("angry",(0.4,0.3),"grumble","angry")}
imgs={}
for k,fn in gfx.CHAR_BUILDERS.items():
    c=fn(); e,p,m,b=cfg[k]
    f=gfx.face_layer(c['face'], c['img'].width/gfx.K, c['img'].height/gfx.K, e,p,m,b)
    im=c['img'].copy(); im.alpha_composite(f); imgs[k]=im
    print(k, im.size, round(time.time()-t,1))

sheet=Image.new('RGBA',(1500,760),(190,150,110,255))
pos={"tabak":(10,10),"fincan":(330,40),"cayd":(700,40),"pot1":(1060,100),"pot2":(1260,140),"pot3":(1400,170),"kazan":(40,400)}
for k,im in imgs.items():
    s=im.resize((im.width*2//3, im.height*2//3), Image.LANCZOS) if k not in ("kazan",) else im
    sheet.alpha_composite(s,pos[k])
sheet.convert('RGB').save('build/sheet.png')
