import {readFile,writeFile,mkdir,rm,readdir,cp} from 'node:fs/promises';
import path from 'node:path';
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const files={};const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else files['/'+path.relative('public',p)]={type:types[path.extname(p)]||'application/octet-stream',data:(await readFile(p)).toString('base64')};}}
await walk('public');
await writeFile('dist/server/index.js','const STATIC_FILES='+JSON.stringify(files)+';\n'+await readFile('worker/index.js','utf8'));
await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built Worker + '+Object.keys(files).length+' assets');
