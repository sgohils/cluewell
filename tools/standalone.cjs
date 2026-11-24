// Create a portable copy of the same app and synthetic example used by the site.
const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname, '..', 'dist');
const output = process.argv[2];
if (!output) throw new Error('Usage: node tools/standalone.cjs <output.html>');
const read = name => fs.readFileSync(path.join(dist, name), 'utf8');
const scripts = [];
const sample = fs.readFileSync(path.join(dist, 'sample-note.png')).toString('base64');
let html = read('index.html')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([\w.-]+\.css)"[^>]*>/g,
    (_, name) => '<style>\n' + read(name) + '\n</style>')
  .replace(/<script\b[^>]*src="([\w.-]+\.js)"[^>]*><\/script>/g, (_, name) => {
    scripts.push(read(name));
    return '';
  });
scripts.unshift('window.CLUEWELL_SAMPLE="data:image/png;base64,' + sample + '";');
const inline = scripts.map(code => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>').join('\n');
html = html.replace('</body>', () => inline + '\n</body>');
fs.writeFileSync(output, html);
