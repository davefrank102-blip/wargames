const fs=require('fs');const src=fs.readFileSync(__dirname+'/index.src.html','utf8');const core=fs.readFileSync(__dirname+'/core.js','utf8');
fs.writeFileSync(__dirname+'/index.html',src.replace('/*__CORE__*/',()=>core));console.log('built index.html',fs.statSync(__dirname+'/index.html').size,'bytes');
