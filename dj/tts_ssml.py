"""Daha doğal Türkçe konuşma: cümle parçalarına bölünmüş SSML (tempo/perde/duraklama), metin aynen korunur."""
import asyncio, sys, re
import edge_tts
from edge_tts import communicate as _c
_c.escape = lambda s: s          # kendi SSML etiketlerimizi geçir
OUT = sys.argv[1]
DJ, EV = "tr-TR-AhmetNeural", "tr-TR-EmelNeural"
# (id, ses, taban perde, taban hız, taban ses, [(metin, hız, perde, sonraki duraklama ms)], orijinal)
L = [
 ("01-dj", DJ, "-8Hz", "-4%", "+0%", [("Hanımlar beyler,",-6,-2,380),("gece vardiyası başladı!",8,6,520),("İnsanlar uyusun,",-6,-6,260),("eğlence bize kaldı!",4,10,0)]),
 ("02-dj", DJ, "-8Hz", "-2%", "+0%", [("Bu gece mutfağın sahibi benim!",8,6,480),("Burası artık Michelin değil,",-2,-4,300),("DJ Hamam!",-8,10,0)]),
 ("03-ev", EV, "-10Hz", "-14%", "+8%", [("Oğlum,",-10,-6,260),("bu saatte ne oluyor?",-4,4,0)]),
 ("04-dj", DJ, "-12Hz", "-6%", "+0%", [("Abi sakin ol,",-8,-6,320),("after party yapıyoruz.",2,4,0)]),
 ("05-ev", EV, "+2Hz", "+2%", "+30%", [("Sen",-6,6,120),("kimsin?",-2,8,0)]),
 ("06-dj", DJ, "-12Hz", "-8%", "+0%", [("Mekânın işletmecisiyim.",-2,-2,420),("Sen kimsin?",-6,6,0)]),
 ("07-dj", DJ, "+4Hz", "+4%", "+16%", [("Güvenlik!",6,10,160),("Güvenlik!",8,12,160),("Mekân basıldı!",10,8,0)]),
 ("08-dj", DJ, "+0Hz", "+0%", "+0%", [("Abi",-4,6,80),("şiddete gerek yok,",6,4,200),("müziğin sesini kısarım!",8,10,0)]),
 ("09-dj", DJ, "-12Hz", "-8%", "+0%", [("Beyler…",-10,-6,600),("Yeni mekân bulduk.",-4,-2,420),("Soğuk ama müşterisi bol!",6,6,0)]),
 ("10-dj", DJ, "-8Hz", "+0%", "+0%", [("Bu arada,",-4,-2,200),("peyniri kim yemiş?",8,8,380),("Benim setin sponsoru oydu!",6,4,0)]),
]
def f(n,u): return f"{'+' if n>=0 else ''}{n}{u}"
def pct(base,d): return f(int(base.rstrip("%"))+d,"%")
def hz(base,d): return f(int(base.rstrip("Hz"))+d,"Hz")
async def main():
    import subprocess, os
    for lid,v,pitch,rate,vol,parts in L:
        files=[]; full=[]
        for i,(t,r,p,b) in enumerate(parts):
            fn=f"{OUT}/{lid}_{i}.mp3"
            await edge_tts.Communicate(t,v,rate=pct(rate,r+0),pitch=hz(pitch,p),volume=vol).save(fn)
            files.append((fn,int(b*0.7))); full.append(t)
        print(lid,"|"," ".join(full))
        # parçaları duraklamalarla birleştir
        inputs=[];flt=[];n=0
        for fn,b in files:
            inputs+=["-i",fn]
        parts_f="";labels=""
        for i,(fn,b) in enumerate(files):
            parts_f+=f"[{i}:a]silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.02,areverse,aresample=44100,aformat=channel_layouts=mono[a{i}];"
            labels+=f"[a{i}]"
            if b:
                parts_f+=f"anullsrc=r=44100:cl=mono,atrim=0:{b/1000}[s{i}];"; labels+=f"[s{i}]"
        cnt=len(files)+sum(1 for _,b in files if b)
        subprocess.run(["ffmpeg","-nostdin","-v","error","-y",*inputs,"-filter_complex",parts_f+labels+f"concat=n={cnt}:v=0:a=1[o]","-map","[o]",f"{OUT}/{lid}.mp3"],check=True)
asyncio.run(main())
