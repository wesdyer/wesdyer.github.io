# Landmarks the editor shell must always have. Run after ANY structural edit: three
# index-slice mishaps in one session all showed up as "a column silently disappeared".
import re, sys
s = open('/Users/wesdyer/Documents/GitHub/wesdyer.github.io/regatta/editor.html').read()
NEED = ['ed-left','ed-mid','ed-right','layer-list','obj-list','layer-settings',
        'layer-settings-top','tool-opts','ice-scatter','ice-vary','venue-none','tool-strip',
        'ed-fields','ed-hint','ed-stats','drawer','checks','inspector','insp-obj','in-kicker',
        'in-name','in-meta','vsel-row','schematic','venue-select','venue-menu','view-fleet',
        'stat-dist','stat-best','stat-limit','stat-legs','tally-body','hud','hud-zoom',
        'scalebar','scaletext','hint-key','hint-tool','hint-mods','btn-fit','btn-drawer',
        'btn-field-wind','btn-field-cur','pal-preview','btn-pal-reset',
        'sel-acts','sel-acts-n','btn-sel-dup','btn-sel-resample','btn-sel-del',
        'btn-sel-union','btn-sel-intersect','btn-sel-subtract','btn-sel-symdiff']
miss = [n for n in NEED if f'id="{n}"' not in s and f'class="{n}"' not in s and f'"{n}"' not in s]
panels = len(re.findall(r'class="mode-panel"', s))
ids = re.findall(r'id="([^"]+)"', s)
import collections
dupes = [k for k,v in collections.Counter(ids).items() if v > 1]
# FOUR layer panels: three under the object list plus Venue's ABOVE it (which now holds only
# the no-placeable-objects note). Land, WIND and CURRENT have none — their tools are on the
# strip and their per-object fields are in the inspector — as do Land, Wind, Current and
# MARKS and ROUTE. The ruler has none either.
ok = not miss and panels == 4 and not dupes
print(('OK  ' if ok else 'BAD ') + f'panels={panels} dupes={dupes or "none"}'
      + (f' MISSING={miss}' if miss else ''))
sys.exit(0 if ok else 1)
