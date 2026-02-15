import 'package:url_launcher/url_launcher.dart';

Future<bool> makePhoneCall(String phone) async {
  final cleaned = phone.replaceAll(RegExp(r'[^\d+]'), '');
  final uri = Uri(scheme: 'tel', path: cleaned);
  return launchUrl(uri);
}

Future<bool> openWhatsApp(String phone, {String? message}) async {
  var cleaned = phone.replaceAll(RegExp(r'[^\d+]'), '');
  // Add 91 prefix for Indian numbers without country code
  if (!cleaned.startsWith('+') && !cleaned.startsWith('91') && cleaned.length == 10) {
    cleaned = '91$cleaned';
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  final params = <String, String>{};
  if (message != null && message.isNotEmpty) {
    params['text'] = message;
  }
  final uri = Uri.https('wa.me', '/$cleaned', params.isEmpty ? null : params);
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<bool> sendEmail(String email) async {
  final uri = Uri(scheme: 'mailto', path: email);
  return launchUrl(uri);
}
