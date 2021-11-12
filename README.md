Fork of https://github.com/jomik/gnome-wallpaper-changer by Jonas Damtoft.

This fork is using Wallhaven's REST API instead of scraping image IDs from HTML responses.

A toggle has also been added for scaling wallpapers to fit the screen.

## Install instructions
```
git clone https://github.com/ssk101/gnome-wallpaper-changer-v2.git ~/.local/share/gnome-shell/extensions/gnome-wallpaper-changer-v2@ssk101.github.com
cd ~/.local/share/gnome-shell/extensions/gnome-wallpaper-changer-v2@ssk101.github.com
glib-compile-schemas ./schemas/
```

Restart gnome-shell by opening the command prompt with Alt+F2 and the command `r`.

## Folder provider
Looks, by default, for wallpapers in `~/wallpapers` and applies them at random.

## Wallhaven provider
As default SFW General pictures with the ratio 16x9 from wallhaven.cc and applies them to your pictures.
It downloads a page of pictures at once and deletes them as they are used.
The images are stored in the `~/local/share/gnome-shell/extensions/gnome-wallpaper-changer-v2@ssk101.github.com/Wallhaven` directory.
