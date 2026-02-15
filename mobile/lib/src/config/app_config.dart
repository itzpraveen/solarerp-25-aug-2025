class AppConfig {
  const AppConfig({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
    required this.authUsernameDomain,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;
  final String authUsernameDomain;

  factory AppConfig.fromEnvironment() {
    return AppConfig(
      supabaseUrl: const String.fromEnvironment('SUPABASE_URL'),
      supabaseAnonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
      apiBaseUrl: const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'https://erp.tenaga.in',
      ),
      authUsernameDomain: const String.fromEnvironment(
        'AUTH_USERNAME_DOMAIN',
        defaultValue: 'erp.renewg.in',
      ),
    );
  }

  Uri? get apiBaseUri => Uri.tryParse(apiBaseUrl);

  bool get hasValidSupabaseConfig =>
      _isHttpUrl(supabaseUrl) && supabaseAnonKey.trim().isNotEmpty;

  bool get hasValidApiBaseUrl => _isHttpUrl(apiBaseUrl);

  List<String> configErrors() {
    final errors = <String>[];
    if (!_isHttpUrl(supabaseUrl)) {
      errors.add(
        'SUPABASE_URL is missing or invalid. Expected https://<project-ref>.supabase.co',
      );
    }
    if (supabaseAnonKey.trim().isEmpty) {
      errors.add('SUPABASE_ANON_KEY is required.');
    }
    if (!_isHttpUrl(apiBaseUrl)) {
      errors.add('API_BASE_URL is missing or invalid.');
    }
    if (authUsernameDomain.trim().isEmpty) {
      errors.add('AUTH_USERNAME_DOMAIN cannot be empty.');
    }
    return errors;
  }
}

bool _isHttpUrl(String raw) {
  final uri = Uri.tryParse(raw);
  if (uri == null) return false;
  return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
}
