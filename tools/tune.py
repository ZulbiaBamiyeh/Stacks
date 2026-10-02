# Usage: python3 tools/tune.py  (reads replacement pairs from stdin: one card per block)
# Each block: id on a line, then the full replacement U(...) line.
import re, sys
p = 'src/content.js'
s = open(p).read()
lines = s.split('\n')
blocks = [b for b in sys.stdin.read().strip().split('\n') if b.strip()]
repl = {}
for line in blocks:
    m = re.match(r"U\('(\w+)'", line)
    assert m, line
    repl[m.group(1)] = line
done = set()
for i, l in enumerate(lines):
    m = re.match(r"U\('(\w+)'", l)
    if m and m.group(1) in repl:
        lines[i] = repl[m.group(1)]
        done.add(m.group(1))
missing = set(repl) - done
assert not missing, missing
open(p, 'w').write('\n'.join(lines))
print('tuned', len(done))
