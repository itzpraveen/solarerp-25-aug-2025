import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';

enum EnsureProfileStatus { success, inviteRequired, unauthorized, failure }

class EnsureProfileResult {
  const EnsureProfileResult({required this.status, this.message});

  final EnsureProfileStatus status;
  final String? message;
}

class SolarErpRepository {
  SolarErpRepository(this._client);

  final SupabaseClient _client;

  Future<UserProfile?> fetchMyProfile() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return null;
    final row = await _client
        .from('profiles')
        .select('user_id, tenant_id, role, display_name')
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return null;
    return UserProfile.fromJson(Map<String, dynamic>.from(row));
  }

  Future<List<Branch>> fetchBranches() async {
    final rows = await _client
        .from('branches')
        .select('id, name')
        .order('name');
    final list = (rows as List<dynamic>? ?? const []);
    return list
        .map((row) => Branch.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<OverviewKpi> fetchOverview({String? branchId}) async {
    final now = DateTime.now();
    final today = _toYmd(now);
    final sow = _toYmd(_startOfWeekMonday(now));
    final monthStart = _toYmd(DateTime(now.year, now.month, 1));

    final rows = await _client.rpc(
      'overview_kpis_agg',
      params: {'_today': today, '_sow': sow, '_month': monthStart},
    );

    final list = (rows as List<dynamic>? ?? const [])
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();

    Map<String, dynamic>? target;
    if (branchId == null) {
      for (final row in list) {
        if (row['is_total'] == true) {
          target = row;
          break;
        }
      }
    } else {
      for (final row in list) {
        final isTotal = row['is_total'] == true;
        final rowBranchId = row['branch_id']?.toString();
        if (!isTotal && rowBranchId == branchId) {
          target = row;
          break;
        }
      }
    }

    return OverviewKpi.fromRpcRow(target ?? const {});
  }

  Future<List<LeadSummary>> fetchLeads({
    String? branchId,
    int limit = 150,
  }) async {
    var query = _client
        .from('leads')
        .select(
          'id, name, phone, status, source, date, next_follow_up_date, score, branch_id',
        );
    if (branchId != null) {
      query = query.eq('branch_id', branchId);
    }

    final rows = await query
        .order('next_follow_up_date', ascending: true, nullsFirst: false)
        .order('date', ascending: false)
        .limit(limit);
    final list = (rows as List<dynamic>? ?? const []);
    return list
        .map((row) => LeadSummary.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<EnsureProfileResult> ensureProfile({
    required String accessToken,
    required Uri apiBaseUri,
  }) async {
    final uri = apiBaseUri.resolve('/api/auth/ensureProfile');
    try {
      final response = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode(<String, dynamic>{}),
          )
          .timeout(const Duration(seconds: 12));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return const EnsureProfileResult(status: EnsureProfileStatus.success);
      }
      final apiMessage = _extractErrorMessage(response.body);
      if (response.statusCode == 403) {
        return EnsureProfileResult(
          status: EnsureProfileStatus.inviteRequired,
          message:
              apiMessage ??
              'Invite required. Ask your admin to add you to their tenant.',
        );
      }
      if (response.statusCode == 401) {
        return EnsureProfileResult(
          status: EnsureProfileStatus.unauthorized,
          message: apiMessage ?? 'Session expired. Please sign in again.',
        );
      }

      return EnsureProfileResult(
        status: EnsureProfileStatus.failure,
        message:
            apiMessage ??
            'Profile verification failed (${response.statusCode}).',
      );
    } on TimeoutException {
      return const EnsureProfileResult(
        status: EnsureProfileStatus.failure,
        message: 'Profile verification timed out. Check internet and retry.',
      );
    } catch (_) {
      return const EnsureProfileResult(
        status: EnsureProfileStatus.failure,
        message: 'Unable to reach backend for profile verification.',
      );
    }
  }
}

String _toYmd(DateTime date) {
  final y = date.year.toString().padLeft(4, '0');
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

DateTime _startOfWeekMonday(DateTime date) {
  final day = date.weekday; // Mon=1..Sun=7
  final diffToMonday = day - DateTime.monday;
  return DateTime(
    date.year,
    date.month,
    date.day,
  ).subtract(Duration(days: diffToMonday));
}

String? _extractErrorMessage(String body) {
  try {
    final parsed = jsonDecode(body);
    if (parsed is Map<String, dynamic>) {
      final error = parsed['error'];
      if (error is String && error.trim().isNotEmpty) {
        return error.trim();
      }
      final message = parsed['message'];
      if (message is String && message.trim().isNotEmpty) {
        return message.trim();
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}
