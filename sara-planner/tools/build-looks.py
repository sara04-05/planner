#!/usr/bin/env python3
"""Builds assets/looks.json and assets/looks.css from the palette list below. Run it after changing a palette:  python3 tools/build-looks.py

Every look gives 11 colours for light and for dark:
bg paper paper-2 ink muted line accent soft on tab1 tab2 tab3
The first one (graphite) is the site's own look; the others are the looks people can pick."""
import json, pathlib

K = ['bg', 'paper', 'paper2', 'ink', 'muted', 'line', 'accent', 'soft', 'on', 't1', 't2', 't3']

# slug, name, group, mood, light, dark
LOOKS = [
 ('graphite', 'Graphite', 'main', 'White, gray and black with soft depth.',
  ['#E3E4E7', '#F5F5F7', '#EBECEE', '#121316', '#5E6168', '#CDD0D5', '#26282D', '#E0E1E5', '#FFFFFF', '#DCDDE1', '#D2D3D8', '#C8CACF'],
  ['#141517', '#222326', '#2B2C30', '#EDEEF0', '#A0A3AA', '#393A3F', '#E9EAED', '#35363B', '#121316', '#2E2F33', '#323337', '#37383D']),
 ('harbor', 'Harbor', 'unisex', 'Slate blue. Calm and trustworthy.',
  ['#E3E8EE', '#F7F9FB', '#EDF1F5', '#1B2430', '#5B6776', '#CBD3DD', '#476A92', '#DCE5EF', '#FFFFFF', '#D5DEE9', '#C9D5E3', '#BDCCDD'],
  ['#151B23', '#1E2630', '#27303C', '#E8EDF3', '#98A5B5', '#303B49', '#8FB0D6', '#2A3646', '#12202F', '#27323F', '#2C3847', '#31404F']),
 ('lagoon', 'Lagoon', 'unisex', 'Deep teal. Fresh without being sweet.',
  ['#E1EBEA', '#F6FAF9', '#ECF3F2', '#14262A', '#566D70', '#C5D6D5', '#1F7A7A', '#D6E8E7', '#FFFFFF', '#CFE2E1', '#C1D9D8', '#B3D0CF'],
  ['#121C1D', '#1A2627', '#223132', '#E4F0EF', '#93AEAD', '#2B3E3F', '#5FBDB8', '#213536', '#0E2321', '#213233', '#263B3C', '#2B4344']),
 ('fern', 'Fern', 'unisex', 'Sage green. Quiet and natural.',
  ['#E6EAE3', '#F7F9F5', '#EEF2EB', '#1E261F', '#5F6B60', '#CDD5C9', '#5F8265', '#DEE7DB', '#FFFFFF', '#D8E1D4', '#CBD7C6', '#BECDB8'],
  ['#161B16', '#1F261F', '#283128', '#E9EFE7', '#9AA89A', '#313C31', '#94BC9B', '#2A362B', '#112014', '#273127', '#2D392D', '#334234']),
 ('anchor', 'Anchor', 'unisex', 'Navy. Classic and sharp.',
  ['#E2E5EA', '#F6F7F9', '#ECEEF2', '#141B2B', '#566074', '#C8CEDA', '#24406A', '#DAE1EC', '#FFFFFF', '#D4DAE6', '#C7D0E0', '#BAC5DA'],
  ['#0F1520', '#182030', '#212A3C', '#E6EAF2', '#96A1B8', '#2A354B', '#7FA3D8', '#22304A', '#0C1A30', '#202A3D', '#26324A', '#2C3A55']),
 ('cedar', 'Cedar', 'unisex', 'Forest green on warm sand.',
  ['#E9E5DC', '#FAF8F3', '#F1EEE6', '#1F261F', '#666B5F', '#D6D0C2', '#2F5E46', '#DDE6DD', '#FFFFFF', '#E3DCCB', '#D9D0BA', '#CFC4A9'],
  ['#141812', '#1D221B', '#262B23', '#ECEADF', '#A2A692', '#32392F', '#7DB596', '#26322A', '#0F1F16', '#2A2E24', '#30352A', '#363C2F']),
 ('signal', 'Signal', 'unisex', 'Graphite with a clear cyan.',
  ['#E4E6E8', '#F6F7F8', '#ECEEEF', '#16191C', '#5C646B', '#CDD1D5', '#138C97', '#D3E8EA', '#FFFFFF', '#DADDE0', '#D0D4D8', '#C6CBD0'],
  ['#131516', '#1C1F21', '#25282A', '#EAEDEF', '#9AA2A8', '#2F3437', '#4FC3CE', '#20373A', '#07252A', '#26292C', '#2B2F32', '#303437']),
 ('glacier', 'Glacier', 'unisex', 'Steel blue. Light and open.',
  ['#E4EBF0', '#F8FBFD', '#EEF3F7', '#15222B', '#5A6D7A', '#CCD8E0', '#3C86A8', '#D8E8F0', '#FFFFFF', '#D4E3EC', '#C6DAE6', '#B8D1E0'],
  ['#121A20', '#1B252D', '#243139', '#E6EEF4', '#97AAB8', '#2D3C47', '#74B8D8', '#1F3341', '#0A2230', '#202D37', '#253440', '#2A3B48']),
 ('grove', 'Grove', 'unisex', 'Olive on linen. Earthy and relaxed.',
  ['#E8E6DB', '#FAF9F2', '#F1EFE5', '#222318', '#686A55', '#D5D3C2', '#6E7B35', '#E4E8D2', '#FFFFFF', '#E0DEC9', '#D6D3B8', '#CCC9A7'],
  ['#171811', '#20221A', '#292B22', '#EDEDDF', '#A5A68A', '#34372A', '#AEBE63', '#2C3220', '#1B2008', '#2A2C20', '#303326', '#36392B']),
 ('ember', 'Ember', 'unisex', 'Warm amber on neutral charcoal.',
  ['#E8E6E3', '#FAF9F7', '#F0EEEB', '#211F1C', '#6A645C', '#D4D0CA', '#B7791F', '#F0E3CC', '#FFFFFF', '#DEDAD4', '#D3CEC6', '#C8C2B8'],
  ['#161513', '#201E1B', '#292724', '#F0EDE8', '#A9A298', '#36332E', '#E0A94A', '#3A3122', '#241802', '#2A2825', '#302D29', '#36332E']),
 ('driftwood', 'Driftwood', 'unisex', 'Taupe stone with deep teal.',
  ['#E6E1DB', '#F9F7F4', '#F0ECE7', '#241F1B', '#6F655B', '#D5CEC5', '#2B6F73', '#D9E6E6', '#FFFFFF', '#DDD5CB', '#D2C9BD', '#C7BDAF'],
  ['#171412', '#211D1A', '#2A2623', '#EFEAE4', '#AAA095', '#37312B', '#6BB7BB', '#25373A', '#0A2326', '#2A2622', '#302B27', '#36312C']),
 ('rosewater', 'Rosewater', 'soft', 'Dusty rose. Gentle and polished.',
  ['#EDE3E3', '#FBF7F7', '#F3ECEC', '#2A1E21', '#7A6368', '#DCCBCD', '#B25B6E', '#F0D9DE', '#FFFFFF', '#E7D5D8', '#DFC8CC', '#D7BCC1'],
  ['#1C1517', '#261D20', '#30262A', '#F3E8EA', '#B49CA1', '#3D2F33', '#E58DA0', '#3A262B', '#2A0E16', '#302226', '#36282C', '#3C2E33']),
 ('cocoa-blush', 'Cocoa Blush', 'soft', 'Soft blush with warm cocoa.',
  ['#EFE4DF', '#FCF8F5', '#F5EDE8', '#2E2220', '#7D6A64', '#E0D0C9', '#8A5A4E', '#F1DFD6', '#FFFFFF', '#EBD9D0', '#E3CEC3', '#DBC3B6'],
  ['#1B1513', '#251D1A', '#2F2623', '#F4EAE5', '#B8A39B', '#3C312C', '#D9A08E', '#392A25', '#2B1610', '#2D2420', '#332924', '#3A2F29']),
 ('apricot', 'Apricot', 'soft', 'Peach and cream. Warm and friendly.',
  ['#F0E5DC', '#FDF9F5', '#F6EEE7', '#2D221B', '#7F6B5C', '#E3D3C5', '#D9734E', '#F8E0D3', '#FFFFFF', '#EDDACB', '#E6D0BE', '#DEC5B1'],
  ['#1B1612', '#261F19', '#302821', '#F6ECE3', '#BAA593', '#3F342B', '#EE9A77', '#3C2A20', '#2C1306', '#2E251D', '#342A21', '#3B3027']),
 ('dusk-rose', 'Dusk Rose', 'soft', 'Muted mauve. Soft and elegant.',
  ['#E9E1E6', '#F9F6F8', '#F0EAEE', '#261E26', '#70636F', '#D8CCD4', '#8B5C7E', '#EBDDE8', '#FFFFFF', '#E2D6DE', '#D9CAD4', '#D0BEC9'],
  ['#181318', '#221B22', '#2B232B', '#F1E9F0', '#B09FAF', '#382E38', '#CC93BF', '#35283A', '#2A1026', '#2A222A', '#30272F', '#372D36']),
 ('raspberry', 'Raspberry Cream', 'soft', 'Berry pink on soft cream.',
  ['#EFE3E7', '#FCF7F9', '#F4ECEF', '#2B1B22', '#7A5F6B', '#DFCBD3', '#A63A62', '#F3D8E2', '#FFFFFF', '#EAD6DD', '#E2CAD3', '#DABEC9'],
  ['#1B1317', '#261B20', '#30242A', '#F5E8EE', '#B79AA8', '#3E2D35', '#E4739B', '#3C2230', '#2E0A18', '#2F2227', '#35272D', '#3C2D34']),
 ('wisteria', 'Wisteria', 'soft', 'Lilac gray. Dreamy but restrained.',
  ['#E6E6EE', '#F8F8FB', '#EFEFF5', '#1F1F2E', '#65657C', '#D0D0DE', '#6F6BA8', '#E1E0F0', '#FFFFFF', '#DDDDEA', '#D2D2E3', '#C7C7DC'],
  ['#14141C', '#1D1D28', '#262633', '#EAEAF4', '#A0A0BA', '#302F42', '#A5A2E0', '#2B2A40', '#14123A', '#25253A', '#2B2B42', '#313149']),
 ('matcha-blush', 'Matcha Blush', 'soft', 'Blush stone with a sage green accent.',
  ['#EFE6E3', '#FCF8F6', '#F4EDEA', '#26211F', '#75685F', '#E1D4CF', '#6B8E78', '#DEE9E1', '#FFFFFF', '#EBDAD6', '#E3D0CB', '#DBC7C1'],
  ['#1A1615', '#231E1C', '#2D2725', '#F3EBE8', '#B2A39D', '#3A312E', '#9CC4A8', '#29372E', '#0F2016', '#2C2523', '#322A28', '#38302D']),
 ('cherry', 'Cherry Cream', 'soft', 'Deep cherry on warm cream.',
  ['#EDE4E2', '#FBF7F5', '#F3EDEB', '#281C1C', '#7A6362', '#DCCDCA', '#9E2F3F', '#F1DAD9', '#FFFFFF', '#E8D7D4', '#DFCAC6', '#D6BEB9'],
  ['#1B1414', '#251C1C', '#2F2424', '#F4E9E8', '#B79F9E', '#3C2E2E', '#E5737F', '#3C2326', '#2E0A10', '#2E2323', '#342929', '#3B2F2F']),
]

# CSS custom property for each colour, then the ones worked out from them
PROP = {'bg': '--bg', 'paper': '--paper', 'paper2': '--paper-2', 'ink': '--ink', 'muted': '--muted', 'line': '--line', 'accent': '--accent',
        'soft': '--accent-soft', 'on': '--on-accent', 't1': '--tab1', 't2': '--tab2', 't3': '--tab3'}
DERIVED = ('--t-day:var(--tab1);--t-week:var(--tab2);--t-month:var(--tab3);--t-year:var(--tab2);--t-study:var(--tab1);--t-tasks:var(--tab3);--t-money:var(--tab2);--t-notes:var(--tab1);'
           '--rule:color-mix(in srgb,var(--line) 62%,var(--paper));--margin:color-mix(in srgb,var(--line) 70%,var(--ink));'
           '--edge:color-mix(in srgb,var(--paper) 55%,var(--bg));--edge2:color-mix(in srgb,var(--line) 70%,var(--bg));'
           '--hl:color-mix(in srgb,var(--accent) 16%,transparent);--tape:color-mix(in srgb,var(--accent) 14%,transparent);--tape2:color-mix(in srgb,var(--accent) 10%,transparent);')

def block(vals, dark):
    out = ''.join(f'{PROP[k]}:{v};' for k, v in zip(K, vals)) + DERIVED
    # the top bar keeps the site's look even when a notebook has its own colour (see .top in style.css)
    out += ''.join(f'--look-{k}:{v};' for k, v in zip(K, vals) if k in ('accent', 'soft', 'on'))
    return out + ('color-scheme:dark;' if dark else '')

css = ['/* Generated by tools/build-looks.py. Do not edit by hand. */']
for slug, name, group, mood, light, dark in LOOKS:
    sel = f'[data-look="{slug}"]'
    css.append(f':root{sel}{{{block(light, False)}}}')
    css.append(f'@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){sel}{{{block(dark, True)}}}}}')
    css.append(f':root[data-theme="dark"]{sel}{{{block(dark, True)}}}')
# the site's own look is also the default when no look is chosen
g = LOOKS[0]
css.append(f':root{{{block(g[4], False)}}}')
css.append(f'@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{{block(g[5], True)}}}}}')
css.append(f':root[data-theme="dark"]{{{block(g[5], True)}}}')

root = pathlib.Path(__file__).resolve().parent.parent
(root / 'assets' / 'looks.css').write_text('\n'.join(css) + '\n', encoding='utf8')
(root / 'assets' / 'looks.json').write_text(json.dumps(
    [{'slug': s, 'name': n, 'group': gr, 'mood': m, 'light': dict(zip(K, l)), 'dark': dict(zip(K, d))} for s, n, gr, m, l, d in LOOKS],
    indent=1) + '\n', encoding='utf8')
print(len(LOOKS), 'looks written')
