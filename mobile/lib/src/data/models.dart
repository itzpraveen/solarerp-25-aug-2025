class UserProfile {
  const UserProfile({
    required this.userId,
    required this.tenantId,
    required this.role,
    this.displayName,
    this.username,
  });

  final String userId;
  final String tenantId;
  final String role;
  final String? displayName;
  final String? username;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      userId: _asString(json['user_id']),
      tenantId: _asString(json['tenant_id']),
      role: _asString(json['role']),
      displayName: _asNullableString(json['display_name']),
      username: _asNullableString(json['username']),
    );
  }
}

class Branch {
  const Branch({required this.id, required this.name});

  final String id;
  final String name;

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(id: _asString(json['id']), name: _asString(json['name']));
  }
}

class OverviewKpi {
  const OverviewKpi({
    required this.total,
    required this.open,
    required this.dueToday,
    required this.overdue,
    required this.newWeek,
    required this.converted,
    required this.leadsNewMonth,
    required this.leadsConvertedMonth,
    required this.proposalsWeek,
    required this.proposalsMonth,
  });

  final int total;
  final int open;
  final int dueToday;
  final int overdue;
  final int newWeek;
  final int converted;
  final int leadsNewMonth;
  final int leadsConvertedMonth;
  final int proposalsWeek;
  final int proposalsMonth;

  factory OverviewKpi.fromRpcRow(Map<String, dynamic> row) {
    return OverviewKpi(
      total: _asInt(row['total']),
      open: _asInt(row['open']),
      dueToday: _asInt(row['due_today']),
      overdue: _asInt(row['overdue']),
      newWeek: _asInt(row['new_week']),
      converted: _asInt(row['converted_total']),
      leadsNewMonth: _asInt(row['leads_new_month']),
      leadsConvertedMonth: _asInt(row['leads_converted_month']),
      proposalsWeek: _asInt(row['proposals_week']),
      proposalsMonth: _asInt(row['proposals_month']),
    );
  }
}

class LeadSummary {
  const LeadSummary({
    required this.id,
    required this.name,
    required this.phone,
    required this.status,
    required this.source,
    required this.branchId,
    required this.score,
    required this.date,
    required this.nextFollowUpDate,
  });

  final String id;
  final String? name;
  final String? phone;
  final String? status;
  final String? source;
  final String? branchId;
  final int score;
  final DateTime? date;
  final DateTime? nextFollowUpDate;

  factory LeadSummary.fromJson(Map<String, dynamic> json) {
    return LeadSummary(
      id: _asString(json['id']),
      name: _asNullableString(json['name']),
      phone: _asNullableString(json['phone']),
      status: _asNullableString(json['status']),
      source: _asNullableString(json['source']),
      branchId: _asNullableString(json['branch_id']),
      score: _asInt(json['score']),
      date: _parseDate(json['date']),
      nextFollowUpDate: _parseDate(json['next_follow_up_date']),
    );
  }

  bool get isOverdue {
    if (nextFollowUpDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    return nextFollowUpDate!.isBefore(today) && !_isClosedStatus(status);
  }

  bool get isDueToday {
    if (nextFollowUpDate == null) return false;
    final now = DateTime.now();
    return nextFollowUpDate!.year == now.year &&
        nextFollowUpDate!.month == now.month &&
        nextFollowUpDate!.day == now.day &&
        !_isClosedStatus(status);
  }

  String get normalizedStatus => (status ?? '').trim().toLowerCase();

  bool get isConverted => normalizedStatus == 'converted';

  bool get isLost => normalizedStatus == 'lost';

  bool get isClosed => normalizedStatus == 'closed';

  bool get isOpen => !isConverted && !isLost && !isClosed;
}

bool _isClosedStatus(String? status) {
  final normalized = (status ?? '').toLowerCase();
  return normalized == 'closed' ||
      normalized == 'converted' ||
      normalized == 'lost';
}

String _asString(dynamic value) {
  if (value == null) return '';
  return value.toString();
}

String? _asNullableString(dynamic value) {
  if (value == null) return null;
  final out = value.toString().trim();
  return out.isEmpty ? null : out;
}

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? 0;
  return 0;
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  final raw = value.toString();
  if (raw.isEmpty) return null;
  return DateTime.tryParse(raw);
}
