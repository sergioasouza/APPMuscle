import os
import re

replacements = {
    'bg-zinc-950': 'bg-zinc-50 dark:bg-zinc-950',
    'bg-zinc-900': 'bg-white dark:bg-zinc-900',
    'bg-zinc-800': 'bg-zinc-100 dark:bg-zinc-800',
    'border-zinc-800': 'border-zinc-200 dark:border-zinc-800',
    'border-zinc-700': 'border-zinc-300 dark:border-zinc-700',
    'text-zinc-600': 'text-zinc-400 dark:text-zinc-600',
    'text-zinc-500': 'text-zinc-500 dark:text-zinc-400',
    'text-zinc-400': 'text-zinc-600 dark:text-zinc-400',
    'text-zinc-300': 'text-zinc-700 dark:text-zinc-300',
    'text-zinc-200': 'text-zinc-800 dark:text-zinc-200',
    'text-white': 'text-zinc-900 dark:text-white',
}

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for old, new in replacements.items():
        pattern = r'(?<![:a-zA-Z0-9\-])' + re.escape(old) + r'(?![a-zA-Z0-9\-])'
        new_content = re.sub(pattern, new, new_content)
        
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            replace_in_file(os.path.join(root, file))

print("Applied light/dark mode classes")
