const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, 'src/pages/MarketOverview.tsx'),
  path.join(__dirname, 'src/pages/ProTerminal.tsx'),
  path.join(__dirname, 'src/pages/TradeDesk.tsx'),
  path.join(__dirname, 'src/pages/DiscoveryFeed.tsx')
];

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Find all <Grid item xs={X} sm={Y}... > and convert
  content = content.replace(/<Grid\s+item\s+([^>]+)>/g, (match, attrs) => {
    // extract xs, sm, md, lg, xl
    let sizes = [];
    ['xs', 'sm', 'md', 'lg', 'xl'].forEach(size => {
      const regex = new RegExp(`\\s*${size}={(\\d+)}`);
      const m = attrs.match(regex);
      if (m) {
        sizes.push(`${size}: ${m[1]}`);
        attrs = attrs.replace(regex, '');
      }
    });
    
    if (sizes.length > 0) {
      return `<Grid size={{ ${sizes.join(', ')} }} ${attrs.trim()}>`.trim() + (match.endsWith('/>') ? ' />' : '>');
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Updated props in: ${path.basename(file)}`);
  }
});
