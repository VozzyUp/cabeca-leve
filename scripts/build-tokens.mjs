// Gera app/tokens.css a partir de replica/design/tokens.json.
// O /replica-brand troca só os valores no JSON; rode `npm run tokens` depois.
import fs from 'node:fs';

const tokens = JSON.parse(fs.readFileSync('replica/design/tokens.json', 'utf8'));
const vars = (colors) =>
  Object.entries(colors).map(([name, value]) => `  --c-${name}: ${value};`).join('\n');

const shadows = (s) => `  --shadow-card-v: ${s.card};\n  --shadow-pop-v: ${s.pop};`;

const css = `/* Gerado por scripts/build-tokens.mjs a partir de replica/design/tokens.json. Não editar à mão. */
:root {
  color-scheme: dark;
${vars(tokens.color)}
${shadows(tokens.shadow)}
}

[data-theme='light'] {
  color-scheme: light;
${vars(tokens.themes.light)}
${shadows(tokens.shadow_light)}
}
`;
fs.writeFileSync('app/tokens.css', css);
console.log(`app/tokens.css: ${Object.keys(tokens.color).length} cores, temas escuro e claro`);
