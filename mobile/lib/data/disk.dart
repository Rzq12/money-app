import 'dart:convert';
import 'dart:io';

/// Key-value storage for the store's JSON blobs. Writes are synchronous so a change reaches the
/// screen only after it is on disk, as in the web app's localStorage store.
abstract class Disk {
  String? read(String key);

  /// Writes every entry or throws; callers treat a throw as "nothing was saved".
  void writeAll(Map<String, String> entries);

  /// Keeps an unreadable value under its own name so the next save never overwrites it.
  void keepAside(String key, String raw);
}

/// One `<key>.json` file per key in [dir]. Each write goes to `<key>.json.tmp` first and is then
/// renamed over the old file, so a crash mid-write leaves the previous copy intact.
class FileDisk implements Disk {
  FileDisk(this.dir);
  final Directory dir;

  File _file(String key) => File('${dir.path}${Platform.pathSeparator}$key.json');

  @override
  String? read(String key) {
    final f = _file(key);
    if (!f.existsSync()) return null;
    final bytes = f.readAsBytesSync();
    try {
      return utf8.decode(bytes);
    } on FormatException {
      // Not text at all (flash corruption): keep the bytes aside as they are, then report it.
      try {
        f.copySync(_file('$key.unreadable-${DateTime.now().millisecondsSinceEpoch}').path);
      } on FileSystemException {
        // Disk full: the original stays untouched until the next successful save.
      }
      rethrow;
    }
  }

  @override
  void writeAll(Map<String, String> entries) {
    dir.createSync(recursive: true);
    final tmps = <String, File>{};
    for (final e in entries.entries) {
      final tmp = File('${_file(e.key).path}.tmp');
      tmp.writeAsStringSync(e.value, flush: true);
      tmps[e.key] = tmp;
    }
    for (final e in tmps.entries) {
      e.value.renameSync(_file(e.key).path);
    }
  }

  @override
  void keepAside(String key, String raw) {
    try {
      dir.createSync(recursive: true);
      _file('$key.unreadable-${DateTime.now().millisecondsSinceEpoch}').writeAsStringSync(raw);
    } on FileSystemException {
      // Disk full: the original file stays untouched until the next successful save.
    }
  }
}

/// In-memory disk for tests. Set [full] to make every write fail.
class MemoryDisk implements Disk {
  final Map<String, String> entries = {};
  bool full = false;

  @override
  String? read(String key) => entries[key];

  @override
  void writeAll(Map<String, String> values) {
    if (full) throw const FileSystemException('No space left on device');
    entries.addAll(values);
  }

  @override
  void keepAside(String key, String raw) {
    entries['$key.unreadable-${DateTime.now().millisecondsSinceEpoch}'] = raw;
  }
}
