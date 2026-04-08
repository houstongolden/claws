#!/usr/bin/env python3
"""
Fix JS string escaping issues in the generated dashboard HTML.

The OpenClaw onboarding.finalize wizard regenerates /opt/dashboard/index.html
with unescaped single quotes inside JS string concatenation, causing
SyntaxError on page load. This script fixes three categories:

1. Event handler attributes (onclick="func('arg')") inside JS string context
2. English apostrophes (agent's, What's) inside JS string lines
3. onclick string builders where '' is used as a quote placeholder

Run after any dashboard regeneration.
"""
import re
import sys

path = '/opt/dashboard/index.html'

try:
    with open(path, 'r') as f:
        content = f.read()
except FileNotFoundError:
    print('[fix-dashboard] No dashboard found, skipping', file=sys.stderr)
    sys.exit(0)

lines = content.split('\n')
fixed = []
fix_count = 0

js_keywords = {'case', 'return', 'typeof', 'instanceof', 'in', 'of',
               'new', 'delete', 'void', 'throw'}

for i, line in enumerate(lines):
    new_line = line

    is_js_str = any(x in line for x in ['html+=', 'html +=', 'innerHTML=', 'innerHTML ='])
    if not is_js_str:
        s = line.strip()
        is_js_str = s.startswith("+'") or s.startswith("+ '")

    # FIX 1: on*="func('arg')" event handlers inside JS string context
    for m in re.finditer(r'(on\w+=")((?:[^"\\]|\\.)*)"', line):
        attr = m.group(1)
        val = m.group(2)
        if "'" not in val:
            continue
        before = line[:m.start()]
        if 'html' in before.lower() or '+=' in before or 'innerHTML' in before or "'" in before or '+ ' in before:
            fixed_val = re.sub(r"(?<!\\)'", "\\'", val)
            if fixed_val != val:
                new_line = new_line.replace(attr + val + '"', attr + fixed_val + '"')
                fix_count += 1

    # FIX 2: English apostrophes (word's) in JS string lines
    if is_js_str:
        orig = new_line
        new_line = re.sub(
            r"(\w)'(\w)",
            lambda m: m.group(0) if m.group(1) in js_keywords else m.group(1) + '\\x27' + m.group(2),
            new_line
        )
        if new_line != orig:
            fix_count += 1

    # FIX 2b: English apostrophes anywhere in the <script> block
    # (catches cases not on html+= lines but still inside JS)
    if not is_js_str:
        for m in re.finditer(r"(\w+)'(\w)", line):
            word = m.group(1)
            if word in js_keywords:
                continue
            before = line[:m.start()]
            if "'" in before or '+=' in before or 'html' in before.lower():
                esc = '\\x27'
                pos = m.start() + len(word)
                new_line = new_line[:pos] + esc + new_line[pos+1:]
                fix_count += 1
                break  # re-find after replacement to avoid offset issues

    fixed.append(new_line)

# FIX 3: onclick='func(''+expr+'')' string builder pattern
result = '\n'.join(fixed)
esc = '\\x27'

def fix_onclick_builder(m):
    global fix_count
    fix_count += 1
    func_name = m.group(1)
    expr = m.group(2)
    return "onclick='" + func_name + "(" + esc + "'+" + expr + "+'" + esc + ")'"

result = re.sub(
    r"onclick='(\w+)\(''\+([^+]+)\+''\)'",
    fix_onclick_builder,
    result
)

with open(path, 'w') as f:
    f.write(result)

print(f'[fix-dashboard] Applied {fix_count} escaping fixes to {path}', file=sys.stderr)
