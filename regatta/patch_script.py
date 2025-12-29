
import re

FILE_PATH = 'regatta/js/script.js'

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def replace_draw_water(content):
    # Regex to match the entire drawWater function
    # It starts with 'function drawWater(ctx) {' and ends with the matching closing brace.
    # Since it's hard to match balanced braces with regex, we'll assume the structure found in previous cat/grep

    start_marker = "function drawWater(ctx) {"

    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Error: Could not find drawWater function")
        return content

    # Simple brace counting to find end
    idx = start_idx
    brace_count = 0
    found_start = False
    end_idx = -1

    while idx < len(content):
        char = content[idx]
        if char == '{':
            brace_count += 1
            found_start = True
        elif char == '}':
            brace_count -= 1
            if found_start and brace_count == 0:
                end_idx = idx + 1
                break
        idx += 1

    if end_idx != -1:
        old_func = content[start_idx:end_idx]
        new_func = """function drawWater(ctx) {
    if (window.WaterRenderer) {
        window.WaterRenderer.draw(ctx, state);
    }
}"""
        print(f"Replacing drawWater...")
        return content.replace(old_func, new_func)
    else:
        print("Error: Could not find end of drawWater function")
        return content

def add_f8_listener(content):
    target = "if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }"
    replacement = "if (e.key === 'F2') { e.preventDefault(); toggleSettings(); }\n    if (e.key === 'F8') { e.preventDefault(); toggleWaterDebug(); }"

    if target in content and "toggleWaterDebug" not in content:
        print("Adding F8 listener...")
        return content.replace(target, replacement)
    return content

def init_water_renderer(content):
    target = "initCourse();"
    replacement = "initCourse();\n    \n    // Init Water Renderer\n    if (window.WaterRenderer) window.WaterRenderer.init();"

    # We want to add it inside resetGame, usually near initCourse call.
    # There are multiple initCourse calls. We target the one inside resetGame.
    # A safe bet is looking for a unique context or just replacing the first one inside resetGame?
    # Actually, replacing all occurrences is probably fine as init() should be idempotent or cheap check.
    # But let's try to be specific.

    # resetGame is around line 6600.
    # Let's search for "function resetGame() {" and find the initCourse inside it.

    reset_start = content.find("function resetGame() {")
    if reset_start == -1:
        return content

    next_init = content.find("initCourse();", reset_start)
    if next_init != -1:
        if "window.WaterRenderer.init()" not in content:
            print("Adding WaterRenderer.init() to resetGame...")
            # We replace only this occurrence
            pre = content[:next_init]
            post = content[next_init + len(target):]
            return pre + replacement + post

    return content

def add_ui_elements(content):
    target = "boatRows: {}"
    replacement = """boatRows: {},

    // Water Debug
    waterDebug: document.getElementById('water-debug'),
    waterDebugControls: document.getElementById('water-debug-controls'),
    waterReset: document.getElementById('water-reset'),
    waterClose: document.getElementById('water-close')"""

    if target in content and "waterDebug:" not in content:
        print("Adding UI elements...")
        return content.replace(target, replacement)
    return content

def add_debug_logic(content):
    if "function toggleWaterDebug()" in content:
        return content

    # Append to end, before the last lines
    # Look for "window.state = state;"

    marker = "window.state = state;"
    idx = content.find(marker)

    if idx == -1:
        print("Error: Could not find end of file marker")
        return content

    logic = """
// Water Debug Logic
function toggleWaterDebug() {
    if (!UI.waterDebug) return;
    UI.waterDebug.classList.toggle('hidden');
    if (!UI.waterDebug.classList.contains('hidden')) {
        initWaterDebugUI();
    }
}

function initWaterDebugUI() {
    if (!UI.waterDebugControls || !window.WATER_CONFIG) return;
    UI.waterDebugControls.innerHTML = ''; // Clear

    const createControl = (key, label, type, min, max, step) => {
        const div = document.createElement('div');
        div.className = "flex flex-col gap-1";

        const header = document.createElement('div');
        header.className = "flex justify-between items-end";

        const lbl = document.createElement('label');
        lbl.textContent = label;
        lbl.className = "text-slate-400 font-bold uppercase text-[10px] tracking-wide";

        const valDisp = document.createElement('span');
        valDisp.className = "text-cyan-400 font-mono";
        valDisp.textContent = window.WATER_CONFIG[key];

        header.appendChild(lbl);
        header.appendChild(valDisp);
        div.appendChild(header);

        let input;
        if (type === 'color') {
            input = document.createElement('input');
            input.type = 'color';
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-6 bg-slate-800 rounded cursor-pointer border border-slate-600";
        } else {
            input = document.createElement('input');
            input.type = 'range';
            input.min = min;
            input.max = max;
            input.step = step;
            input.value = window.WATER_CONFIG[key];
            input.className = "w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500";
        }

        input.addEventListener('input', (e) => {
            window.WATER_CONFIG[key] = (type === 'range') ? parseFloat(e.target.value) : e.target.value;
            valDisp.textContent = window.WATER_CONFIG[key];
        });

        div.appendChild(input);
        UI.waterDebugControls.appendChild(div);
    };

    createControl('baseColor', 'Base Color', 'color');
    createControl('depthGradientStrength', 'Vignette Strength', 'range', 0, 1, 0.05);
    createControl('contourOpacity', 'Contour Opacity', 'range', 0, 1, 0.05);
    createControl('contourScale', 'Contour Scale', 'range', 0.5, 3.0, 0.1);
    createControl('contourSpacing', 'Contour Spacing', 'range', 10, 100, 5);
    createControl('contourWarp', 'Contour Warp', 'range', 0, 2.0, 0.1);
    createControl('contourSpeed', 'Flow Speed', 'range', 0, 0.1, 0.005);
    createControl('causticOpacity', 'Caustic Opacity', 'range', 0, 1, 0.05);
    createControl('causticScale', 'Caustic Scale', 'range', 0.5, 5.0, 0.1);
    createControl('grainOpacity', 'Grain Opacity', 'range', 0, 0.2, 0.01);
    createControl('shorelineGlowSize', 'Island Glow Size', 'range', 1.0, 3.0, 0.1);
    createControl('shorelineGlowOpacity', 'Island Glow Opacity', 'range', 0, 1, 0.05);
    createControl('shorelineColor', 'Glow Color', 'color');
}

if (UI.waterReset) {
    UI.waterReset.addEventListener('click', () => {
        // Simple reload for defaults or store defaults separately?
        // Let's just reload page for now or hardcode reset if needed.
        // Or store defaults in water.js
        window.location.reload();
    });
}
if (UI.waterClose) UI.waterClose.addEventListener('click', () => {
    if (UI.waterDebug) UI.waterDebug.classList.add('hidden');
});

"""
    print("Appending debug logic...")
    return content[:idx] + logic + content[idx:]

def main():
    content = read_file(FILE_PATH)

    content = replace_draw_water(content)
    content = add_f8_listener(content)
    content = init_water_renderer(content)
    content = add_ui_elements(content)
    content = add_debug_logic(content)

    write_file(FILE_PATH, content)
    print("Successfully patched script.js")

if __name__ == '__main__':
    main()
