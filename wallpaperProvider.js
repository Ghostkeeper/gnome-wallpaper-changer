const Lang = imports.lang;

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Signals = imports.signals;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Self.imports.utils;

var Provider = class {
	constructor(name) {
		this.__name__ = name;
		Signals.addSignalMethods(this);
		Utils.debug('_init', this.__name__);
		this.currentWallpaper = null;
		this.wallpapers = [];
	}

	next(callback) {
		Utils.debug('next', this.__name__);
		function notCurrent(file) {
			return file !== this.currentWallpaper;
		}

		if(this.wallpapers.length > 1) {
			const index = Math.floor(Math.random() * (this.wallpapers.length - 1));
			this.currentWallpaper = this.wallpapers.filter(Lang.bind(this, notCurrent))[index];
		} else {
			this.currentWallpaper = this.wallpapers[0];
		}

		Utils.debug('next' + this.currentWallpaper, this.__name__);
		if(callback) {
			callback(this.currentWallpaper);
		}
	}

	get() {
		Utils.debug('get', this.__name__);
		return this.currentWallpaper;
	}

	getPreferences() {
		Utils.debug('getPreferences', this.__name__);
		let prefs = Self.dir.get_path() + '/preferences/' + this.__name__.toLowerCase() + '.xml';
		let prefsFile = Gio.File.new_for_path(prefs);
		if(!prefsFile.query_exists(null)) {
			prefs = Self.dir.get_path() + '/preferences/provider.xml';
		}
		const builder = Gtk.Builder.new_from_file(prefs);
		return builder;
	}

	destroy() {
		Utils.debug('destroy', this.__name__);
	}
};