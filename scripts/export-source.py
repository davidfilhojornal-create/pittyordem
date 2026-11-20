"""Generate the public source download without credentials, visitor data or recursion."""
from pathlib import Path
import json,zipfile
root=Path(__file__).resolve().parent.parent
archive=root/'public'/'codigo-fonte.zip'
folders=['db','drizzle','public','scripts','server','tests','worker']
files=['package.json','package-lock.json','drizzle.config.ts','.gitignore','README.md','LICENSE','THIRD_PARTY_NOTICES.md','wrangler.jsonc','PREPARAR-AUDIO.bat','musicas/LEIA-ME.txt','ATUALIZAR-CLOUDFLARE.md','DESEMPENHO.md']
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for name in folders:
  for p in sorted((root/name).rglob('*')):
   if p.is_file() and p!=archive and '__pycache__' not in p.parts and 'audio-assets' not in p.parts and p.suffix.lower() not in {'.mp3','.wav','.m4a','.aac','.ogg','.opus','.flac','.aiff'}:
    z.write(p,Path('pitty-na-sua-ordem')/p.relative_to(root))
 for name in files:
  p=root/name
  if p.is_file():z.write(p,Path('pitty-na-sua-ordem')/('wrangler.modelo.jsonc' if name=='wrangler.jsonc' else name))
 z.writestr('pitty-na-sua-ordem/.openai/hosting.json',json.dumps({'d1':'DB','r2':None},indent=2)+'\n')
print('Generated public source ZIP')
