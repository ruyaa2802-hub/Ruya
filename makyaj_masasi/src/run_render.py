import os, sys, time
from multiprocessing import Pool
import render
from timing import *

if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    total = int(DUR * FPS)
    chunk = 30
    jobs = [(a, min(total, a + chunk), outdir) for a in range(0, total, chunk)]
    t0 = time.time()
    done = 0
    with Pool(4, initializer=render.init) as p:
        for n in p.imap_unordered(render.save_range, jobs):
            done += n
            print(f'{done}/{total} {time.time()-t0:.0f}s', flush=True)
