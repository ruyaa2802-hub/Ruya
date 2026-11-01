import math
PINK="#ffb0c8"; PINK_D="#e8789c"; GILL="#ff5c93"; GILL_L="#ff86ad"; TIP="#ffc9dc"

def gill(gid,bx,by,ang,length,bend=1):
    a=math.radians(ang); dx,dy=math.cos(a),math.sin(a); nx,ny=-dy,dx
    tx,ty=bx+dx*length,by+dy*length
    cx,cy=bx+dx*length*.5+nx*length*.16*bend, by+dy*length*.5+ny*length*.16*bend
    def P(t): return ((1-t)**2*bx+2*(1-t)*t*cx+t*t*tx,(1-t)**2*by+2*(1-t)*t*cy+t*t*ty)
    def T(t):
        x=2*(1-t)*(cx-bx)+2*t*(tx-cx); y=2*(1-t)*(cy-by)+2*t*(ty-cy); l=math.hypot(x,y); return x/l,y/l
    s=f'<g id="{gid}">'
    for i,t in enumerate([.3,.48,.64,.8,.93]):
        px,py=P(t); ux,uy=T(t); L=62*(1-t*.45)
        for sgn in (1,-1):
            r=math.radians(52*sgn); vx=ux*math.cos(r)-uy*math.sin(r); vy=ux*math.sin(r)+uy*math.cos(r)
            ex,ey=px+vx*L,py+vy*L
            s+=f'<path d="M{px:.1f} {py:.1f} L{ex:.1f} {ey:.1f}" stroke="{GILL_L}" stroke-width="8" stroke-linecap="round" fill="none"/>'
            s+=f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="5.5" fill="{TIP}"/>'
    s+=f'<path d="M{bx} {by} Q{cx:.1f} {cy:.1f} {tx:.1f} {ty:.1f}" stroke="{GILL}" stroke-width="15" stroke-linecap="round" fill="none"/>'
    s+=f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="9" fill="{TIP}"/></g>'
    return s

def arm(gid,sx,sy,flip):
    f=-1 if flip else 1
    # shoulder (sx,sy); arm points down/out; hand with 4 fingers
    s=f'<g id="{gid}">'
    s+=f'<path d="M{sx} {sy} C{sx+f*40} {sy+20} {sx+f*70} {sy+60} {sx+f*70} {sy+105}" stroke="{PINK_D}" stroke-width="52" stroke-linecap="round" fill="none"/>'
    s+=f'<path d="M{sx} {sy} C{sx+f*40} {sy+20} {sx+f*70} {sy+60} {sx+f*70} {sy+105}" stroke="url(#axBody)" stroke-width="44" stroke-linecap="round" fill="none"/>'
    hx,hy=sx+f*70,sy+112
    for i,off in enumerate([-24,-8,8,24]):
        s+=f'<ellipse cx="{hx+off*f*-1*-1:.1f}" cy="{hy+26-abs(off)*.2:.1f}" rx="10" ry="20" fill="{PINK}" stroke="{PINK_D}" stroke-width="4"/>'
    s+=f'<ellipse cx="{hx}" cy="{hy+4}" rx="34" ry="26" fill="url(#axBody)" stroke="{PINK_D}" stroke-width="4"/>'
    s+='</g>'
    return s

def leg(gid,cx,cy,flip):
    f=-1 if flip else 1
    s=f'<g id="{gid}">'
    s+=f'<ellipse cx="{cx}" cy="{cy}" rx="52" ry="36" transform="rotate({f*-18} {cx} {cy})" fill="url(#axBody)" stroke="{PINK_D}" stroke-width="5"/>'
    for off in (-26,-9,9,26):
        s+=f'<ellipse cx="{cx+f*(34)+off*.2:.1f}" cy="{cy+30+off*.5*f:.1f}" rx="10" ry="15" fill="{PINK}" stroke="{PINK_D}" stroke-width="4"/>'
    s+='</g>'
    return s

def eye(gid,cx,cy):
    return f'''<g id="{gid}" transform="translate({cx} {cy})"><g class="blink">
      <circle r="56" fill="#2b1646"/><circle r="56" fill="url(#axEye)"/>
      <g class="pupil"><circle r="40" fill="#120620"/><circle cx="-16" cy="-18" r="18" fill="#fff"/><circle cx="17" cy="16" r="8" fill="#fff" opacity=".9"/><circle cx="-2" cy="30" r="4" fill="#9fe4ff" opacity=".8"/></g>
      </g></g>'''

def rig(prefix=""):
    defs=f'''<defs>
    <radialGradient id="axBody" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffd5e3"/><stop offset=".55" stop-color="{PINK}"/><stop offset="1" stop-color="#f58bb0"/></radialGradient>
    <radialGradient id="axBelly" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#fff0f5"/><stop offset="1" stop-color="#ffd0df"/></radialGradient>
    <radialGradient id="axEye" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#6a3fa8" stop-opacity=".9"/><stop offset="1" stop-color="#1c0b33" stop-opacity="0"/></radialGradient>
    <linearGradient id="axTail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffb0c8"/><stop offset="1" stop-color="#ff8fb4"/></linearGradient>
    </defs>'''
    tail=f'''<g id="axTail"><path d="M370 650 C330 770 440 830 560 800 C650 778 700 720 760 735 C740 690 690 670 630 690 C560 712 480 700 450 640 Z" fill="url(#axTail)" stroke="{PINK_D}" stroke-width="6" stroke-linejoin="round"/>
      <path d="M470 700 C540 715 620 700 690 690 C640 700 560 735 470 715Z" fill="#ff7ea8" opacity=".35"/>
      <path d="M520 788 C600 780 680 745 750 740 C720 765 640 805 540 815Z" fill="#ff8fb4" opacity=".55"/></g>'''
    body=f'''<g id="axBody"><ellipse cx="400" cy="570" rx="158" ry="175" fill="url(#axBody)" stroke="{PINK_D}" stroke-width="6"/>
      <ellipse cx="400" cy="600" rx="102" ry="128" fill="url(#axBelly)" opacity=".95"/>
      <circle cx="330" cy="520" r="7" fill="#ff93b3" opacity=".7"/><circle cx="470" cy="545" r="6" fill="#ff93b3" opacity=".7"/><circle cx="352" cy="640" r="5" fill="#ff93b3" opacity=".6"/></g>'''
    gillsL=gill("axGillL1",215,300,218,150)+gill("axGillL2",196,352,188,170)+gill("axGillL3",212,408,158,140,-1)
    gillsR=gill("axGillR1",585,300,-38,150,-1)+gill("axGillR2",604,352,-8,170,-1)+gill("axGillR3",588,408,22,140,1)
    head=f'''<g id="axHeadAll">
      <g id="axGills">{gillsL}{gillsR}</g>
      <path d="M170 365 C170 232 275 188 400 188 C525 188 630 232 630 365 C630 468 525 530 400 530 C275 530 170 468 170 365 Z" fill="url(#axBody)" stroke="{PINK_D}" stroke-width="6"/>
      <ellipse cx="300" cy="248" rx="88" ry="38" fill="#fff" opacity=".28" transform="rotate(-14 300 248)"/>
      <ellipse cx="245" cy="425" rx="42" ry="30" fill="#ff7fa3" opacity=".55"/><ellipse cx="555" cy="425" rx="42" ry="30" fill="#ff7fa3" opacity=".55"/>
      {eye("axEyeL",300,335)}{eye("axEyeR",500,335)}
      <circle cx="388" cy="408" r="4.5" fill="{PINK_D}"/><circle cx="412" cy="408" r="4.5" fill="{PINK_D}"/>
      <path id="axSmile" d="M318 440 Q400 505 482 440" stroke="#c4476f" stroke-width="8" stroke-linecap="round" fill="none"/>
      <path d="M308 436 Q300 430 296 422 M492 436 Q500 430 504 422" stroke="#c4476f" stroke-width="6" stroke-linecap="round" fill="none"/>
      <g id="axMouthOpen" opacity="0"><path d="M330 440 Q400 540 470 440 Q400 462 330 440Z" fill="#b23a63" stroke="#c4476f" stroke-width="6" stroke-linejoin="round"/><ellipse cx="400" cy="486" rx="34" ry="16" fill="#ff7a9c"/></g>
    </g>'''
    arms=arm("axArmL",262,560,True)+arm("axArmR",538,560,False)
    legs=leg("axLegL",248,712,True)+leg("axLegR",552,712,False)
    return f'<svg id="axSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 880" width="800" height="880">{defs}<g id="axRoot">{tail}{legs}{body}{arms}{head}</g></svg>'
if __name__=="__main__":
    open("/home/user/Ruya/aksolotl-video/characters/aksolotl.svg","w").write(rig())
