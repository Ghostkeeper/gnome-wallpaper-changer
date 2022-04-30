const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;
const WallpaperProvider = Self.imports.wallpaperProvider;

let WALLPAPER_PATH = '/usr/share/backgrounds/gnome';

class _Provider extends WallpaperProvider.Provider {
	static get name() { return "Folder"; }

	constructor() {
		super();
		this.settings = Utils.getSettings(this);
		this.applySettings();
		this.settings.connect('changed', () => {this.applySettings();});
	}

	getPreferences() {
		const prefs = super.getPreferences();
		this.settings.bind('wallpaper-path', prefs.get_object('field_wallpaper_path'), 'text', Gio.SettingsBindFlags.DEFAULT);
		return prefs;
	}

	destroy() {
		super.destroy();
		if(this.monitor) {
			this.monitor.cancel();
		}
	}

	applySettings() {
		WALLPAPER_PATH = this.settings.get_string('wallpaper-path');
		Utils.debug('_applySettings', this.constructor.name);

		this.setupWallpaperDir();
	}

	setupWallpaperDir() {
		Utils.debug('_setupWallpaperDir', this.constructor.name);
		if(this.monitor) {
			this.monitor.cancel();
		}
		this.monitor = null;
		this.dir = Gio.File.new_for_path(Utils.realPath(WALLPAPER_PATH));
		if(this.dir.query_exists(null)) {
			this.wallpapers = Utils.getFolderWallpapers(this.dir);
			this.monitor = this.dir.monitor_directory(Gio.FileMonitorFlags.NONE, null)
			this.monitor.connect('changed', () => {this.wallpapersChanged();});
		}
	}

	wallpapersChanged(monitor, file, other_file, event_type) {
		Utils.debug('_wallpapersChanged ' + file.get_basename() + ' event: ' + event_type, this.constructor.name);
		if(!this.dir.query_exists(null)) {
			monitor.cancel();
			throw new Error('No directory : ' + this.dir.get_path());
		}

		switch(event_type) {
			case Gio.FileMonitorEvent.DELETED:
				this.wallpapers = this.wallpapers.filter(function(f) {
					return f !== file.get_parse_name();
				});
				break;
			case Gio.FileMonitorEvent.CREATED:
				const path = file.get_parse_name();
				const type = file.query_file_type(Gio.FileQueryInfoFlags.NONE, null);
				if(Utils.isValidWallpaper(type, path)) {
					this.wallpapers.push(path);
				}
				break;
		}
	}
};
var Provider = _Provider; //Expose to public. Apparently the `var Provider = class { }` keyword doesn't support inheritance.
