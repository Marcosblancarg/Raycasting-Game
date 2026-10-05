import os
import re

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MUSIC_DIR = os.path.join(PROJECT_ROOT, 'assets', 'Sounds', 'Music')
CONFIG_FILE = os.path.join(PROJECT_ROOT, 'js', 'config.js')
RELATIVE_PATH_PREFIX = 'assets/Sounds/Music/'

def update_music_config():
    # 1. Scan for music files
    music_files = []
    print(f"Scanning {MUSIC_DIR}...")
    try:
        if not os.path.exists(MUSIC_DIR):
            print(f"Error: Directory not found: {MUSIC_DIR}")
            return

        for f in os.listdir(MUSIC_DIR):
            if f.lower().endswith(('.mp3', '.wav', '.ogg')):
                # Create relative path for JS
                rel_path = f"{RELATIVE_PATH_PREFIX}{f}"
                music_files.append(rel_path)
    except Exception as e:
        print(f"Error scanning directory: {e}")
        return

    if not music_files:
        print("No music files found.")
        return

    print(f"Found {len(music_files)} files.")

    # 2. Format JS array string
    # Formatting as:
    # music: [
    #     'path/to/file1.mp3',
    #     'path/to/file2.mp3'
    # ],
    
    js_array_content = ",\n            ".join([f"'{f}'" for f in music_files])
    new_music_block = f"music: [\n            {js_array_content}\n        ],"

    # 3. Read Config File
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading config file: {e}")
        return

    # 4. Regex Replace
    # Matches: music: [ ... ], OR music: { ... },
    # We need to be careful with the regex to capture the full block.
    # Assuming standard formatting from previous steps.
    
    # Pattern to match 'music: [' ... '],' OR 'music: {' ... '},'
    # Using dotall to match newlines
    # We look for 'music:' followed by possible whitespace, then either [ or {
    # then anything until the matching closing bracket/brace and comma.
    # This is tricky with simple regex if nested which config shouldn't be for this property.
    
    # Let's try a simpler approach if we assume the structure I just wrote:
    # music: [ ... ]
    
    pattern = r"music:\s*(\[.*?\]|\{.*?\})\s*,"
    
    match = re.search(pattern, content, re.DOTALL)
    if match:
        print("Found existing music configuration.")
        new_content = content[:match.start()] + new_music_block + content[match.end():]
        
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated config.js")
    else:
        print("Error: Could not find 'music: [...]' or 'music: {...}' block in config.js")

if __name__ == '__main__':
    update_music_config()
