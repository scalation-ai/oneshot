# The recorded sounds

Every file here is in the public domain under Creative Commons Zero (CC0 1.0,
https://creativecommons.org/publicdomain/zero/1.0/): free to use in any film, commercial or not, with no
credit required. They were converted to 48 kHz mono WAV; the keys were also high-passed at 450 Hz (the
bottom-out thump removed), trimmed to 90 ms and levelled.

| Folder or file | Source | Original |
|---|---|---|
| `keys/key01` to `key14`, `space`, `enter` | "Keyboard Soundpack #1" by unicaegames, recorded on a Cherry KC 1000, OpenGameArt (CC0) | https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes (single keys 001, 004 to 007, 009 to 017; 002 for the space, 003 for enter) |
| `ui/tick`, `select`, `toggle`, `pluck`, `pluck2`, `ding`, `ding2`, `confirm`, `drop`, `open` | "Interface Sounds" by Kenney (CC0) | https://kenney.nl/assets/interface-sounds (tick_002, select_001, toggle_002, pluck_001, pluck_002, glass_002, glass_001, confirmation_003, drop_002, maximize_007) |
| `ui/switch`, `ui/click` | "UI Audio" by Kenney (CC0) | https://kenney.nl/assets/ui-audio (switch8, click4) |
| `impact/soft_heavy`, `impact/soft`, `impact/plate` | "Impact Sounds" by Kenney (CC0) | https://kenney.nl/assets/impact-sounds (impactSoft_heavy_000, impactSoft_medium_001, impactPlate_light_000) |
| `motion/swoosh`, `swoosh_long`, `whoosh_low`, `ui/snap`, `impact/boom` | Sonic Pi's sample library, from freesound.org, CC0 (see its etc/samples/README.md) | https://github.com/sonic-pi-net/sonic-pi/tree/dev/etc/samples (perc_swoosh, ambi_swoosh, ambi_dark_woosh, perc_snap, misc_cineboom trimmed to 3.5 s) |

To add a sound: CC0 only, its source and original name in this table, converted with
`ffmpeg -i <file> -ac 1 -ar 48000 -c:a pcm_s16le sounds/<folder>/<name>.wav`.
