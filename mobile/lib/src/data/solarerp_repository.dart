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

  Future<LeadDetail?> fetchLeadById(String id) async {
    final row = await _client
        .from('leads')
        .select(
          'id, name, phone, email, address, status, source, branch_id, '
          'score, score_breakdown, date, next_follow_up_date, '
          'last_contacted_at, interested_capacity_kw, notes, assigned_to',
        )
        .eq('id', id)
        .maybeSingle();
    if (row == null) return null;
    return LeadDetail.fromJson(Map<String, dynamic>.from(row));
  }

  Future<void> updateLead(String id, Map<String, dynamic> patch) async {
    await _client.from('leads').update(patch).eq('id', id);
  }

  Future<void> updateJob(String id, Map<String, dynamic> patch) async {
    await _client.from('jobs').update(patch).eq('id', id);
  }

  Future<List<JobSummary>> fetchJobs({
    String? branchId,
    int limit = 150,
  }) async {
    var query = _client
        .from('jobs')
        .select(
          'id, customer_id, system_type, capacity_kw, status, '
          'quoted_price, total_amount, deposit_amount, balance_due, '
          'location, notes, date_lead, date_won, date_install, date_handover, '
          'branch_id, program_type, is_loan, created_at, '
          'roof_type, roof_area_sqft, roof_condition, num_floors, building_height_m, mounting_type, '
          'azimuth_deg, tilt_deg, recommended_capacity_kw, recommended_panel_count, recommended_inverter, '
          'shading, obstruction_notes, cable_run_m, '
          'earthing_type, meter_location, wiring_condition, '
          'customers!inner(name, phone)',
        );
    if (branchId != null) {
      query = query.eq('branch_id', branchId);
    }
    final rows = await query.order('created_at', ascending: false).limit(limit);
    final list = (rows as List<dynamic>? ?? const []);
    return list
        .map((row) => JobSummary.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<JobSummary?> fetchJobById(String id) async {
    final row = await _client
        .from('jobs')
        .select(
          'id, customer_id, system_type, capacity_kw, status, '
          'quoted_price, total_amount, deposit_amount, balance_due, '
          'location, notes, date_lead, date_won, date_install, date_handover, '
          'branch_id, program_type, is_loan, created_at, '
          'roof_type, roof_area_sqft, roof_condition, num_floors, building_height_m, mounting_type, '
          'azimuth_deg, tilt_deg, recommended_capacity_kw, recommended_panel_count, recommended_inverter, '
          'shading, obstruction_notes, cable_run_m, '
          'earthing_type, meter_location, wiring_condition, '
          'customers!inner(name, phone)',
        )
        .eq('id', id)
        .maybeSingle();
    if (row == null) return null;
    return JobSummary.fromJson(Map<String, dynamic>.from(row));
  }

  Future<Customer?> fetchCustomerById(String id) async {
    final row = await _client
        .from('customers')
        .select(
          'id, name, phone, email, address, discom, consumer_no, '
          'phase, sanctioned_load_kw, notes',
        )
        .eq('id', id)
        .maybeSingle();
    if (row == null) return null;
    return Customer.fromJson(Map<String, dynamic>.from(row));
  }

  Future<List<TaskItem>> fetchMyTasks() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return const [];
    final rows = await _client
        .from('tasks')
        .select(
          'id, job_id, title, assigned_to, due_date, status, priority, notes',
        )
        .eq('assigned_to', userId)
        .neq('status', 'Done')
        .order('due_date', ascending: true, nullsFirst: false);
    final list = (rows as List<dynamic>? ?? const []);
    return list
        .map((row) => TaskItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<List<TaskItem>> fetchTasksForJob(String jobId) async {
    final rows = await _client
        .from('tasks')
        .select(
          'id, job_id, title, assigned_to, due_date, status, priority, notes',
        )
        .eq('job_id', jobId)
        .order('due_date', ascending: true, nullsFirst: false);
    final list = (rows as List<dynamic>? ?? const []);
    return list
        .map((row) => TaskItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> updateTaskStatus(String taskId, String status) async {
    await _client.from('tasks').update({'status': status}).eq('id', taskId);
  }

  Future<void> createTask(Map<String, dynamic> data) async {
    final profile = await fetchMyProfile();
    if (profile == null) throw StateError('No profile found');
    await _client.from('tasks').insert({
      ...data,
      'tenant_id': profile.tenantId,
      'status': 'Open',
      'priority': data['priority'] ?? 'Medium',
    });
  }

  Future<void> createLead(Map<String, dynamic> data) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw StateError('Not authenticated');
    final profile = await fetchMyProfile();
    if (profile == null) throw StateError('No profile found');
    await _client.from('leads').insert({
      ...data,
      'tenant_id': profile.tenantId,
      'date': _toYmd(DateTime.now()),
    });
  }

  Future<List<Customer>> searchCustomers(String query) async {
    final rows = await _client
        .from('customers')
        .select(
          'id, name, phone, email, address, discom, consumer_no, phase, sanctioned_load_kw, notes',
        )
        .ilike('name', '%$query%')
        .isFilter('deleted_at', null)
        .order('name')
        .limit(20);
    final list = (rows as List<dynamic>? ?? const []);
    return list
        .map((row) => Customer.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> createJob(Map<String, dynamic> data) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw StateError('Not authenticated');
    final profile = await fetchMyProfile();
    if (profile == null) throw StateError('No profile found');
    await _client.from('jobs').insert({
      ...data,
      'tenant_id': profile.tenantId,
      'status': 'Lead',
      'date_lead': _toYmd(DateTime.now()),
    });
  }

  Future<void> updateJobStatus({
    required String jobId,
    required String newStatus,
    required Uri apiBaseUri,
  }) async {
    final session = _client.auth.currentSession;
    if (session == null) throw StateError('Not authenticated');
    final uri = apiBaseUri.resolve('/api/jobs/updateStatus');
    final response = await http
        .post(
          uri,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${session.accessToken}',
          },
          body: jsonEncode({'jobId': jobId, 'newStatus': newStatus}),
        )
        .timeout(const Duration(seconds: 15));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg =
          _extractErrorMessage(response.body) ??
          'Status update failed (${response.statusCode})';
      throw Exception(msg);
    }
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
