// Dependency-free local preview. Only the application assets are exposed.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml'};
const port = Number(process.env.PORT || 4173);
const handler = async (req,res) => {
  const target = new URL(req.url,'http://localhost').pathname;
  const name = target === '/' ? 'index.html' : target.slice(1);
  const contentType = types[path.extname(name)];
  if (!['GET','HEAD'].includes(req.method) || !/^[a-zA-Z0-9_.-]+$/.test(name) || !contentType) {
    res.writeHead(404); res.end(); return;
  }
  try {
    const bytes = await fs.readFile(path.join(__dirname,'dist',name));
    res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404); res.end('File unavailable'); }
};
if (require.main === module) http.createServer(handler).listen(port,'127.0.0.1',() => console.log('Cluewell is running at http://127.0.0.1:' + port));
module.exports = handler;
