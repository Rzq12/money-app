import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
import 'package:material_ui/material_ui.dart';
import 'package:path_provider/path_provider.dart';

import 'app.dart';
import 'data/disk.dart';
import 'data/store.dart';
import 'env.dart';
import 'sync/api.dart';
import 'sync/session.dart';
import 'sync/sync.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting();
  final support = await getApplicationSupportDirectory();
  final disk = FileDisk(Directory('${support.path}${Platform.pathSeparator}kasku'));
  final store = RecordStore(disk);
  late final Auth auth;
  final api = Api(http.Client(), baseUrl: Env.baseUrl, anonKey: Env.supabaseKey, token: () => auth.session?.accessToken);
  auth = Auth(api, SecureSessionStore());
  await auth.load();
  final engine = SyncEngine(store, api, auth, disk)
    ..start(online: Connectivity().onConnectivityChanged.map((r) => !r.contains(ConnectivityResult.none)));
  runApp(KaskuApp(store: store, auth: auth, engine: engine));
}
