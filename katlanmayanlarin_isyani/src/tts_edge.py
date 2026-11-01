import sys, asyncio, certifi
certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
import edge_tts
async def main(voice, text, out, rate='+0%', pitch='+0Hz'):
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    await c.save(out)
asyncio.run(main(*sys.argv[1:]))
