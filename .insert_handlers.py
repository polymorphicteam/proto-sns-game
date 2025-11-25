import sys

# Read the original file
with open('src/components/player/playerController.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Read the touch handlers to insert
with open('.tmp_touch_handlers.txt', 'r', encoding='utf-8') as f:
    handlers = f.readlines()

# Insert handlers after line 633 (index 633)
result = lines[:633] + handlers + lines[633:]

# Write back
with open('src/components/player/playerController.ts', 'w', encoding='utf-8') as f:
    f.writelines(result)

print("Touch handlers inserted successfully")
