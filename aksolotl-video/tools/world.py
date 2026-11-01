import math
W,H=1080,1920

def coral(x,y,col,length,ang=-90,depth=0,sw=20,out=None):
    if out is None: out=[]
    if depth>3 or length<18: return out
    a=math.radians(ang); x2=x+math.cos(a)*length; y2=y+math.sin(a)*length
    out.append(f'<path d="M{x:.0f} {y:.0f} L{x2:.0f} {y2:.0f}" stroke="{col}" stroke-width="{sw}" stroke-linecap="round"/>')
    if depth==3: out.append(f'<circle cx="{x2:.0f}" cy="{y2:.0f}" r="{sw*.8:.0f}" fill="{col}"/>')
    for da,f in ((-32,.72),(30,.7),(0 if depth<1 else 8,.55)):
        coral(x2,y2,col,length*f,ang+da,depth+1,max(sw*.72,6),out)
    return out

def fan(x,y,col,r):
    s=''
    for i in range(-5,6):
        a=math.radians(-90+i*14)
        s+=f'<path d="M{x} {y} L{x+math.cos(a)*r:.0f} {y+math.sin(a)*r:.0f}" stroke="{col}" stroke-width="7" stroke-linecap="round"/>'
    s+=f'<path d="M{x-r*.95:.0f} {y-r*.55:.0f} Q{x} {y-r*1.25:.0f} {x+r*.95:.0f} {y-r*.55:.0f}" stroke="{col}" stroke-width="9" fill="none" stroke-linecap="round"/>'
    return s

def kelp(i,x,h,col,sw,sway=1):
    pts=f"M{x} 1800 C{x-60} {1800-h*.3} {x+60} {1800-h*.6} {x} {1800-h}"
    s=f'<g id="kelp{i}"><path d="{pts}" stroke="{col}" stroke-width="{sw}" stroke-linecap="round" fill="none"/>'
    for k,t in enumerate((.3,.5,.7,.88)):
        yy=1800-h*t; xx=x+(-1)**k*20
        s+=f'<ellipse cx="{xx+(-1)**k*42:.0f}" cy="{yy:.0f}" rx="50" ry="17" transform="rotate({(-1)**k*-28} {xx:.0f} {yy:.0f})" fill="{col}" opacity=".9"/>'
    return s+'</g>'

def fish(fid,col,col2,sz=1):
    return f'''<g id="{fid}"><path d="M-70 0 L-112 -34 L-112 34 Z" fill="{col2}"/><ellipse cx="0" cy="0" rx="70" ry="38" fill="{col}"/>
      <path d="M-10 -34 Q20 -70 40 -30 Z" fill="{col2}"/><path d="M-20 0 Q10 -26 30 0" stroke="#fff" stroke-opacity=".4" stroke-width="6" fill="none"/>
      <circle cx="40" cy="-8" r="11" fill="#fff"/><circle cx="43" cy="-8" r="6" fill="#16213e"/></g>'''

def bg():
    s=f'<svg id="bgSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
    s+='''<defs>
    <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86f2e6"/><stop offset=".38" stop-color="#2fb5dc"/><stop offset=".78" stop-color="#1c63b4"/><stop offset="1" stop-color="#143f88"/></linearGradient>
    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8e0ae"/><stop offset="1" stop-color="#dfae72"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>'''
    s+=f'<rect width="{W}" height="{H}" fill="url(#wg)"/><rect width="{W}" height="900" fill="url(#glow)"/>'
    s+='<g id="rays">'
    for i,(x,w) in enumerate([(60,150),(300,110),(520,180),(760,120),(940,140)]):
        s+=f'<path d="M{x} -20 L{x+w} -20 L{x+w+230} 1700 L{x-70} 1700 Z" fill="#fff" opacity="{.10+.03*(i%3)}"/>'
    s+='</g>'
    # far layer
    s+='<g id="farL" opacity=".45">'
    for i,(x,h) in enumerate([(70,520),(250,380),(470,620),(700,420),(900,560),(1030,360)]):
        s+=f'<path d="M{x} 1760 C{x-50} {1760-h*.4} {x+50} {1760-h*.7} {x} {1760-h}" stroke="#2a8fc0" stroke-width="30" stroke-linecap="round" fill="none"/>'
    s+='</g>'
    # adult silhouette
    s+='<g id="adult" opacity="0" fill="#0e4f86"><ellipse cx="540" cy="760" rx="150" ry="110"/><ellipse cx="540" cy="900" rx="110" ry="150"/><path d="M640 960 C760 1010 840 960 900 980 C860 930 760 920 650 900Z"/>'
    for sx in (-1,1):
        for a in (-35,-5,25):
            r=math.radians(a if sx>0 else 180-a)
            s+=f'<path d="M{540+sx*130} 750 L{540+sx*130+math.cos(r)*150:.0f} {750+math.sin(r)*150:.0f}" stroke="#0e4f86" stroke-width="14" stroke-linecap="round"/>'
    s+='</g>'
    # fish
    for fid,c,c2 in [("fishA","#ffb347","#ff7e5f"),("fishB","#c77dff","#7f5af0"),("fishC","#ffd93d","#ff9f1c"),("fishD","#6ee7b7","#10b981")]:
        s+=f'<g id="{fid}w" transform="translate(-300 600) scale(.55)">{fish(fid,c,c2)}</g>'
    # corals
    s+='<g id="corals">'
    for x,col,L in [(90,"#ff7f7f",190),(330,"#ffb347",150),(610,"#c77dff",210),(860,"#ff6fa5",170),(1010,"#ff9f6e",150)]:
        s+='<g>'+''.join(coral(x,1790,col,L))+'</g>'
    s+=fan(190,1790,"#ff5d8f",150)+fan(740,1790,"#ffd166",130)
    s+='<g><circle cx="470" cy="1780" r="92" fill="#ff8fab"/><path d="M400 1770 q20 -25 40 0 t40 0 t40 0 M410 1805 q20 -25 40 0 t40 0 t30 0" stroke="#e05780" stroke-width="7" fill="none" stroke-linecap="round"/></g>'
    s+='</g>'
    # kelp
    s+='<g id="plants">'
    for i,(x,h,c,sw) in enumerate([(20,880,"#1fbf8f",34),(160,640,"#27d69d",30),(420,780,"#18a77e",34),(560,560,"#2fe0a8",28),(700,860,"#1fbf8f",34),(880,600,"#23c999",30),(1040,820,"#17a07a",36)]):
        s+=kelp(i,x,h,c,sw)
    s+='</g>'
    s+=f'<path d="M0 1750 Q180 1700 360 1745 T720 1740 T1080 1730 L1080 1920 L0 1920 Z" fill="url(#sg)"/>'
    for x,y,r in [(130,1830,26),(420,1860,18),(760,1820,30),(980,1870,20)]:
        s+=f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r*.7:.0f}" fill="#cfa66a" opacity=".6"/>'
    s+='</svg>'
    return s

def fg(nb=34):
    s=f'<svg id="fgSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
    s+='<g id="nearL"><path id="leafL" d="M-40 1920 C-20 1500 60 1250 150 1100 C130 1300 190 1600 230 1920 Z" fill="#0f7d6a"/><path id="leafL2" d="M40 1920 C60 1650 40 1500 -10 1380 C110 1480 170 1700 150 1920Z" fill="#12997c" opacity=".9"/>'
    s+='<path id="leafR" d="M1120 1920 C1090 1540 1000 1300 930 1120 C940 1330 880 1640 850 1920 Z" fill="#0f7d6a"/><path id="leafR2" d="M1040 1920 C1030 1700 1060 1520 1100 1400 C990 1500 920 1700 930 1920Z" fill="#12997c" opacity=".9"/></g>'
    s+='<g id="bubbles">'
    for i in range(nb):
        r=6+(i*7)%19; x=40+(i*173)%1000
        s+=f'<g id="bub{i}" transform="translate({x} 2000)"><circle r="{r}" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".75" stroke-width="2.5"/><circle cx="{-r*.35:.1f}" cy="{-r*.35:.1f}" r="{max(r*.22,2):.1f}" fill="#fff" fill-opacity=".9"/></g>'
    s+='</g></svg>'
    return s

def star(i):
    return f'<g id="sp{i}" opacity="0"><path d="M0 -46 L10 -10 L46 0 L10 10 L0 46 L-10 10 L-46 0 L-10 -10 Z" fill="#fff6c2" stroke="#ffd23f" stroke-width="4" stroke-linejoin="round"/><circle r="6" fill="#fff"/></g>'

def sparkles(n=14):
    return f'<svg id="spSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'+''.join(star(i) for i in range(n))+'</svg>'

SKIN="#ffb0c8"; SKIN_D="#e8789c"
def lens():
    s=f'<svg id="lensSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
    s+='''<defs><clipPath id="lensClip"><circle cx="540" cy="610" r="380"/></clipPath>
    <radialGradient id="lensBg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#2a92b5"/><stop offset="1" stop-color="#0a3a60"/></radialGradient>
    <radialGradient id="budG" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#fff0a8"/><stop offset=".6" stop-color="#ffc06b"/><stop offset="1" stop-color="#ff8fab"/></radialGradient>
    <radialGradient id="lSkin" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="#ffd7e5"/><stop offset=".6" stop-color="#ffb0c8"/><stop offset="1" stop-color="#f58bb0"/></radialGradient></defs>'''
    s+='<g id="lensG" opacity="0">'
    s+='<circle cx="540" cy="610" r="392" fill="#0a3a60" opacity=".35"/>'
    s+='<g clip-path="url(#lensClip)"><rect x="140" y="220" width="800" height="780" fill="url(#lensBg)"/>'
    for i in range(14):
        s+=f'<circle cx="{190+(i*131)%700}" cy="{260+(i*97)%500}" r="{4+i%4*2}" fill="#fff" opacity=".18"/>'
    s+=f'<ellipse cx="540" cy="1150" rx="560" ry="350" fill="url(#lSkin)" stroke="{SKIN_D}" stroke-width="8"/>'
    # stub
    s+=f'<g id="lStub"><ellipse cx="540" cy="808" rx="92" ry="48" fill="url(#lSkin)" stroke="{SKIN_D}" stroke-width="8"/></g>'
    s+='<g id="lBud" opacity="0"><ellipse id="budGlow" cx="540" cy="770" rx="130" ry="150" fill="#fff0a8" opacity=".35"/><ellipse id="budBody" cx="540" cy="775" rx="72" ry="92" fill="url(#budG)" stroke="#ff9f6e" stroke-width="7"/></g>'
    # limb
    shapes=[('line',540,812,540,575,104),]
    def limb_shapes(stroke_extra=0,fill=None,stroke=None,sw=0):
        t=''
        att=f'fill="{fill}"' if fill else 'fill="none"'
        if stroke: att+=f' stroke="{stroke}" stroke-width="{sw}"'
        t+=f'<path d="M540 812 L540 575" stroke="{stroke or fill}" stroke-width="{104+stroke_extra}" stroke-linecap="round" fill="none"/>'
        t+=f'<ellipse cx="540" cy="520" rx="{86+stroke_extra/2}" ry="{54+stroke_extra/2}" {att}/>'
        for x,y,rot in [(474,470,-20),(512,445,-6),(568,445,6),(606,470,20)]:
            t+=f'<ellipse cx="{x}" cy="{y}" rx="{19+stroke_extra/2}" ry="{38+stroke_extra/2}" transform="rotate({rot} {x} {y})" {att}/>'
        return t
    s+='<g id="lLimb" opacity="0">'
    s+='<g id="limbOutline">'+limb_shapes(16,fill=SKIN_D)+'</g>'
    s+='<g id="limbSkin">'+limb_shapes(0,fill="url(#lSkin)")+'</g>'
    s+='<g id="tBone" opacity="0">'
    s+='<path d="M540 806 L540 610" stroke="#d9c08b" stroke-width="34" stroke-linecap="round"/><path d="M540 806 L540 610" stroke="#fff3d6" stroke-width="26" stroke-linecap="round"/>'
    for x in (526,554): s+=f'<path d="M{x} 600 L{x} 530" stroke="#d9c08b" stroke-width="20" stroke-linecap="round"/><path d="M{x} 600 L{x} 530" stroke="#fff3d6" stroke-width="13" stroke-linecap="round"/>'
    for x,y,rot in [(474,470,-20),(512,445,-6),(568,445,6),(606,470,20)]:
        s+=f'<ellipse cx="{x}" cy="{y+4}" rx="8" ry="30" transform="rotate({rot} {x} {y})" fill="#fff3d6" stroke="#d9c08b" stroke-width="4"/>'
    s+='<circle cx="540" cy="806" r="22" fill="#fff3d6" stroke="#d9c08b" stroke-width="4"/></g>'
    s+='<g id="tMuscle" opacity="0"><ellipse cx="540" cy="724" rx="46" ry="84" fill="#ff6b6b" opacity=".85"/><ellipse cx="540" cy="596" rx="40" ry="52" fill="#ff8585" opacity=".85"/><path d="M510 650 Q540 700 570 650" stroke="#c94444" stroke-width="5" fill="none" opacity=".6"/><path d="M505 740 Q540 790 575 740" stroke="#c94444" stroke-width="5" fill="none" opacity=".6"/></g>'
    s+='<g id="tNerve" opacity="0"><path d="M548 808 C575 740 515 690 548 620 C565 585 520 560 512 520 M548 620 C575 570 590 530 606 478 M548 620 C548 560 560 500 568 452 M548 620 C530 560 500 520 474 470" stroke="#ffd23f" stroke-width="7" stroke-linecap="round" fill="none"/>'
    for x,y in [(512,520),(606,478),(568,452),(474,470)]: s+=f'<circle cx="{x}" cy="{y}" r="10" fill="#fff6a0" stroke="#ffd23f" stroke-width="4"/>'
    s+='</g></g>'
    # cells
    s+='<g id="lCells">'
    cpos=[(462,742),(618,742),(500,700),(580,700),(540,676),(448,790),(632,790),(484,760),(596,760),(540,726),(430,740),(650,740),(520,650),(562,650),(470,672),(612,672)]
    for i,(x,y) in enumerate(cpos):
        s+=f'<g id="lc{i}" opacity="0"><circle cx="{x}" cy="{y}" r="17" fill="#d8c8ff" stroke="#8f73e6" stroke-width="4"/><circle cx="{x-3}" cy="{y-2}" r="6.5" fill="#7a5ad8"/><circle cx="{x-9}" cy="{y-9}" r="3.5" fill="#fff" opacity=".85"/></g>'
    s+='</g>'
    # plaster
    s+='<g id="lPlaster" opacity="0"><rect x="450" y="772" width="180" height="52" rx="26" transform="rotate(-10 540 798)" fill="#f6d9ab" stroke="#d2a96a" stroke-width="5"/><rect x="505" y="780" width="70" height="36" rx="6" transform="rotate(-10 540 798)" fill="#fff3d8" stroke="#e8c88c" stroke-width="3"/><circle cx="478" cy="802" r="3" fill="#d2a96a"/><circle cx="602" cy="794" r="3" fill="#d2a96a"/></g>'
    s+='</g>'  # end clip
    s+='<circle cx="540" cy="610" r="384" fill="none" stroke="#fff" stroke-width="16" opacity=".95"/><circle cx="540" cy="610" r="394" fill="none" stroke="#7ff0e8" stroke-width="7"/>'
    s+='<path d="M300 380 A330 330 0 0 1 430 290" stroke="#fff" stroke-width="12" stroke-linecap="round" fill="none" opacity=".55"/>'
    # tissue leader labels
    for k,(txt,x,y,lx,ly,col) in enumerate([("KEMİK",700,640,578,640,"#fff3d6"),("KAS",720,740,586,730,"#ff8585"),("SİNİR",260,610,512,610,"#ffd23f"),("DERİ",256,760,466,768,"#ffb0c8")]):
        anchor="start" if x>540 else "end"
        s+=f'<g id="lab{k}" opacity="0"><path d="M{lx} {ly} L{x+(-10 if x>540 else 10)} {y-8}" stroke="{col}" stroke-width="5" stroke-linecap="round"/><circle cx="{lx}" cy="{ly}" r="8" fill="{col}"/><text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Arial,sans-serif" font-weight="900" font-size="38" fill="{col}" stroke="#0a3a60" stroke-width="7" paint-order="stroke">{txt}</text></g>'
    s+='</g></svg>'
    return s

def cells():
    # 35 cells: positions in dome + targets in limb column
    cl=[]
    rows=[(1020,8),(972,7),(926,6),(880,5),(834,4),(788,3),(742,2)]
    for y,n in rows:
        for j in range(n):
            cl.append((540+(j-(n-1)/2)*50, y))
    cl.sort(key=lambda p:(p[0]-540)**2+(p[1]-960)**2*1.4)
    targets=[]; kinds=[]
    colsx=[-104,-52,0,52,104]
    for r in range(7):
        for c in range(5):
            targets.append((540+colsx[c], 700+r*95))
    # kinds
    def kind(r,c):
        if c in (0,4): return 'skin'
        if c==2: return 'bone'
        if (c==1 and r in (1,3,5)) or (c==3 and r in (2,4,6)): return 'nerve'
        return 'muscle'
    kk=[kind(r,c) for r in range(7) for c in range(5)]
    import random
    rnd=random.Random(7)
    order=list(range(35)); rnd.shuffle(order)   # which cluster cell goes to which target (deterministic)
    s=f'<svg id="cellSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
    s+='''<defs><radialGradient id="cellBg" cx="50%" cy="48%" r="75%"><stop offset="0" stop-color="#4a34b0"/><stop offset=".55" stop-color="#1f2a7a"/><stop offset="1" stop-color="#091a3d"/></radialGradient>
    <mask id="cellMask"><rect width="1080" height="1920" fill="#000"/><circle id="maskC" cx="540" cy="610" r="0" fill="#fff"/></mask></defs>
    <g mask="url(#cellMask)"><g id="cellWorld"><rect x="-300" y="-300" width="1680" height="2520" fill="url(#cellBg)"/>'''
    # bg big soft cells
    for i in range(12):
        x=(i*257)%1100; y=(i*389)%1950; r=70+(i*37)%90
        s+=f'<g class="bgc"><circle cx="{x}" cy="{y}" r="{r}" fill="#9a86ff" fill-opacity=".10" stroke="#c9bbff" stroke-opacity=".28" stroke-width="5"/><circle cx="{x+r*.2:.0f}" cy="{y-r*.1:.0f}" r="{r*.38:.0f}" fill="#7a5ad8" fill-opacity=".16"/></g>'
    for i in range(70):
        s+=f'<circle class="dust" cx="{(i*151)%1080}" cy="{(i*233)%1920}" r="{2+i%4}" fill="#cfe9ff" opacity=".35"/>'
    s+='<g id="ring"><circle cx="540" cy="900" r="260" fill="none" stroke="#ffe08a" stroke-width="6" opacity="0"/><circle id="ringB" cx="540" cy="900" r="260" fill="#ffe08a" opacity="0"/></g>'
    s+='<path id="nerveLine" d="M540 690 C560 800 520 900 548 1000 C570 1100 520 1180 540 1290" stroke="#ffd23f" stroke-width="7" stroke-linecap="round" fill="none" opacity="0"/>'
    for i,(x,y) in enumerate(cl):
        s+=(f'<g id="cc{i}" opacity="0"><circle r="30" fill="#c8b5ff" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>'
            f'<circle cx="-4" cy="2" r="11" fill="#6f4fd0" opacity=".85"/><circle cx="-11" cy="-12" r="5" fill="#fff" opacity=".8"/></g>')
    s+='</g></g></svg>'
    data={"pos":cl,"tgt":[targets[order.index(i)] for i in range(35)],"kind":[kk[order.index(i)] for i in range(35)]}
    return s,data
