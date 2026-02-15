class NormalizedLoginIdentifier {
  const NormalizedLoginIdentifier._({
    required this.ok,
    this.error,
    this.email,
    this.username,
  });

  final bool ok;
  final String? error;
  final String? email;
  final String? username;

  static NormalizedLoginIdentifier invalid(String message) {
    return NormalizedLoginIdentifier._(ok: false, error: message);
  }

  static NormalizedLoginIdentifier valid({
    required String email,
    required String username,
  }) {
    return NormalizedLoginIdentifier._(
      ok: true,
      email: email,
      username: username,
    );
  }
}

final RegExp _usernameRegExp = RegExp(r'^[a-z0-9][a-z0-9._-]{2,31}$');

String normalizeUsername(String input) {
  return input.trim().toLowerCase();
}

bool isValidUsername(String username) {
  return _usernameRegExp.hasMatch(username);
}

String usernameToEmail(String username, {required String domain}) {
  return '$username@$domain';
}

NormalizedLoginIdentifier normalizeLoginIdentifier(
  String input, {
  required String domain,
}) {
  final raw = input.trim();
  if (raw.isEmpty) {
    return NormalizedLoginIdentifier.invalid('Username is required.');
  }

  final lower = raw.toLowerCase();
  if (lower.contains('@')) {
    final username = lower.split('@').first;
    return NormalizedLoginIdentifier.valid(email: lower, username: username);
  }

  final username = normalizeUsername(lower);
  if (!isValidUsername(username)) {
    return NormalizedLoginIdentifier.invalid(
      'Username must be 3-32 chars (letters, numbers, . _ -).',
    );
  }

  return NormalizedLoginIdentifier.valid(
    email: usernameToEmail(username, domain: domain),
    username: username,
  );
}
