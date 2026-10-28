import sys, glob
from PIL import Image
files = sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in files]
w = 360; h = 640
sheet = Image.new('RGB', (w * len(ims), h))
for i, im in enumerate(ims):
    sheet.paste(im.resize((w, h), Image.LANCZOS), (i * w, 0))
sheet.save(sys.argv[1])
