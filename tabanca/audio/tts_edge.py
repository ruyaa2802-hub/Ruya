"""Free Turkish narration via Microsoft Edge neural TTS (edge-tts).
The session's HTTPS proxy re-terminates TLS, so trust its CA bundle explicitly
(edge-tts pins certifi). Verification stays on."""
import asyncio, os, ssl, sys
import edge_tts.communicate as C

CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    C._SSL_CTX = ssl.create_default_context(cafile=CA)

async def main(voice, rate, pitch, src, out, srt):
    text = open(src, encoding='utf-8').read().strip()
    com = C.Communicate(text, voice, rate=rate, pitch=pitch, proxy=os.environ.get('HTTPS_PROXY'), boundary='WordBoundary')
    import edge_tts
    sub = edge_tts.SubMaker()
    with open(out, 'wb') as f:
        async for ch in com.stream():
            if ch['type'] == 'audio':
                f.write(ch['data'])
            elif ch['type'] in ('WordBoundary', 'SentenceBoundary'):
                sub.feed(ch)
    open(srt, 'w', encoding='utf-8').write(sub.get_srt())

asyncio.run(main(*sys.argv[1:7]))
