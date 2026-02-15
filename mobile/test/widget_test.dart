import 'package:flutter_test/flutter_test.dart';
import 'package:solarerp_mobile/src/auth/login_identifier.dart';

void main() {
  group('normalizeLoginIdentifier', () {
    test('accepts username and converts to email', () {
      final result = normalizeLoginIdentifier(
        'Field.Agent',
        domain: 'erp.renewg.in',
      );

      expect(result.ok, true);
      expect(result.username, 'field.agent');
      expect(result.email, 'field.agent@erp.renewg.in');
    });

    test('accepts email identifier directly', () {
      final result = normalizeLoginIdentifier(
        'owner@example.com',
        domain: 'erp.renewg.in',
      );

      expect(result.ok, true);
      expect(result.username, 'owner');
      expect(result.email, 'owner@example.com');
    });

    test('rejects invalid short usernames', () {
      final result = normalizeLoginIdentifier('ab', domain: 'erp.renewg.in');
      expect(result.ok, false);
      expect(result.error, isNotNull);
    });
  });
}
