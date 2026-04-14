const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file));
    } else {
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = walkDir(path.join(__dirname, 'src', 'pages'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  content = content.replace(/<Grid\s+item\s+([^>]*?)>/g, (match, attrs) => {
    const extractors = ['xs', 'sm', 'md', 'lg', 'xl'];
    const sizeObj = {};
    let otherAttrs = attrs;
    
    extractors.forEach(bk => {
      const regex = new RegExp(`(?:^|\\s)${bk}={(\\d+)}`);
      const found = otherAttrs.match(regex);
      if (found) {
        sizeObj[bk] = parseInt(found[1], 10);
        otherAttrs = otherAttrs.replace(regex, '');
      }
    });

    if (Object.keys(sizeObj).length > 0) {
      const sizeStr = Object.entries(sizeObj).map(([k, v]) => `${k}: ${v}`).join(', ');
      return `<Grid size={{ ${sizeStr} }} ${otherAttrs.trim()}>`.replace(' >', '>');
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Fixed Grids in ${file}`);
  }
});
