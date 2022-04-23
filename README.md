This Gnome extension changes wallpapers automatically.

Currently it can select a directory locally to load wallpapers from. Other sources of wallpapers are possible but not currently implemented.

This project was started by Jomik, the [original Gnome Wallpaper Changer](https://github.com/jomik/gnome-wallpaper-changer). It was continued by Ssk101 in [their fork](https://github.com/ssk101/gnome-wallpaper-changer-v2), to update the API to Wallhaven. This was then continued by Ghostkeeper [here](https://github.com/Ghostkeeper/gnome-wallpaper-changer).

## Install instructions
To install, you need to put the source code in a specific folder in the extensions folder of Gnome, and then compile the interface schemas for your computer. Execute the following instructions.
```
git clone https://github.com/Ghostkeeper/gnome-wallpaper-changer.git ~/.local/share/gnome-shell/extensions/gnome-wallpaper-changer@ghostkeeper.github.com
cd ~/.local/share/gnome-shell/extensions/gnome-wallpaper-changer@ghostkeeper.github.com
glib-compile-schemas ./schemas/
```

After installation, restart gnome-shell by opening the command prompt with Alt+F2 and the command `r`.

## Folder provider
Looks, by default, for wallpapers in `~/wallpapers` and applies them at random.
