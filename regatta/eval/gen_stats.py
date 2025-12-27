import re
import random
import json

filepath = 'regatta/js/script.js'
with open(filepath, 'r') as f:
    content = f.read()

# Extract AI_CONFIG
# Look for "const AI_CONFIG = [" ... "];"
match = re.search(r'const AI_CONFIG = \[(.*?)\];', content, re.DOTALL)
if not match:
    print("AI_CONFIG not found")
    exit(1)

config_str = match.group(1)
# Parse the JS objects. Since it's JS, keys aren't quoted.
# We can use regex to find each object.
# Each object is { ... },
objs = re.findall(r'\{[^\}]+\}', config_str)

new_config = []

stats_keys = ['acceleration', 'momentum', 'handling', 'upwind', 'reach', 'downwind', 'boost']

for obj_str in objs:
    # Extract name to identify
    name_match = re.search(r"name:\s*'([^']+)'", obj_str)
    if not name_match: continue
    name = name_match.group(1)

    # Generate random stats -5 to 5
    stats = {k: random.randint(-5, 5) for k in stats_keys}

    # Reconstruct string
    # We want to insert stats into the object string
    # Remove closing brace
    base = obj_str.strip().rstrip('}')

    stats_str = ", stats: { " + ", ".join([f"{k}: {v}" for k,v in stats.items()]) + " } }"
    new_obj = base + stats_str
    new_config.append(new_obj)

print("const AI_CONFIG = [")
print(",\n    ".join(new_config))
print("];")
