var DEBUG = false;
function debug(message, name) {
	if(!DEBUG)
		return;
	name = name ? ' - ' + name : '';
	log('[wallpaper-changer' + name + '] ' + message);
}

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Self = imports.misc.extensionUtils.getCurrentExtension();

const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

const HOME = GLib.getenv('HOME');

let providers;
let currentProviderType;
let currentProvider;

function getProviders() {
	if(providers) {
		return providers;
	}

	providers = {};
	for(let p in Self.imports.providers) {
		if(!Self.imports.providers[p].Provider) {
			continue; //Other files pollute.
		}
		const provider = Self.imports.providers[p].Provider;
		const name = provider.name;
		providers[name] = provider;
	}
	return providers;
}

function getProvider(providerType) {
	if(providerType !== currentProviderType) {
		if(currentProvider) {
			currentProvider.destroy();
		}

		const providers = this.getProviders();
		let provider = providers[providerType];
		if(provider) {
			currentProvider = new provider();
		} else { //Provider setting doesn't exist (or not any more since a version update).
			provider = providers[Object.keys(providers)[0]]; //Fall back to the first available provider.
			if(provider) {
				currentProvider = new provider();
			} else {
				currentProvider = null; //No providers at all.
			}
		}
	}
	return currentProvider;
}

function getSettings(provider) {
	let sub = '';
	if(provider) {
		sub = '.providers.' + provider.constructor.name.toLowerCase();
	}
	const schema = 'org.gnome.shell.extensions.wallpaper-changer' + sub;
	return imports.misc.extensionUtils.getSettings(schema);
}

function realPath(path) {
	return path.startsWith('~')
		? HOME
		+ path.slice(1)
		: path;
}

function makeDirectory(path) {
	const dir = Gio.File.new_for_path(path);

	if(!dir.query_exists(null)) {
		dir.make_directory_with_parents(null);
	} else if(dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) !== Gio.FileType.DIRECTORY) {
		throw new Error('Not a directory: ' + path);
	}
	return dir;
}

function getFolderWallpapers(dir) {
	const children = dir.enumerate_children('standard::name,standard::type',
		Gio.FileQueryInfoFlags.NONE, null);

	let info, files = [];
	while((info = children.next_file(null)) != null) {
		const type = info.get_file_type();
		const name = info.get_name();
		const child = dir.get_child(name);
		if(isValidWallpaper(name, type)) {
			files.push(child.get_parse_name());
		}
	}

	return files;
}

function isValidWallpaper(file, type) {
	const ext = file.substring(file.lastIndexOf('.') + 1).toLowerCase();
	return type == Gio.FileType.REGULAR
		&& VALID_EXTENSIONS.indexOf(ext) !== -1
}